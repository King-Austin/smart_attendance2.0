/**
 * Camera service — abstracts Capacitor Camera on native, falls back to the
 * standard web APIs (`getUserMedia`, `<input type="file">`) on the browser.
 *
 * Returns a local URI (Capacitor) or Blob (web) plus helpers to convert into
 * FormData for upload. We deliberately avoid base64 to keep memory pressure low
 * on mobile devices.
 */
import { Camera, CameraResultType, CameraSource, type CameraPhoto } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";

export interface CaptureOptions {
  /** JPEG quality 0–100. Default 80. */
  quality?: number;
  /** Maximum width/height in pixels. Default 1920. */
  maxWidth?: number;
  /** Maximum width/height in pixels. Default 1920. */
  maxHeight?: number;
  /** Allow the user to edit the photo after capture. Default false. */
  allowEditing?: boolean;
  /** Where to read the image from. */
  source?: "camera" | "gallery" | "prompt";
}

export interface CapturedImage {
  /** Web URL or `file://` URI pointing at the local image. */
  uri: string;
  /** Image format (e.g. `image/jpeg`). */
  mimeType: string;
  /** Filename if available (gallery selection). */
  fileName?: string;
  /** Web-only: blob form for upload. */
  blob?: Blob;
}

const DEFAULT_OPTIONS: Required<Omit<CaptureOptions, "source">> & { source: CaptureOptions["source"] } = {
  quality: 80,
  maxWidth: 1920,
  maxHeight: 1920,
  allowEditing: false,
  source: "prompt",
};

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function inferMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

async function fromCapacitorPhoto(photo: CameraPhoto, mimeType: string): Promise<CapturedImage> {
  // Capacitor returns `webPath` on Web/Mobile; `path` only on native. Prefer
  // `webPath` because it can be used directly as `<img src>` in a WebView.
  const uri = photo.webPath ?? (photo.path ? `file://${photo.path}` : "");
  if (!uri) {
    throw new Error("Camera returned no usable URI");
  }
  return {
    uri,
    mimeType: photo.format ? `image/${photo.format.toLowerCase()}` : mimeType,
    fileName: undefined,
  };
}

async function takePicture(options: CaptureOptions = {}): Promise<CapturedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (isNative()) {
    try {
      const photo = await Camera.getPhoto({
        quality: opts.quality,
        allowEditing: opts.allowEditing,
        resultType: CameraResultType.Uri,
        source: opts.source === "gallery" ? CameraSource.Photos : CameraSource.Camera,
        width: opts.maxWidth,
        height: opts.maxHeight,
        correctOrientation: true,
      });
      return await fromCapacitorPhoto(photo, inferMimeType(photo.webPath ?? ""));
    } catch (err) {
      throw mapCameraError(err);
    }
  }

  // Web fallback
  return new Promise<CapturedImage>((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (opts.source === "camera") input.capture = "environment";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      resolve({
        uri: URL.createObjectURL(file),
        mimeType: file.type || "image/jpeg",
        fileName: file.name,
        blob: file,
      });
    };
    input.oncancel = () => reject(new Error("Capture cancelled"));
    input.click();
  });
}

async function pickFromGallery(options: CaptureOptions = {}): Promise<CapturedImage> {
  return takePicture({ ...options, source: "gallery" });
}

function mapCameraError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/denied|permission/i.test(message)) {
    return new Error("Camera permission was denied");
  }
  if (/cancel/i.test(message)) {
    return new Error("Capture cancelled");
  }
  return err instanceof Error ? err : new Error(message);
}

/**
 * Convert a captured image to a FormData payload ready for upload.
 * Always produces a Blob — fetching the URI is required on native where the
 * URI points at a private app directory.
 */
export async function capturedImageToFormData(
  image: CapturedImage,
  fieldName = "image",
  extra: Record<string, string> = {},
): Promise<FormData> {
  let blob = image.blob;
  if (!blob) {
    const res = await fetch(image.uri);
    blob = await res.blob();
  }
  const fileName = image.fileName ?? `capture.${(blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg")}`;
  const file = new File([blob], fileName, { type: blob.type || image.mimeType || "image/jpeg" });
  const form = new FormData();
  form.append(fieldName, file);
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return form;
}

export const cameraService = {
  takePicture,
  pickFromGallery,
  toFormData: capturedImageToFormData,
  isNative,
};
