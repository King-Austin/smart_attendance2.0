import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  ScanFace,
  Sparkles,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { analyzeImageLighting, type LightingResult } from "@/services/biometricService";
import { permissionsService } from "@/services/permissionsService";
import { reportOperationalError } from "@/lib/operationalError";
import { appLifecycleService } from "@/services/mobile/appLifecycleService";
import {
  analyzeVideoFrame,
  disposeGoogleFaceLandmarker,
  drawFaceLandmarksOverlay,
  initGoogleFaceLandmarker,
  resetGoogleFaceLandmarker,
  type FaceLandmarkerRuntime,
} from "@/services/googleLivenessTracker";
import {
  advanceLiveness,
  createLivenessState,
  type LivenessErrorCode,
  type LivenessPhase,
  type LivenessState,
} from "@/services/livenessStateMachine";

export interface FaceVerificationFlowProps {
  onCaptureCompleted: (base64OrUri: string) => void;
  onRetakeRequested?: () => void;
  captured?: boolean;
  processing?: boolean;
  captureLabel?: string;
}

const ERROR_MESSAGES: Record<LivenessErrorCode, string> = {
  FACE_MODEL_LOAD:
    "The face scanner could not start on this device. Tap Retry to use compatibility mode.",
  FACE_MODEL_RUNTIME:
    "Face tracking stopped unexpectedly. Restart the scanner before trying again.",
  FACE_CAMERA_PERMISSION: "Camera access is required. Enable it in settings and retry.",
  FACE_CAMERA_UNAVAILABLE: "The front camera is unavailable. Close other camera apps and retry.",
  FACE_NO_FACE: "No face detected. Position your face inside the oval frame.",
  FACE_MULTIPLE_FACES:
    "Only one person can be visible during the scan. Ask others to move out of view, then try again.",
  FACE_TOO_DARK: "The area is too dark. Face a light source and try again.",
  FACE_TOO_BRIGHT: "There is too much glare. Move away from direct light and try again.",
  FACE_POSITION: "Move closer and centre your face inside the oval frame.",
  FACE_TIMEOUT: "The liveness check timed out. Tap Retry and follow each prompt.",
  FACE_CAPTURE: "A clear portrait could not be captured. Hold the phone steady and retry.",
  FACE_SERVER_UNAVAILABLE:
    "The face verification service could not be reached. Nothing was enrolled or recorded. Check your connection and retry.",
  FACE_MISMATCH:
    "Your face could not be verified. Remove face coverings, use even lighting, and retry.",
  FACE_DUPLICATE:
    "This face is already linked to another student account. If you believe this is an error, contact your department administrator.",
};

function randomDirection(): "left" | "right" {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 0 ? "left" : "right";
  }
  return Math.random() < 0.5 ? "left" : "right";
}

function instructionFor(state: LivenessState | null): string {
  if (!state) return "Position your face in the oval frame";
  if (state.guidanceCode) return ERROR_MESSAGES[state.guidanceCode];
  switch (state.phase) {
    case "calibrate_center":
      return "Look straight at the camera while we calibrate";
    case "turn_left":
    case "fallback_turn_left":
      return "Turn your head slowly to your left";
    case "turn_right":
    case "fallback_turn_right":
      return "Turn your head slowly to your right";
    case "blink":
      return "Blink once, then open your eyes";
    case "capture_lock":
      return "Look straight and hold still";
    case "complete":
      return "Liveness confirmed";
    case "failed":
      return state.errorCode ? ERROR_MESSAGES[state.errorCode] : ERROR_MESSAGES.FACE_TIMEOUT;
  }
}

function phaseIndex(phase?: LivenessPhase): number {
  if (!phase || phase === "calibrate_center") return 0;
  if (phase === "turn_left" || phase === "turn_right") return 1;
  if (phase === "blink" || phase.startsWith("fallback_turn_")) return 2;
  return 3;
}

function emitPhaseDiagnostic(phase: LivenessPhase, failureCode: LivenessErrorCode | null) {
  window.dispatchEvent(
    new CustomEvent("scp:liveness-diagnostic", {
      detail: {
        operation: "phase transition",
        timestamp: new Date().toISOString(),
        context: failureCode ? { phase, failureCode } : { phase },
      },
    }),
  );
}

