import { config, apiUrl } from "@/lib/config";
import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
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

export function analyzeImageLighting(imageData: { data: Uint8ClampedArray }): LightingResult {
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

const API_BASE = config.biometricBase;
/** True only when a real biometric server URL is configured (not a placeholder). */
export function isBiometricConfigured(): boolean {
  return Boolean(API_BASE?.startsWith("https://") && !API_BASE.includes("your-"));
}

function endpoint(path: string): string {
  return `${(API_BASE ?? "").replace(/\/+$/, "")}${path}`;
}

/** Convert and compress a captured image URI/blob into a clean base64 data string for instant server processing. */
export async function imageToBase64(uri: string): Promise<string> {
  const resized = await manipulateAsync(uri, [{ resize: { width: 720 } }], {
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  try {
    return await FileSystem.readAsStringAsync(resized.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } finally {
    await FileSystem.deleteAsync(resized.uri, { idempotent: true }).catch(() => {});
  }
}

function detailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return (detail[0] as { msg?: string })?.msg ?? "The server rejected the image.";
  }
  return "The server rejected the image.";
}

export function mapBiometricResponseError(
  status: number,
  detail: unknown,
): Extract<FaceOutcome, { ok: false }> {
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

function mapRequestError(error: unknown): Extract<FaceOutcome, { ok: false }> {
  const requestError = error as BiometricRequestError;
  if (requestError?.timedOut || requestError?.name === "AbortError") {
    return { ok: false, code: "request_timeout", message: MESSAGES.request_timeout };
  }
  if (typeof requestError?.status === "number") {
    return mapBiometricResponseError(requestError.status, requestError.detail);
  }
  return { ok: false, code: "network_error", message: MESSAGES.network_error };
}

function configuredError(): Extract<FaceOutcome, { ok: false }> {
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
type EnrollmentOutcome = Extract<FaceOutcome, { ok: false }> | { ok: true; vector: number[] };

export const biometricService = {
  async enroll(image?: string): Promise<EnrollmentOutcome> {
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
      if (!data.vector || data.vector.length !== 512 || !data.vector.every(Number.isFinite)) {
        return { ok: false, code: "network_error", message: MESSAGES.network_error };
      }
      return { ok: true, vector: data.vector };
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
    if (!storedVector || storedVector.length !== 512 || !storedVector.every(Number.isFinite)) {
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
      if (!Number.isFinite(score) || score < 0 || score > 1)
        return {
          ok: false,
          code: "validation_error",
          message: "The verification server returned an invalid face score.",
        };
      if (data.match === true && score >= 0.6) return { ok: true, score };
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
    if (!vector || vector.length !== 512 || !vector.every(Number.isFinite)) {
      return {
        ok: false,
        code: "duplicate_check_unavailable",
        message: "Face features were not available for the required duplicate-face check.",
      };
    }

    const threshold = 0.65;
    const supabase = getSupabase();

    // 1. Direct Supabase RPC check (works natively on mobile apps & web without server middleware)
    if (supabase) {
      try {
        const vectorLiteral = `[${vector.join(",")}]`;
        const { data, error } = await supabase.rpc("check_duplicate_face_public", {
          p_vector: vectorLiteral,
          p_threshold: threshold,
          p_exclude_id: excludeProfileId ?? null,
        });

        if (!error) {
          const row = (Array.isArray(data) ? data[0] : data) as
            { duplicate?: boolean; similarity?: number } | undefined;
          if (typeof row?.duplicate !== "boolean")
            throw new Error("Invalid duplicate-face response.");
          const duplicate = row.duplicate;
          const similarity = Number(row?.similarity ?? 0);

          if (duplicate) {
            return {
              ok: false,
              code: "duplicate",
              message: MESSAGES.duplicate,
              score: similarity,
            };
          }
          return { ok: true, score: similarity };
        }
        reportOperationalError("biometric", "Supabase RPC duplicate-face check", error);
      } catch (rpcErr) {
        reportOperationalError("biometric", "Supabase RPC duplicate-face check invocation", rpcErr);
      }
    }

    const duplicateController = new AbortController();
    const duplicateTimer = setTimeout(() => duplicateController.abort(), 15000);
    // 2. HTTP Endpoint Fallback (for environments with a deployed same-origin /api/face/check-duplicate)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (excludeProfileId && supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      }
      const res = await fetch(apiUrl("/api/face/check-duplicate"), {
        signal: duplicateController.signal,
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
    } finally {
      clearTimeout(duplicateTimer);
    }
  },
};
