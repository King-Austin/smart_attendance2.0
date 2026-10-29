import { describe, expect, it } from "vitest";
import {
  advanceLiveness,
  createLivenessState,
  evaluateFrameQuality,
  exponentialMovingAverage,
  median,
  type LivenessFrameResult,
  type LivenessState,
} from "./livenessStateMachine";

const validFrame = (
  timestampMs: number,
  overrides: Partial<LivenessFrameResult> = {},
): LivenessFrameResult => ({
  timestampMs,
  faceCount: 1,
  yawDegrees: 0,
  pitchDegrees: 0,
  blinkLeft: 0.05,
  blinkRight: 0.05,
  faceWidthRatio: 0.45,
  faceCenterOffsetRatio: 0.02,
  lightingStatus: "good",
  ...overrides,
});

function calibrate(direction: "left" | "right" = "left") {
  let state = createLivenessState(direction, 0);
  for (const timestampMs of [0, 200, 400, 600, 800, 1000]) {
    state = advanceLiveness(state, validFrame(timestampMs));
  }
  return state;
}

function sustainTurn(
  state: ReturnType<typeof createLivenessState>,
  direction: "left" | "right",
  startAt = 1100,
) {
  let next = state;
  const yawDegrees = direction === "left" ? -18 : 18;
  for (let timestampMs = startAt; timestampMs <= startAt + 1_500; timestampMs += 100) {
    next = advanceLiveness(next, validFrame(timestampMs, { yawDegrees }));
    if (next.phase !== `turn_${direction}`) break;
  }
  return next;
}

describe("liveness signal filtering", () => {
  it("uses the median to reject a single pose spike", () => {
    expect(median([1, 2, 80, 3, 4])).toBe(3);
  });

  it("applies the configured exponential moving average", () => {
    expect(exponentialMovingAverage(10, 20, 0.25)).toBe(12.5);
  });
});

describe("liveness quality gates", () => {
  it("rejects multiple faces immediately", () => {
    expect(evaluateFrameQuality(validFrame(0, { faceCount: 2 }))).toBe("FACE_MULTIPLE_FACES");
  });

  it("rejects off-centre and badly exposed captures", () => {
    expect(evaluateFrameQuality(validFrame(0, { faceCenterOffsetRatio: 0.2 }))).toBe(
      "FACE_POSITION",
    );
    expect(evaluateFrameQuality(validFrame(0, { lightingStatus: "too_bright" }))).toBe(
      "FACE_TOO_BRIGHT",
    );
  });
});

describe("liveness state machine", () => {
  it("calibrates from six stable samples over one second", () => {
    const state = calibrate("left");
    expect(state.phase).toBe("turn_left");
    expect(state.neutralYaw).toBeCloseTo(0);
    expect(state.neutralPitch).toBeCloseTo(0);
  });

  it("requires a sustained turn and does not oscillate at the threshold", () => {
    let state = calibrate("left");
    state = sustainTurn(state, "left");
    expect(state.phase).toBe("blink");
  });

  it("preserves dwell through a short no-face dropout", () => {
    let state: LivenessState = {
      ...calibrate("right"),
      filteredYaw: 18,
      yawHistory: [18, 18, 18, 18, 18],
      validSince: 1_700,
      lastFaceAt: 2_100,
    };
    state = advanceLiveness(state, validFrame(2_200, { faceCount: 0 }));
    state = advanceLiveness(state, validFrame(2_250, { yawDegrees: 18 }));
    expect(state.phase).toBe("blink");
  });

  it("resets dwell after a tracking gap longer than the grace window", () => {
    let state: LivenessState = {
      ...calibrate("right"),
      filteredYaw: 18,
      yawHistory: [18, 18, 18, 18, 18],
      validSince: 2_000,
      lastFaceAt: 2_100,
    };
    state = advanceLiveness(state, validFrame(2_500, { yawDegrees: 18 }));
    expect(state.phase).toBe("turn_right");
    expect(state.validSince).toBe(2_500);
  });

  it("recognizes a closed-and-reopened blink", () => {
    let state = calibrate("left");
    state = sustainTurn(state, "left");
    let now = state.phaseStartedAt + 100;
    for (; now <= state.phaseStartedAt + 600; now += 100) {
      state = advanceLiveness(state, validFrame(now, { blinkLeft: 0.8, blinkRight: 0.82 }));
    }
    for (; now <= state.phaseStartedAt + 1_300; now += 100) {
      state = advanceLiveness(state, validFrame(now, { blinkLeft: 0.05, blinkRight: 0.06 }));
      if (state.phase === "capture_lock") break;
    }
    expect(state.phase).toBe("capture_lock");
  });

  it("falls back to the opposite turn when blink detection times out", () => {
    let state = calibrate("left");
    state = sustainTurn(state, "left");
    state = advanceLiveness(state, validFrame(state.phaseStartedAt + 5_000));
    expect(state.phase).toBe("fallback_turn_right");
  });

  it("falls back when blendshape samples are absent during calibration", () => {
    let state = createLivenessState("left", 0);
    for (const timestampMs of [0, 200, 400, 600, 800, 1000]) {
      state = advanceLiveness(
        state,
        validFrame(timestampMs, { blinkLeft: null, blinkRight: null }),
      );
    }
    state = sustainTurn(state, "left");
    expect(state.phase).toBe("fallback_turn_right");
  });

  it("locks a centred face for 700ms and never regresses after completion", () => {
    let state = calibrate("left");
    state = { ...state, phase: "capture_lock", phaseStartedAt: 2000, validSince: null };
    for (let now = 2_000; now <= 2_700; now += 100) {
      state = advanceLiveness(state, validFrame(now));
    }
    expect(state.phase).toBe("complete");
    const completed = advanceLiveness(state, validFrame(3000, { faceCount: 2 }));
    expect(completed.phase).toBe("complete");
  });

  it("fails closed when one action exceeds twelve seconds", () => {
    let state = calibrate("left");
    state = advanceLiveness(state, validFrame(13_100));
    expect(state.phase).toBe("failed");
    expect(state.errorCode).toBe("FACE_TIMEOUT");
  });
});
