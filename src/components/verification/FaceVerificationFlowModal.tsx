import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ScanFace,
  Sun,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { analyzeImageLighting, type LightingResult } from "@/services/biometricService";
import { permissionsService } from "@/services/permissionsService";
import {
  initGoogleFaceLandmarker,
  analyzeVideoFrame,
  isPoseValidForStep,
  drawFaceLandmarksOverlay,
  type PoseResult,
  type LivenessStepType,
} from "@/services/googleLivenessTracker";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

export interface FaceVerificationFlowProps {
  onCaptureCompleted: (base64OrUri: string) => void;
  processing?: boolean;
  captureLabel?: string;
}

const LIVENESS_STEPS: { id: LivenessStepType; title: string; prompt: string; icon: typeof ArrowLeft }[] = [
  { id: "left", title: "Turn Left", prompt: "Turn your head slowly to the left", icon: ArrowLeft },
  { id: "right", title: "Turn Right", prompt: "Turn your head slowly to the right", icon: ArrowRight },
  { id: "straight", title: "Look Straight & Nod", prompt: "Look straight into the camera and nod", icon: ScanFace },
];

export function FaceVerificationFlow({
  onCaptureCompleted,
  processing = false,
  captureLabel = "Complete Biometric Verification",
}: FaceVerificationFlowProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [livenessIndex, setLivenessIndex] = useState(0);
  const [inLivenessFlow, setInLivenessFlow] = useState(false);
  const [lighting, setLighting] = useState<LightingResult | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiStatusMessage, setAiStatusMessage] = useState<string>("Initializing Google AI...");
  const [poseHint, setPoseHint] = useState<string>("");
  const [gestureProgress, setGestureProgress] = useState<number>(0);

  const livenessIndexRef = useRef<number>(0);
  const holdCountRef = useRef<number>(0);
  const REQUIRED_HOLD_FRAMES = 3;

  useEffect(() => {
    livenessIndexRef.current = livenessIndex;
  }, [livenessIndex]);

  // Safely stop all active camera video tracks
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore track stop errors
        }
      });
      streamRef.current = null;
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Initialize Google MediaPipe Face Landmarker AI
  useEffect(() => {
    let mounted = true;
    initGoogleFaceLandmarker().then((lm) => {
      if (mounted) {
        landmarkerRef.current = lm;
        setAiStatusMessage(lm ? "Google MediaPipe AI Ready" : "Pose AI Active");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize WebCam stream
  const initCamera = useCallback(async () => {
    stopCamera();
    setError(null);
    try {
      const perm = await permissionsService.request("camera");
      if (perm.state === "denied") {
        setError("Camera permission denied. Please allow camera access in browser settings.");
        return;
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }
    } catch (err) {
      console.warn("Could not start video stream:", err);
    }
  }, [stopCamera]);

  useEffect(() => {
    void initCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Capture final frame from video feed
  const captureOptimalFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Center-crop video square to 512x512 with mirror correction
    const minDim = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - minDim) / 2;
    const sy = (video.videoHeight - minDim) / 2;

    ctx.translate(512, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, 512, 512);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  // Real-time AI 3D Head Pose tracking & Gesture Step Verification Loop
  useEffect(() => {
    if (!videoRef.current || capturedUri) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      // 1. Analyze lighting
      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, 160, 120);
        const imgData = ctx.getImageData(0, 0, 160, 120);
        setLighting(analyzeImageLighting(imgData));
      }

      // 2. Google MediaPipe AI 3D Pose Evaluation
      const now = performance.now();
      const pose: PoseResult = analyzeVideoFrame(video, now, landmarkerRef.current);

      // Render face landmark mesh on overlay canvas
      if (overlayCanvasRef.current) {
        const overlayCanvas = overlayCanvasRef.current;
        if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
          overlayCanvas.width = width;
          overlayCanvas.height = height;
        }
        const overlayCtx = overlayCanvas.getContext("2d");
        if (overlayCtx) {
          const currentStepId = LIVENESS_STEPS[livenessIndexRef.current]?.id ?? "left";
          drawFaceLandmarksOverlay(overlayCtx, width, height, pose, currentStepId);
        }
      }

      // 3. Step verification logic when in liveness flow
      if (inLivenessFlow) {
        const currentIdx = livenessIndexRef.current;
        const currentStepObj = LIVENESS_STEPS[currentIdx];
        if (!currentStepObj) return;

        const check = isPoseValidForStep(pose, currentStepObj.id);
        setPoseHint(check.hint);
        setGestureProgress(check.progressPercent);

        if (check.valid) {
          holdCountRef.current += 1;
          if (holdCountRef.current >= REQUIRED_HOLD_FRAMES) {
            holdCountRef.current = 0;
            if (currentIdx < LIVENESS_STEPS.length - 1) {
              setLivenessIndex(currentIdx + 1);
            } else {
              // All 3 liveness steps verified by Google MediaPipe! Auto capture optimal face
              setInLivenessFlow(false);
              const frame = captureOptimalFrame();
              if (frame) {
                setCapturedUri(frame);
                onCaptureCompleted(frame);
                // Turn off camera stream immediately once capture completes
                stopCamera();
              }
            }
          }
        } else {
          holdCountRef.current = Math.max(0, holdCountRef.current - 1);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [capturedUri, inLivenessFlow, captureOptimalFrame, onCaptureCompleted, stopCamera]);

  // Global safety timeout (20s)
  useEffect(() => {
    if (!inLivenessFlow) return;
    const timeout = setTimeout(() => {
      setInLivenessFlow(false);
      setError("Liveness Check Timed Out: Please complete all head turn gestures in front of the camera.");
    }, 20000);
    return () => clearTimeout(timeout);
  }, [inLivenessFlow]);

  const startLivenessFlow = () => {
    if (lighting?.status === "too_dark") {
      setError("Environment is too dark. Please move to a brighter area before starting.");
      return;
    }
    setError(null);
    setLivenessIndex(0);
    holdCountRef.current = 0;
    setInLivenessFlow(true);
  };

  const resetFlow = () => {
    setCapturedUri(null);
    setInLivenessFlow(false);
    setLivenessIndex(0);
    setError(null);
    holdCountRef.current = 0;
    void initCamera();
  };

  const currentStep = LIVENESS_STEPS[livenessIndex];
  const StepIcon = currentStep?.icon ?? ScanFace;

  return (
    <div className="space-y-4">
      {/* Real-time Lighting & AI Status Meter */}
      <div className="flex items-center justify-between gap-2 text-xs">
        {lighting && !capturedUri && (
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium border transition-colors",
              lighting.status === "good"
                ? "border-success/30 bg-success/10 text-success"
                : "border-warning/40 bg-warning/10 text-warning",
            )}
          >
            {lighting.status === "good" ? (
              <Sun className="h-3.5 w-3.5 text-success" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            )}
            <span>{lighting.message}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px] ml-auto">
          <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
          <span>{aiStatusMessage}</span>
        </div>
      </div>

      {/* Main Viewfinder Frame */}
      <div
        className={cn(
          "relative mx-auto flex aspect-[4/5] w-full max-w-xs items-center justify-center overflow-hidden rounded-2xl border transition-all shadow-inner",
          capturedUri
            ? "border-success/40 bg-success/5"
            : inLivenessFlow
              ? "border-primary/60 bg-primary/5 ring-4 ring-primary/20"
              : "border-border bg-black/90",
        )}
      >
        <canvas ref={canvasRef} className="hidden" />

        {capturedUri ? (
          <img src={capturedUri} alt="Captured Face" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover -scale-x-100"
            />

            {/* Google MediaPipe Canvas Landmark Mesh Overlay */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 h-full w-full object-cover pointer-events-none z-10"
            />

            {/* Target Face Oval Overlay */}
            <div
              className={cn(
                "absolute h-[68%] w-[58%] rounded-[50%] border-2 border-dashed transition-all pointer-events-none z-10",
                inLivenessFlow ? "border-primary animate-pulse shadow-lg" : "border-white/60",
              )}
            />

            {/* Bottom Guidance & Real-time AI Gesture Hint Banner */}
            {(processing || (inLivenessFlow && currentStep)) && (
              <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col items-center gap-1.5 rounded-xl bg-black/80 px-3 py-2 text-center text-white backdrop-blur-md border border-white/10">
                {processing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs font-medium">Processing biometric verification…</span>
                  </div>
                ) : currentStep ? (
                  <div className="flex flex-col items-center gap-1 w-full">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs">
                      <StepIcon className="h-4 w-4 animate-bounce text-primary" />
                      <span>{currentStep.prompt}</span>
                    </div>
                    {poseHint && <p className="text-[11px] font-medium text-emerald-300">{poseHint}</p>}
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>

      {/* Liveness Step Indicators */}
      {inLivenessFlow && (
        <ol className="flex justify-center gap-2">
          {LIVENESS_STEPS.map((st, i) => (
            <li
              key={st.id}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium transition-all",
                i < livenessIndex
                  ? "border-success bg-success/20 text-success"
                  : i === livenessIndex
                    ? "border-primary bg-primary text-primary-foreground font-bold shadow ring-2 ring-primary/30"
                    : "border-border bg-muted text-muted-foreground",
              )}
            >
              {i < livenessIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </li>
          ))}
        </ol>
      )}

      {error && <p className="text-center text-xs text-destructive font-medium">{error}</p>}

      {/* Action Buttons */}
      <div className="flex justify-center gap-2">
        {capturedUri ? (
          <Button variant="outline" onClick={resetFlow} disabled={processing}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retake Scan
          </Button>
        ) : !inLivenessFlow ? (
          <Button onClick={startLivenessFlow} disabled={processing}>
            <ScanFace className="mr-2 h-4 w-4" />
            {captureLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

