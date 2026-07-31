import { delay, demoScenarios } from "./demoScenarios";

export type FaceOutcome =
  | { ok: true; score: number }
  | {
      ok: false;
      code: "mismatch" | "no_face" | "multiple_faces" | "poor_lighting" | "duplicate" | "network_error";
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
  duplicate: "This face is already enrolled under a different account. Contact the department office.",
  network_error: "Network error. The verification server could not be reached.",
};

/**
 * Simulated biometric service. Facial embeddings never reach the client and the
 * client never decides the match result.
 */
export const biometricService = {
  async verify(): Promise<FaceOutcome> {
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

  async enroll(): Promise<FaceOutcome> {
    await delay(2000);
    const scenario = demoScenarios.get().face;
    if (scenario === "auto" || scenario === "verified") {
      return { ok: true, score: 0.97 };
    }
    if (scenario === "mismatch") {
      return { ok: true, score: 0.95 };
    }
    return { ok: false, code: scenario, message: MESSAGES[scenario] };
  },
};
