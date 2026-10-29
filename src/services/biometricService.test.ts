import { afterEach, describe, expect, it, vi } from "vitest";
import { mapBiometricResponseError } from "./biometricService";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("biometric response error mapping", () => {
  it("maps validation face conditions without exposing provider details", () => {
    expect(mapBiometricResponseError(422, "No face found in supplied image")).toMatchObject({
      ok: false,
      code: "no_face",
    });
    expect(mapBiometricResponseError(422, "Multiple faces found")).toMatchObject({
      ok: false,
      code: "multiple_faces",
    });
    const generic = mapBiometricResponseError(422, "internal validation rule 91 failed");
    expect(generic).toMatchObject({ ok: false, code: "validation_error" });
    if (!generic.ok) expect(generic.message).not.toContain("rule 91");
  });

  it("maps server failures to the retryable service message", () => {
    const result = mapBiometricResponseError(503, "upstream traceback");
    expect(result).toMatchObject({ ok: false, code: "server_error" });
    if (!result.ok) {
      expect(result.message).toContain("Nothing was enrolled or recorded");
      expect(result.message).not.toContain("traceback");
    }
  });

  it("aborts InsightFace requests after fifteen seconds", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_BIOMETRIC_API_URL", "https://biometric.test");
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }),
    );
    vi.resetModules();
    const { biometricService } = await import("./biometricService");
    const request = biometricService.enroll("encoded-image");
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(request).resolves.toMatchObject({ ok: false, code: "request_timeout" });
  });
});
