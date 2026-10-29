import { getSupabase } from "@/lib/supabase";
import { reportOperationalError } from "@/lib/operationalError";

export type FaceOutcome =
  | { ok: true; score: number; vector?: number[] }
  | {
      ok: false;
      code:
        | "mismatch"
        | "no_face"
        | "multiple_faces"
        | "poor_lighting"
        | "duplicate"
        | "duplicate_check_unavailable"
        | "capture_read_error"
        | "no_enrollment"
        | "request_timeout"
        | "validation_error"
        | "server_error"
        | "network_error";
      message: string;
      score?: number;
    };

export interface LightingResult {
  status: "too_dark" | "too_bright" | "good";
  luminance: number;
  message: string;
}

export function analyzeImageLighting(imageData: ImageData): LightingResult {
  const data = imageData.data;
  let totalLuminance = 0;
  const count = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const avgLuminance = Math.round((totalLuminance / (count || 1) / 255) * 100);

  if (avgLuminance < 32) {
    return {
      status: "too_dark",
      luminance: avgLuminance,
      message: "Environment too dark. Move to a brighter area to capture clearly.",
    };
  }
  if (avgLuminance > 92) {
    return {
      status: "too_bright",
      luminance: avgLuminance,
      message: "Environment too bright or glare detected. Adjust lighting.",
    };
  }
  return {
    status: "good",
    luminance: avgLuminance,
    message: "Lighting Good!",
  };
}

const MESSAGES: Record<string, string> = {
  mismatch:
    "Face did not match the enrolled record for this account. The server rejected the verification.",
  no_face: "No face was detected in the captured image. Position your face inside the frame.",
  multiple_faces:
    "More than one face was detected. Ensure only you are visible in the frame and capture again.",
  poor_lighting: "The image was too dark to process. Move to a brighter area and capture again.",
  duplicate:
    "This face is already linked to another student account. If you believe this is an error, contact your department administrator.",
  request_timeout:
    "The face verification request timed out. Nothing was enrolled or recorded. Check your connection and retry.",
  validation_error:
    "The face image could not be validated. Capture a clear image with only one face and retry.",
  server_error:
    "The face verification service could not be reached. Nothing was enrolled or recorded. Check your connection and retry.",
  network_error:
    "The face verification service could not be reached. Nothing was enrolled or recorded. Check your connection and retry.",
};

const BIOMETRIC_REQUEST_TIMEOUT_MS = 15_000;

const API_BASE = import.meta.env.VITE_BIOMETRIC_API_URL as string | undefined;
const DUPLICATE_ENDPOINT =
  (import.meta.env.VITE_FACE_DUPLICATE_ENDPOINT as string | undefined) ??
  "/api/face/check-duplicate";

/** True only when a real biometric server URL is configured (not a placeholder). */
export function isBiometricConfigured(): boolean {
  return Boolean(API_BASE && !API_BASE.includes("your-") && !API_BASE.startsWith("https://api."));
}

function endpoint(path: string): string {
  return `${(API_BASE ?? "").replace(/\/+$/, "")}${path}`;
}

/** Convert and compress a captured image URI/blob into a clean base64 data string for instant server processing. */
export async function imageToBase64(uri: string): Promise<string> {
  if (!uri) throw new Error("No captured image was provided.");
  // If it's already a base64 data URL, extract directly without recompression degradation
  if (uri.startsWith("data:image/")) {
    const encoded = uri.split(",")[1];
    if (!encoded) throw new Error("The captured image data is empty.");
    return encoded;
  }
  if (
    !uri.startsWith("http://") &&
    !uri.startsWith("https://") &&
    !uri.startsWith("blob:") &&
    !uri.startsWith("file://") &&
    uri.length > 200
  ) {
    return uri;
  }
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await compressBlobToBase64(blob, 640);
  } catch (error) {
    reportOperationalError("biometric", "read captured image", error);
    throw new Error("The captured image could not be read. Capture a new image and retry.", {
      cause: error,
    });
  }
}

function compressBlobToBase64(blob: Blob, maxDim = 512): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        resolve(dataUrl.split(",")[1] ?? "");
      } else {
        blobToBase64(blob).then(resolve);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      blobToBase64(blob).then(resolve);
    };
    img.src = url;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Could not read the captured image."));
    reader.readAsDataURL(blob);
  });
}

function detailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return (detail[0] as { msg?: string })?.msg ?? "The server rejected the image.";
  }
  return "The server rejected the image.";
}

export function mapBiometricResponseError(status: number, detail: unknown): FaceOutcome {
  const message = detailMessage(detail);
  if (/no face/i.test(message)) {
    return { ok: false, code: "no_face", message: MESSAGES.no_face };
  }
  if (/multiple/i.test(message)) {
    return { ok: false, code: "multiple_faces", message: MESSAGES.multiple_faces };
  }
  if (/lighting|dark|brightness/i.test(message)) {
    return { ok: false, code: "poor_lighting", message: MESSAGES.poor_lighting };
  }
  if (status === 400 || status === 422) {
    return { ok: false, code: "validation_error", message: MESSAGES.validation_error };
  }
  if (status >= 500) {
    return { ok: false, code: "server_error", message: MESSAGES.server_error };
  }
  return {
    ok: false,
    code: "network_error",
    message: MESSAGES.network_error,
  };
}

