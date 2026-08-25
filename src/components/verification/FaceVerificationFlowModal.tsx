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
  isPoseValidForPhase,
  drawFaceLandmarksOverlay,
  type PoseResult,
  type LivenessPhase,
} from "@/services/googleLivenessTracker";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

export interface FaceVerificationFlowProps {
  onCaptureCompleted: (base64OrUri: string) => void;
  processing?: boolean;
  captureLabel?: string;
}

const PHASES: {
  id: LivenessPhase;
  label: string;
  instruction: string;
  icon: typeof ScanFace;
}[] = [
  { id: "center", label: "Center Face", instruction: "Look straight into the camera", icon: ScanFace },
  { id: "turn_left", label: "Liveness Check", instruction: "Turn your head slowly to the LEFT", icon: ArrowLeft },
  { id: "capture_lock", label: "Frontal Lock", instruction: "Hold still — looking directly at the camera", icon: Sparkles },
];

export function FaceVerificationFlow({
  onCaptureCompleted,
  processing = false,
  captureLabel = "Start Liveness Verification",
}: FaceVerificationFlowProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [inLivenessFlow, setInLivenessFlow] = useState(false);
  const [lighting, setLighting] = useState<LightingResult | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiStatusMessage, setAiStatusMessage] = useState<string>("Initializing Google AI...");
  const [currentInstruction, setCurrentInstruction] = useState<string>("Position your face in the oval frame");
  const [phaseProgress, setPhaseProgress] = useState<number>(0);

  const phaseIndexRef = useRef<number>(0);
  const holdCountRef = useRef<number>(0);
  const REQUIRED_HOLD_FRAMES = 4;

  useEffect(() => {
    phaseIndexRef.current = phaseIndex;
  }, [phaseIndex]);

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
        setAiStatusMessage(lm ? "Google MediaPipe Ready" : "Pose AI Active");
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
        setError("Camera permission denied. Please allow camera access in settings.");
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

  // Capture high-fidelity full unclipped frontal frame from video feed for InsightFace
  const captureOptimalFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    // Scale proportional to max dimension 640px to preserve entire face, forehead, and chin
    const maxDim = 640;
    let targetWidth = video.videoWidth;
    let targetHeight = video.videoHeight;

    if (targetWidth > maxDim || targetHeight > maxDim) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
        targetWidth = maxDim;
      } else {
        targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
        targetHeight = maxDim;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Draw full unclipped camera frame with mirror correction (matching user selfie preview)
    ctx.translate(targetWidth, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      0,
      0,
      video.videoWidth,
      video.videoHeight,
      0,
      0,
      targetWidth,
      targetHeight,
    );
    return canvas.toDataURL("image/jpeg", 0.95);
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
          drawFaceLandmarksOverlay(overlayCtx, width, height, pose, "left");
        }
      }

      // 3. Step verification logic when in liveness flow
      if (inLivenessFlow) {
        const currentIdx = phaseIndexRef.current;
        const currentPhaseObj = PHASES[currentIdx];
        if (!currentPhaseObj) return;

        const check = isPoseValidForPhase(pose, currentPhaseObj.id);
        setCurrentInstruction(check.instruction);
        setPhaseProgress(check.progressPercent);

        if (check.valid) {
          holdCountRef.current += 1;
          const requiredFrames = currentIdx === 0 ? 5 : currentIdx === 1 ? 3 : 4;
          if (holdCountRef.current >= requiredFrames) {
            holdCountRef.current = 0;
            if (currentIdx < PHASES.length - 1) {
              setPhaseIndex(currentIdx + 1);
            } else {
              // Phase 3 (Frontal Lock) verified! Auto capture clear frontal portrait
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

  // Per-phase safety timeout (45s) — resets on each phase transition so user is never rushed
  useEffect(() => {
    if (!inLivenessFlow) return;
    const timeout = setTimeout(() => {
      setInLivenessFlow(false);
      setError("Liveness Check Timed Out. Please ensure good lighting and tap Start to retry.");
    }, 45000);
    return () => clearTimeout(timeout);
  }, [inLivenessFlow, phaseIndex]);

  const startLivenessFlow = () => {
    if (lighting?.status === "too_dark") {
      setError("Environment is too dark. Move to a brighter area before starting.");
      return;
    }
    setError(null);
    setPhaseIndex(0);
    holdCountRef.current = 0;
    setInLivenessFlow(true);
  };

  const resetFlow = () => {
    setCapturedUri(null);
    setInLivenessFlow(false);
    setPhaseIndex(0);
    setError(null);
    holdCountRef.current = 0;
    void initCamera();
  };

  const currentPhase = PHASES[phaseIndex];
  const PhaseIcon = currentPhase?.icon ?? ScanFace;

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
          "relative mx-auto flex aspect-[4/5] w-full max-w-xs items-center justify-center overflow-hidden rounded-3xl border transition-all shadow-inner",
          capturedUri
            ? "border-success/40 bg-success/5"
            : inLivenessFlow
              ? "border-primary/60 bg-primary/5 ring-4 ring-primary/20"
              : "border-border bg-black/90",
        )}
      >
        <canvas ref={canvasRef} className="hidden" />

        {capturedUri ? (
          <img
            src={capturedUri}
            alt="Captured Face"
            className="absolute inset-0 h-full w-full object-cover"
          />
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

            {/* Target Face Oval Reticle */}
            <div
              className={cn(
                "absolute h-[68%] w-[58%] rounded-[50%] border-2 transition-all pointer-events-none z-10",
                inLivenessFlow
                  ? phaseProgress >= 80
                    ? "border-success ring-4 ring-success/30 shadow-lg shadow-success/20 animate-pulse"
                    : "border-primary border-dashed animate-pulse"
                  : "border-white/60 border-dashed",
              )}
            />

            {/* Bottom Single Unified Guidance Banner */}
            {(processing || inLivenessFlow) && (
              <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col items-center gap-1.5 rounded-2xl bg-black/85 px-4 py-2.5 text-center text-white backdrop-blur-md border border-white/10 shadow-xl">
                {processing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs font-semibold">Comparing biometrics with InsightFace…</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 w-full">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs">
                      <PhaseIcon className="h-4 w-4 animate-bounce text-primary" />
                      <span>{currentInstruction}</span>
                    </div>
                    {/* Progress indicator bar */}
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mt-1">
                      <div
                        className="bg-primary h-full transition-all duration-200"
                        style={{ width: `${phaseProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 3-Phase Step Indicators */}
      {inLivenessFlow && (
        <ol className="flex justify-center gap-3">
          {PHASES.map((st, i) => (
            <li
              key={st.id}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-medium transition-all",
                i < phaseIndex
                  ? "border-success bg-success/20 text-success"
                  : i === phaseIndex
                    ? "border-primary bg-primary text-primary-foreground font-bold shadow ring-2 ring-primary/30"
                    : "border-border bg-muted text-muted-foreground opacity-60",
              )}
            >
              {i < phaseIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
              <span>{st.label}</span>
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
          <Button onClick={startLivenessFlow} disabled={processing} className="w-full sm:w-auto">
            <ScanFace className="mr-2 h-4 w-4" />
            {captureLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
