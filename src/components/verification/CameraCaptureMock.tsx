import { useState } from "react";
import { Camera, Loader2, RefreshCw, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Camera capture mock. In production this streams the device camera and uploads
 * a temporary frame; the browser never stores the image and never scores it.
 */
export function CameraCaptureMock({
  captured,
  processing,
  onCapture,
  onRetake,
  captureLabel = "Capture Face",
}: {
  captured: boolean;
  processing: boolean;
  onCapture: () => void;
  onRetake: () => void;
  captureLabel?: string;
}) {
  const [ready] = useState(true);

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "relative mx-auto flex aspect-[4/5] w-full max-w-xs items-center justify-center overflow-hidden rounded-2xl border",
          captured ? "border-success/40 bg-success/5" : "border-border bg-secondary",
        )}
      >
        <div
          className={cn(
            "absolute h-[70%] w-[58%] rounded-[50%] border-2 border-dashed",
            captured ? "border-success/60" : "border-primary/50",
          )}
          aria-hidden
        />
        <div className="relative z-10 flex flex-col items-center gap-2 px-6 text-center">
          {processing ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
              <p className="text-sm font-medium text-foreground">Sending to verification server…</p>
            </>
          ) : captured ? (
            <>
              <ScanFace className="h-8 w-8 text-success" aria-hidden />
              <p className="text-sm font-medium text-foreground">Image captured</p>
              <p className="text-xs text-muted-foreground">
                Held temporarily in memory only, never stored in the browser.
              </p>
            </>
          ) : (
            <>
              <Camera className="h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium text-foreground">
                Position your face inside the frame
              </p>
              <p className="text-xs text-muted-foreground">
                Use even lighting and remove hats or sunglasses.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {captured ? (
          <Button variant="outline" onClick={onRetake} disabled={processing}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retake
          </Button>
        ) : (
          <Button onClick={onCapture} disabled={!ready || processing}>
            <Camera className="mr-2 h-4 w-4" />
            {captureLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
