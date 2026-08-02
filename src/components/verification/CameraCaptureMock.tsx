import { useState } from "react";
import { Camera, Loader2, RefreshCw, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cameraService } from "@/services/mobile/cameraService";
import { Capacitor } from "@capacitor/core";

/**
 * Camera capture component. On native Android, it uses
 * `@capacitor/camera` to open the system camera and returns a local file URI.
 * On the web it falls back to a simulated preview (the production-grade capture
 * is gated by a different code path for the browser build).
 */
export function CameraCaptureMock({
  processing,
  onCapture,
  onRetake,
  captureLabel = "Capture Face",
}: {
  captured: boolean;
  processing: boolean;
  onCapture: (uri: string) => void;
  onRetake: () => void;
  captureLabel?: string;
}) {
  const [ready] = useState(true);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState(false);
  const [busy, setBusy] = useState(false);

  const isNative = Capacitor.isNativePlatform();

  async function handleCapture() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (isNative) {
        const result = await cameraService.takePicture({
          quality: 80,
          maxWidth: 1920,
          maxHeight: 1920,
          source: "camera",
        });
        setPreviewUri(result.uri);
        setCaptured(true);
        onCapture(result.uri);
      } else {
        // Web / dev fallback: keep the existing mock flow.
        setPreviewUri(null);
        setCaptured(true);
        onCapture("");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Capture failed";
      // Cancellation is not an error to surface.
      if (!/cancel/i.test(message)) {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleRetake() {
    setPreviewUri(null);
    setCaptured(false);
    setError(null);
    onRetake();
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "relative mx-auto flex aspect-[4/5] w-full max-w-xs items-center justify-center overflow-hidden rounded-2xl border",
          captured ? "border-success/40 bg-success/5" : "border-border bg-secondary",
        )}
      >
        {previewUri ? (
          <img
            src={previewUri}
            alt="Captured face"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <>
            <div
              className={cn(
                "absolute h-[70%] w-[58%] rounded-[50%] border-2 border-dashed",
                captured ? "border-success/60" : "border-primary/50",
              )}
              aria-hidden
            />
            <div className="relative z-10 flex flex-col items-center gap-2 px-6 text-center">
              {processing || busy ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
                  <p className="text-sm font-medium text-foreground">
                    {isNative ? "Opening camera…" : "Sending to verification server…"}
                  </p>
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
          </>
        )}
      </div>

      {error ? (
        <p className="mx-auto max-w-xs text-center text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        {captured ? (
          <Button variant="outline" onClick={handleRetake} disabled={processing || busy}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retake
          </Button>
        ) : (
          <Button onClick={handleCapture} disabled={!ready || processing || busy}>
            <Camera className="mr-2 h-4 w-4" />
            {captureLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
