import { useState } from "react";
import { Camera, Loader2, RefreshCw, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cameraService } from "@/services/mobile/cameraService";
import { permissionsService } from "@/services/permissionsService";
import { Capacitor } from "@capacitor/core";

import { FaceVerificationFlow } from "./FaceVerificationFlowModal";

/**
 * Camera capture component with built-in real-time lighting analysis,
 * interactive guided liveness challenges (Turn Left, Turn Right, Nod),
 * and InsightFace biometric verification.
 */
export function CameraCaptureMock({
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
      processing={processing}
      onCaptureCompleted={(uri) => {
        onCapture(uri);
      }}
      captureLabel={captureLabel}
    />
  );
}
