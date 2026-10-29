import { FaceVerificationFlow } from "./FaceVerificationFlowModal";

/**
 * Camera capture component with built-in real-time lighting analysis,
 * interactive guided liveness challenges (Turn Left, Turn Right, Nod),
 * and InsightFace biometric verification.
 */
export function CameraCaptureMock({
  captured,
  processing,
  onCapture,
  onRetake,
  captureLabel = "Start Liveness & Face Scan",
}: {
  captured: boolean;
  processing: boolean;
  onCapture: (uri: string) => void;
  onRetake: () => void;
  captureLabel?: string;
}) {
  return (
    <FaceVerificationFlow
      captured={captured}
      processing={processing}
      onCaptureCompleted={onCapture}
      onRetakeRequested={onRetake}
      captureLabel={captureLabel}
    />
  );
}