export function FaceVerificationFlow({
  onCaptureCompleted,
  onRetakeRequested,
  captured = false,
  processing = false,
  captureLabel = "Start Liveness Verification",
}: FaceVerificationFlowProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runtimeRef = useRef<FaceLandmarkerRuntime | null>(null);
  const machineRef = useRef<LivenessState | null>(null);
  const lightingRef = useRef<LightingResult | null>(null);
  const callbackRef = useRef(onCaptureCompleted);
  const frameHandleRef = useRef<number | null>(null);
  const frameHandleTypeRef = useRef<"video" | "animation" | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastInferenceAtRef = useRef(0);
  const lastLightingAtRef = useRef(0);
  const inferenceRunningRef = useRef(false);
  const suspendedRef = useRef(false);
  const mountedRef = useRef(true);
  const lifecycleEpochRef = useRef(0);
  const lifecycleQueueRef = useRef<Promise<void>>(Promise.resolve());

  const [cameraReady, setCameraReady] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [aiInitializing, setAiInitializing] = useState(true);
  const [delegate, setDelegate] = useState<"GPU" | "CPU" | null>(null);
  const [machine, setMachine] = useState<LivenessState | null>(null);
  const [inLivenessFlow, setInLivenessFlow] = useState(false);
  const [lighting, setLighting] = useState<LightingResult | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const diagnosticPhase = machine?.phase;
  const diagnosticErrorCode = machine?.errorCode ?? null;

  useEffect(() => {
    callbackRef.current = onCaptureCompleted;
  }, [onCaptureCompleted]);

  useEffect(() => {
    if (diagnosticPhase) emitPhaseDiagnostic(diagnosticPhase, diagnosticErrorCode);
  }, [diagnosticErrorCode, diagnosticPhase]);

  const cancelFrameLoop = useCallback(() => {
    const handle = frameHandleRef.current;
    if (handle !== null) {
      if (frameHandleTypeRef.current === "video") {
        videoRef.current?.cancelVideoFrameCallback?.(handle);
      } else {
        cancelAnimationFrame(handle);
      }
    }
    frameHandleRef.current = null;
    frameHandleTypeRef.current = null;
    inferenceRunningRef.current = false;
  }, []);

  const stopCamera = useCallback(() => {
    cancelFrameLoop();
    for (const track of streamRef.current?.getTracks() ?? []) {
      try {
        track.stop();
      } catch (trackError) {
        reportOperationalError("camera", "stop liveness video track", trackError, {
          severity: "warning",
        });
      }
    }
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (mountedRef.current) setCameraReady(false);
  }, [cancelFrameLoop]);

  const initializeModel = useCallback(async (forceReset = false) => {
    if (!mountedRef.current) return null;
    setAiInitializing(true);
    setAiReady(false);
    setError(null);
    const runtime = forceReset
      ? await resetGoogleFaceLandmarker()
      : await initGoogleFaceLandmarker();
    if (!mountedRef.current) return null;
    runtimeRef.current = runtime;
    setAiInitializing(false);
    setAiReady(Boolean(runtime));
    setDelegate(runtime?.delegate ?? null);
    if (!runtime) setError(ERROR_MESSAGES.FACE_MODEL_LOAD);
    return runtime;
  }, []);

  const initCamera = useCallback(async () => {
    stopCamera();
    if (!mountedRef.current || suspendedRef.current) return false;
    setError(null);
    try {
      const permission = await permissionsService.request("camera");
      if (permission.state !== "granted") {
        setError(permission.detail || ERROR_MESSAGES.FACE_CAMERA_PERMISSION);
        return false;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(ERROR_MESSAGES.FACE_CAMERA_UNAVAILABLE);
        return false;
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: false,
      });
      if (!mountedRef.current || suspendedRef.current) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return false;
      }
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      return true;
    } catch (cameraError) {
      reportOperationalError("camera", "start liveness video stream", cameraError);
      setError(
        cameraError instanceof DOMException && cameraError.name === "NotAllowedError"
          ? ERROR_MESSAGES.FACE_CAMERA_PERMISSION
          : ERROR_MESSAGES.FACE_CAMERA_UNAVAILABLE,
      );
      return false;
    }
  }, [stopCamera]);

  const captureOptimalFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return null;
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.92);
  }, []);

  const completeCapture = useCallback(() => {
    const frame = captureOptimalFrame();
    setInLivenessFlow(false);
    machineRef.current = null;
    if (!frame) {
      setError(ERROR_MESSAGES.FACE_CAPTURE);
      return;
    }
    setCapturedUri(frame);
    callbackRef.current(frame);
    stopCamera();
  }, [captureOptimalFrame, stopCamera]);

  const processFrame = useCallback(
    (now: number) => {
      const video = videoRef.current;
      const runtime = runtimeRef.current;
      if (
        suspendedRef.current ||
        capturedUri ||
        !video ||
        video.readyState < 2 ||
        !runtime ||
        inferenceRunningRef.current
      ) {
        return;
      }
      if (
        video.currentTime === lastVideoTimeRef.current ||
        now - lastInferenceAtRef.current < 100
      ) {
        return;
      }

      lastVideoTimeRef.current = video.currentTime;
      lastInferenceAtRef.current = now;
      inferenceRunningRef.current = true;
      try {
        let canvas = analysisCanvasRef.current;
        if (!canvas) {
          canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 240;
          analysisCanvasRef.current = canvas;
        }
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(video, 0, 0, 320, 240);

        if (!lightingRef.current || now - lastLightingAtRef.current >= 500) {
          const nextLighting = analyzeImageLighting(context.getImageData(0, 0, 320, 240));
          lightingRef.current = nextLighting;
          lastLightingAtRef.current = now;
          setLighting(nextLighting);
        }
        const lightingStatus = lightingRef.current?.status ?? "good";
        const frame = analyzeVideoFrame(canvas, now, runtime, lightingStatus);

        if (frame.runtimeError) {
          setAiReady(false);
          setDelegate(null);
          setError(ERROR_MESSAGES.FACE_MODEL_RUNTIME);
        }

        const overlay = overlayCanvasRef.current;
        if (overlay) {
          const width = video.videoWidth || 640;
          const height = video.videoHeight || 480;
          if (overlay.width !== width || overlay.height !== height) {
            overlay.width = width;
            overlay.height = height;
          }
          const overlayContext = overlay.getContext("2d");
          if (overlayContext) drawFaceLandmarksOverlay(overlayContext, width, height, frame);
        }

        if (machineRef.current) {
          const nextMachine = advanceLiveness(machineRef.current, frame);
          machineRef.current = nextMachine;
          setMachine(nextMachine);
          if (nextMachine.phase === "failed") {
            setInLivenessFlow(false);
            setError(
              nextMachine.errorCode
                ? ERROR_MESSAGES[nextMachine.errorCode]
                : ERROR_MESSAGES.FACE_TIMEOUT,
            );
            if (nextMachine.errorCode === "FACE_MODEL_RUNTIME") {
              setAiReady(false);
              setDelegate(null);
            }
          } else if (nextMachine.phase === "complete") {
            completeCapture();
          }
        }
      } finally {
        inferenceRunningRef.current = false;
      }
    },
    [capturedUri, completeCapture],
  );

  const processFrameRef = useRef(processFrame);
  useEffect(() => {
    processFrameRef.current = processFrame;
  }, [processFrame]);

  const scheduleNextFrame = useCallback(() => {
    if (suspendedRef.current || capturedUri || frameHandleRef.current !== null) return;
    const video = videoRef.current;
    if (!video || !streamRef.current || runtimeRef.current?.state !== "ready") return;
    const tick = (now: number) => {
      frameHandleRef.current = null;
      frameHandleTypeRef.current = null;
      processFrameRef.current(now);
      scheduleNextFrame();
    };
    if (video.requestVideoFrameCallback) {
      frameHandleTypeRef.current = "video";
      frameHandleRef.current = video.requestVideoFrameCallback(tick);
    } else {
      frameHandleTypeRef.current = "animation";
      frameHandleRef.current = requestAnimationFrame(tick);
    }
  }, [capturedUri]);

  useEffect(() => {
    if (cameraReady && aiReady && !capturedUri) scheduleNextFrame();
    return cancelFrameLoop;
  }, [aiReady, cameraReady, capturedUri, cancelFrameLoop, scheduleNextFrame]);

  const resetChallenge = useCallback(() => {
    const state = createLivenessState(randomDirection(), performance.now());
    machineRef.current = state;
    setMachine(state);
    setError(null);
    setInLivenessFlow(true);
  }, []);

  const resumeScanner = useCallback(() => {
    const epoch = ++lifecycleEpochRef.current;
    suspendedRef.current = false;
    setInLivenessFlow(false);
    machineRef.current = null;
    setMachine(null);
    setCapturedUri(null);
    setLighting(null);
    lightingRef.current = null;
    const resume = lifecycleQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (!mountedRef.current || suspendedRef.current || epoch !== lifecycleEpochRef.current) {
          return;
        }
        await Promise.all([initializeModel(false), initCamera()]);
      });
    lifecycleQueueRef.current = resume;
    return resume;
  }, [initCamera, initializeModel]);

  const suspendScanner = useCallback(
    (disposeModel: boolean) => {
      if (suspendedRef.current) return;
      lifecycleEpochRef.current += 1;
      suspendedRef.current = true;
      setInLivenessFlow(false);
      machineRef.current = null;
      setMachine(null);
      stopCamera();
      if (disposeModel) {
        disposeGoogleFaceLandmarker();
        runtimeRef.current = null;
        setAiReady(false);
        setDelegate(null);
      }
    },
    [stopCamera],
  );

  useEffect(() => {
    mountedRef.current = true;
    void resumeScanner();

    const onVisibilityChange = () => {
      if (document.hidden) suspendScanner(false);
      else void resumeScanner();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    let removeNativeListener: (() => Promise<void>) | null = null;
    void appLifecycleService
      .onAppStateChange(({ isActive }) => {
        if (isActive) void resumeScanner();
        else suspendScanner(true);
      })
      .then((remove) => {
        removeNativeListener = remove;
      })
      .catch((lifecycleError) =>
        reportOperationalError("liveness", "register app lifecycle listener", lifecycleError, {
          severity: "warning",
        }),
      );

    return () => {
      mountedRef.current = false;
      lifecycleEpochRef.current += 1;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (removeNativeListener) void removeNativeListener();
      stopCamera();
      disposeGoogleFaceLandmarker();
      runtimeRef.current = null;
    };
  }, [resumeScanner, stopCamera, suspendScanner]);

  useEffect(() => {
    if (!captured && capturedUri && !processing) {
      setCapturedUri(null);
      void initCamera();
    }
  }, [captured, capturedUri, initCamera, processing]);

  const startLivenessFlow = () => {
    if (!aiReady || !runtimeRef.current) {
      setError(ERROR_MESSAGES.FACE_MODEL_LOAD);
      return;
    }
    if (!cameraReady) {
      setError(ERROR_MESSAGES.FACE_CAMERA_UNAVAILABLE);
      return;
    }
    if (!lighting) {
      setError("Wait for the camera lighting check before starting.");
      return;
    }
    if (lighting.status === "too_dark") {
      setError(ERROR_MESSAGES.FACE_TOO_DARK);
      return;
    }
    if (lighting.status === "too_bright") {
      setError(ERROR_MESSAGES.FACE_TOO_BRIGHT);
      return;
    }
    resetChallenge();
  };

  const retake = () => {
    setCapturedUri(null);
    setInLivenessFlow(false);
    machineRef.current = null;
    setMachine(null);
    setError(null);
    onRetakeRequested?.();
    void initCamera();
  };

  const retryModel = async () => {
    setInLivenessFlow(false);
    machineRef.current = null;
    setMachine(null);
    const runtime = await initializeModel(true);
    if (runtime && !cameraReady) await initCamera();
  };

  const currentIndex = phaseIndex(machine?.phase);
  const challengeDirection = machine?.challengeDirection ?? "left";
  const steps = [
    { label: "Calibrate", icon: ScanFace },
    {
      label: challengeDirection === "left" ? "Turn left" : "Turn right",
      icon: challengeDirection === "left" ? ArrowLeft : ArrowRight,
    },
    {
      label: machine?.phase.startsWith("fallback_turn_") ? "Second turn" : "Blink",
      icon: machine?.phase.startsWith("fallback_turn_")
        ? challengeDirection === "left"
          ? ArrowRight
          : ArrowLeft
        : Eye,
    },
    { label: "Hold still", icon: Sparkles },
  ];
  const CurrentIcon = steps[currentIndex]?.icon ?? ScanFace;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-xs">
        {lighting && !capturedUri ? (
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-medium",
              lighting.status === "good"
                ? "border-success/30 bg-success/10 text-success"
                : "border-warning/40 bg-warning/10 text-warning",
            )}
          >
            {lighting.status === "good" ? (
              <Sun className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>{lighting.message}</span>
          </div>
        ) : (
          <span />
        )}
        <div className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          {aiInitializing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          )}
          <span>
            {aiInitializing
              ? "Loading face scanner…"
              : aiReady
                ? `${delegate === "CPU" ? "Compatibility" : "Accelerated"} mode ready`
                : "Face scanner unavailable"}
          </span>
        </div>
      </div>

      <div
        className={cn(
          "relative mx-auto flex aspect-[4/5] w-full max-w-xs items-center justify-center overflow-hidden rounded-3xl border shadow-inner transition-[color,background-color,border-color,box-shadow]",
          capturedUri
            ? "border-success/40 bg-success/5"
            : inLivenessFlow
              ? "border-primary/60 bg-primary/5 ring-4 ring-primary/20"
              : "border-border bg-black/90",
        )}
      >
        {capturedUri ? (
          <img
            src={capturedUri}
            alt="Captured face"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label="Front camera preview"
              className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
            />
            <canvas
              ref={overlayCanvasRef}
              className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover"
              aria-hidden
            />
            <div
              className={cn(
                "pointer-events-none absolute z-10 h-[68%] w-[58%] rounded-[50%] border-2 transition-colors",
                inLivenessFlow
                  ? (machine?.progressPercent ?? 0) >= 80
                    ? "border-success ring-4 ring-success/30"
                    : "border-primary border-dashed"
                  : "border-white/60 border-dashed",
              )}
              aria-hidden
            />

            {(processing || inLivenessFlow) && (
              <div className="absolute bottom-3 left-3 right-3 z-20 rounded-2xl border border-white/10 bg-black/85 px-4 py-3 text-center text-white shadow-xl backdrop-blur-md">
                {processing ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
                    <span className="text-xs font-semibold">Comparing biometrics securely…</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary">
                      <CurrentIcon className="h-4 w-4" aria-hidden />
                      <span>{instructionFor(machine)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-primary transition-[width] duration-200"
                        style={{ width: `${machine?.progressPercent ?? 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {inLivenessFlow && (
        <ol className="grid grid-cols-4 gap-1.5" aria-label="Liveness progress">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.label}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-1 rounded-xl border px-1.5 text-center text-[10px] font-medium",
                  index < currentIndex
                    ? "border-success bg-success/15 text-success"
                    : index === currentIndex
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-muted-foreground opacity-70",
                )}
              >
                {index < currentIndex ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : (
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
                <span>{step.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {error && (
        <p
          className="text-center text-sm font-medium text-destructive"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      )}

      <div className="flex justify-center gap-2">
        {capturedUri ? (
          <Button variant="outline" onClick={retake} disabled={processing} className="min-h-12">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Retake scan
          </Button>
        ) : !inLivenessFlow ? (
          !aiReady ? (
            <Button
              variant="outline"
              onClick={() => void retryModel()}
              disabled={processing || aiInitializing}
              className="min-h-12 w-full sm:w-auto"
            >
              {aiInitializing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              )}
              {aiInitializing ? "Loading scanner…" : "Retry face scanner"}
            </Button>
          ) : !cameraReady ? (
            <Button
              variant="outline"
              onClick={() => void initCamera()}
              disabled={processing}
              className="min-h-12 w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Retry camera
            </Button>
          ) : (
            <Button
              onClick={startLivenessFlow}
              disabled={processing || !lighting}
              className="min-h-12 w-full sm:w-auto"
            >
              <ScanFace className="mr-2 h-4 w-4" aria-hidden />
              {captureLabel}
            </Button>
          )
        ) : null}
      </div>
    </div>
  );
}