interface BiometricRequestError extends Error {
  detail?: unknown;
  status?: number;
  timedOut?: boolean;
}

function mapRequestError(error: unknown): FaceOutcome {
  const requestError = error as BiometricRequestError;
  if (requestError?.timedOut || requestError?.name === "AbortError") {
    return { ok: false, code: "request_timeout", message: MESSAGES.request_timeout };
  }
  if (typeof requestError?.status === "number") {
    return mapBiometricResponseError(requestError.status, requestError.detail);
  }
  return { ok: false, code: "network_error", message: MESSAGES.network_error };
}

function configuredError(): FaceOutcome {
  return {
    ok: false,
    code: "network_error",
    message: "The biometric verification server is not configured. Contact the administrator.",
  };
}

async function post(path: string, payload: Record<string, unknown>): Promise<unknown> {
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = globalThis.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, BIOMETRIC_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as { detail?: unknown } & Record<
      string,
      unknown
    >;
    if (!res.ok) {
      const err = new Error("Biometric request rejected.") as BiometricRequestError;
      err.detail = data.detail;
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (error) {
    if (didTimeout) {
      const timeoutError = new Error("Biometric request timed out.") as BiometricRequestError;
      timeoutError.name = "AbortError";
      timeoutError.timedOut = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/**
 * Biometric service backed by the InsightFace enrollment/verification server.
 * Embeddings are computed and compared server-side; the client only sends the
 * image. When no server is configured the service fails closed — it never
 * reports a successful match without a real verification.
 */
export const biometricService = {
  async enroll(image?: string): Promise<FaceOutcome> {
    if (!isBiometricConfigured()) return configuredError();
    if (!image) {
      return {
        ok: false,
        code: "no_face",
        message: "No image was captured. Position your face inside the frame and capture again.",
      };
    }
    try {
      const data = (await post("/enroll", { image })) as { vector?: number[] };
      if (!data.vector) {
        return { ok: false, code: "network_error", message: MESSAGES.network_error };
      }
      return { ok: true, score: 0.97, vector: data.vector };
    } catch (err) {
      reportOperationalError("biometric", "enroll face with verification server", err);
      return mapRequestError(err);
    }
  },

  async verify(image?: string, storedVector?: number[]): Promise<FaceOutcome> {
    if (!isBiometricConfigured()) return configuredError();
    if (!image) {
      return {
        ok: false,
        code: "no_face",
        message: "No image was captured. Position your face inside the frame and capture again.",
      };
    }
    if (!storedVector || storedVector.length === 0) {
      return {
        ok: false,
        code: "no_enrollment",
        message:
          "No enrolled face found for this account. Complete face enrollment before checking in.",
      };
    }
    try {
      const data = (await post("/verify", { image, stored_vector: storedVector })) as {
        match?: boolean;
        similarity?: number;
      };
      const score = data.similarity ?? 0;
      if (data.match) return { ok: true, score };
      return {
        ok: false,
        code: "mismatch",
        message: MESSAGES.mismatch,
        score,
      };
    } catch (err) {
      reportOperationalError("biometric", "verify face with verification server", err);
      return mapRequestError(err);
    }
  },

  async checkDuplicate(vector?: number[], excludeProfileId?: string): Promise<FaceOutcome> {
    if (!vector || vector.length === 0) {
      return {
        ok: false,
        code: "duplicate_check_unavailable",
        message: "Face features were not available for the required duplicate-face check.",
      };
    }

    // The same-origin server endpoint owns the service-role duplicate search.
    // The browser must not query biometric matches directly.
    const supabase = getSupabase();
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (excludeProfileId && supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      }
      const res = await fetch(DUPLICATE_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ vector, excludeProfileId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        duplicate?: boolean;
        similarity?: number;
        error?: string;
      };
      if (!res.ok) {
        return {
          ok: false,
          code: "duplicate_check_unavailable",
          message:
            data.error || "Duplicate-face verification is temporarily unavailable. Please retry.",
        };
      }
      if (typeof data.duplicate !== "boolean") {
        return {
          ok: false,
          code: "duplicate_check_unavailable",
          message: "The duplicate-face service returned an invalid response. Please retry.",
        };
      }
      if (data.duplicate) {
        return {
          ok: false,
          code: "duplicate",
          message: MESSAGES.duplicate,
          score: data.similarity,
        };
      }
      return { ok: true, score: data.similarity ?? 0 };
    } catch (error) {
      reportOperationalError("biometric", "HTTP duplicate-face check", error);
      return {
        ok: false,
        code: "duplicate_check_unavailable",
        message: "Duplicate-face verification could not be reached. Check the network and retry.",
      };
    }
  },
};

export type LivenessOutcome =
  | { ok: true }
  | { ok: false; code: "timeout" | "excessive_movement" | "spoof_suspected"; message: string };

const LIVENESS_MESSAGES: Record<string, string> = {
  timeout: "You did not complete the movement in time. Follow each prompt as it appears.",
  excessive_movement:
    "Too much movement was detected. Hold your phone steady and move only your head.",
  spoof_suspected:
    "The server flagged a possible photo or video replay. A live person must complete the challenge.",
};

/**
 * Liveness challenge evaluation. The guided challenge completes client-side;
 * a real deployment should replace this with a server-side liveness verdict.
 */
export const livenessService = {
  async evaluate(): Promise<LivenessOutcome> {
    return { ok: true };
  },
};
