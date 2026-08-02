import { delay, demoScenarios } from "./demoScenarios";
import { isSupabaseConfigured } from "@/lib/supabase";

export type FaceOutcome =
  | { ok: true; score: number; vector?: number[] }
  | {
      ok: false;
      code:
        "mismatch" | "no_face" | "multiple_faces" | "poor_lighting" | "duplicate" | "network_error";
      message: string;
      score?: number;
    };

const MESSAGES: Record<string, string> = {
  mismatch:
    "Face did not match the enrolled record for this account. The server rejected the verification.",
  no_face: "No face was detected in the captured image. Position your face inside the frame.",
  multiple_faces:
    "More than one face was detected. Ensure only you are visible in the frame and capture again.",
  poor_lighting: "The image was too dark to process. Move to a brighter area and capture again.",
  duplicate:
    "This face is already enrolled under a different account. Contact the department office.",
  network_error: "Network error. The verification server could not be reached.",
};

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

/** Convert a captured image URI/blob into a base64 data string for the server. */
export async function imageToBase64(uri: string): Promise<string> {
  if (!uri) return "";
  const res = await fetch(uri);
  const blob = await res.blob();
  return await blobToBase64(blob);
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

function mapServerError(detail: unknown): FaceOutcome {
  const message = detailMessage(detail);
  if (/no face/i.test(message)) {
    return { ok: false, code: "no_face", message: MESSAGES.no_face };
  }
  return {
    ok: false,
    code: "network_error",
    message: `${message} (${MESSAGES.network_error})`,
  };
}

async function post(path: string, payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(endpoint(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { detail?: unknown } & Record<
    string,
    unknown
  >;
  if (!res.ok) {
    const err = new Error(detailMessage(data.detail));
    (err as Error & { detail?: unknown }).detail = data.detail;
    throw err;
  }
  return data;
}

/**
 * Biometric service backed by the InsightFace enrollment/verification server.
 * When no real server is configured (placeholder URL) it falls back to the
 * simulated implementation so the demo keeps working. Embeddings are computed
 * and compared server-side; the client only sends the image.
 */
export const biometricService = {
  /**
   * Enroll a face. `image` is a base64-encoded JPEG/PNG (without the data: prefix).
   * Resolves with the 512-dimension embedding on success.
   */
  async enroll(image?: string): Promise<FaceOutcome> {
    if (isBiometricConfigured() && image) {
      try {
        const data = (await post("/enroll", { image })) as { vector?: number[] };
        if (!data.vector)
          return { ok: false, code: "network_error", message: MESSAGES.network_error };
        return { ok: true, score: 0.97, vector: data.vector };
      } catch (err) {
        return mapServerError((err as Error & { detail?: unknown }).detail);
      }
    }

    await delay(2100);
    const scenario = demoScenarios.get().face;
    if (scenario === "auto" || scenario === "verified") {
      return { ok: true, score: 0.97 };
    }
    if (scenario === "mismatch") {
      return { ok: true, score: 0.95 };
    }
    return { ok: false, code: scenario, message: MESSAGES[scenario] };
  },

  /**
   * Verify a face against a previously enrolled embedding. `image` is base64;
   * `storedVector` is the embedding returned by `enroll`.
   */
  async verify(image?: string, storedVector?: number[]): Promise<FaceOutcome> {
    if (isBiometricConfigured() && image && storedVector && storedVector.length > 0) {
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
        return mapServerError((err as Error & { detail?: unknown }).detail);
      }
    }

    await delay(2100);
    const scenario = demoScenarios.get().face;
    if (scenario === "auto" || scenario === "verified") {
      return { ok: true, score: 0.93 };
    }
    if (scenario === "mismatch") {
      return { ok: false, code: "mismatch", message: MESSAGES.mismatch, score: 0.42 };
    }
    return { ok: false, code: scenario, message: MESSAGES[scenario] };
  },

  /**
   * Check whether a freshly-enrolled face vector already belongs to another
   * account. When Supabase is configured the request is handled server-side
   * (vectors never reach the browser); otherwise the demo scenario is used.
   */
  async checkDuplicate(vector?: number[]): Promise<FaceOutcome> {
    if (isSupabaseConfigured() && vector && vector.length > 0) {
      try {
        const res = await fetch(DUPLICATE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vector }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          duplicate?: boolean;
          similarity?: number;
          error?: string;
        };
        if (!res.ok) {
          if (res.status === 503) {
            return { ok: true, score: 0 };
          }
          const message = data.error ?? "The duplicate check failed.";
          return { ok: false, code: "network_error", message };
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
      } catch {
        return { ok: false, code: "network_error", message: MESSAGES.network_error };
      }
    }

    await delay(900);
    const scenario = demoScenarios.get().face;
    if (scenario === "duplicate") {
      return { ok: false, code: "duplicate", message: MESSAGES.duplicate, score: 0.98 };
    }
    return { ok: true, score: 0 };
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
 * Simulated liveness challenge result. The server decides whether the sequence
 * of head movements came from a live person.
 */
export const livenessService = {
  async evaluate(): Promise<LivenessOutcome> {
    await delay(900);
    const scenario = demoScenarios.get().liveness;
    if (scenario === "auto" || scenario === "passed") return { ok: true };
    return { ok: false, code: scenario, message: LIVENESS_MESSAGES[scenario] };
  },
};
