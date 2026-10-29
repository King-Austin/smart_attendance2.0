export type LivenessDelegate = "GPU" | "CPU";

export type LivenessPhase =
  | "calibrate_center"
  | "turn_left"
  | "turn_right"
  | "blink"
  | "fallback_turn_left"
  | "fallback_turn_right"
  | "capture_lock"
  | "complete"
  | "failed";

export type LivenessErrorCode =
  | "FACE_MODEL_LOAD"
  | "FACE_MODEL_RUNTIME"
  | "FACE_CAMERA_PERMISSION"
  | "FACE_CAMERA_UNAVAILABLE"
  | "FACE_NO_FACE"
  | "FACE_MULTIPLE_FACES"
  | "FACE_TOO_DARK"
  | "FACE_TOO_BRIGHT"
  | "FACE_POSITION"
  | "FACE_TIMEOUT"
  | "FACE_CAPTURE"
  | "FACE_SERVER_UNAVAILABLE"
  | "FACE_MISMATCH"
  | "FACE_DUPLICATE";

export type LivenessRuntimeState = "idle" | "initializing" | "ready" | "failed";

export interface LivenessFrameResult {
  timestampMs: number;
  faceCount: number;
  yawDegrees: number;
  pitchDegrees: number;
  blinkLeft: number | null;
  blinkRight: number | null;
  faceWidthRatio: number;
  faceCenterOffsetRatio: number;
  lightingStatus: "too_dark" | "too_bright" | "good";
  runtimeError?: boolean;
  landmarks?: Array<{ x: number; y: number; z: number }>;
}

interface CalibrationSample {
  yaw: number;
  pitch: number;
  blinkLeft: number;
  blinkRight: number;
}

export interface LivenessState {
  phase: LivenessPhase;
  challengeDirection: "left" | "right";
  phaseStartedAt: number;
  challengeStartedAt: number;
  validSince: number | null;
  lastFaceAt: number | null;
  errorCode: LivenessErrorCode | null;
  guidanceCode: LivenessErrorCode | null;
  progressPercent: number;
  neutralYaw: number;
  neutralPitch: number;
  blinkBaseline: number;
  blinkReliable: boolean;
  blinkSamplesValid: boolean;
  blinkClosedAt: number | null;
  calibrationSamples: CalibrationSample[];
  yawHistory: number[];
  pitchHistory: number[];
  blinkLeftHistory: number[];
  blinkRightHistory: number[];
  filteredYaw: number;
  filteredPitch: number;
  filteredBlinkLeft: number;
  filteredBlinkRight: number;
}

const FILTER_WINDOW = 5;
const EMA_ALPHA = 0.25;
const CALIBRATION_DURATION_MS = 1_000;
const CALIBRATION_SAMPLE_COUNT = 6;
const TURN_HOLD_MS = 500;
const CAPTURE_HOLD_MS = 700;
const NO_FACE_GRACE_MS = 250;
const BLINK_CLOSE_WINDOW_MS = 800;
const BLINK_ATTEMPT_MS = 5_000;
const PHASE_TIMEOUT_MS = 12_000;
const CHALLENGE_TIMEOUT_MS = 30_000;

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function exponentialMovingAverage(
  previous: number,
  current: number,
  alpha = EMA_ALPHA,
): number {
  return previous + alpha * (current - previous);
}

function appendWindow(values: number[], value: number): number[] {
  return [...values, value].slice(-FILTER_WINDOW);
}

function finite(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function variance(values: number[]): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

export function evaluateFrameQuality(frame: LivenessFrameResult): LivenessErrorCode | null {
  if (frame.runtimeError) return "FACE_MODEL_RUNTIME";
  if (frame.faceCount === 0) return "FACE_NO_FACE";
  if (frame.faceCount > 1) return "FACE_MULTIPLE_FACES";
  if (frame.lightingStatus === "too_dark") return "FACE_TOO_DARK";
  if (frame.lightingStatus === "too_bright") return "FACE_TOO_BRIGHT";
  if (
    !Number.isFinite(frame.yawDegrees) ||
    !Number.isFinite(frame.pitchDegrees) ||
    !Number.isFinite(frame.faceWidthRatio) ||
    !Number.isFinite(frame.faceCenterOffsetRatio) ||
    frame.faceWidthRatio < 0.25 ||
    frame.faceWidthRatio > 0.75 ||
    frame.faceCenterOffsetRatio > 0.15
  ) {
    return "FACE_POSITION";
  }
  return null;
}

export function createLivenessState(
  challengeDirection: "left" | "right",
  startedAt = performance.now(),
): LivenessState {
  return {
    phase: "calibrate_center",
    challengeDirection,
    phaseStartedAt: startedAt,
    challengeStartedAt: startedAt,
    validSince: null,
    lastFaceAt: null,
    errorCode: null,
    guidanceCode: null,
    progressPercent: 0,
    neutralYaw: 0,
    neutralPitch: 0,
    blinkBaseline: 0,
    blinkReliable: false,
    blinkSamplesValid: true,
    blinkClosedAt: null,
    calibrationSamples: [],
    yawHistory: [],
    pitchHistory: [],
    blinkLeftHistory: [],
    blinkRightHistory: [],
    filteredYaw: 0,
    filteredPitch: 0,
    filteredBlinkLeft: 0,
    filteredBlinkRight: 0,
  };
}

function transition(state: LivenessState, phase: LivenessPhase, now: number): LivenessState {
  return {
    ...state,
    phase,
    phaseStartedAt: now,
    validSince: null,
    blinkClosedAt: null,
    guidanceCode: null,
    progressPercent: phase === "complete" ? 100 : 0,
  };
}

function fail(state: LivenessState, code: LivenessErrorCode): LivenessState {
  return {
    ...state,
    phase: "failed",
    errorCode: code,
    guidanceCode: code,
    validSince: null,
    progressPercent: 0,
  };
}

function oppositeTurnPhase(direction: "left" | "right"): LivenessPhase {
  return direction === "left" ? "fallback_turn_right" : "fallback_turn_left";
}

function filterFrame(state: LivenessState, frame: LivenessFrameResult): LivenessState {
  const hasValidBlinkSamples = finite(frame.blinkLeft) && finite(frame.blinkRight);
  const yawHistory = appendWindow(state.yawHistory, frame.yawDegrees);
  const pitchHistory = appendWindow(state.pitchHistory, frame.pitchDegrees);
  const blinkLeftHistory = finite(frame.blinkLeft)
    ? appendWindow(state.blinkLeftHistory, frame.blinkLeft)
    : state.blinkLeftHistory;
  const blinkRightHistory = finite(frame.blinkRight)
    ? appendWindow(state.blinkRightHistory, frame.blinkRight)
    : state.blinkRightHistory;

  const hasPrevious = state.yawHistory.length > 0;
  const yawMedian = median(yawHistory);
  const pitchMedian = median(pitchHistory);
  const leftMedian = median(blinkLeftHistory);
  const rightMedian = median(blinkRightHistory);

  return {
    ...state,
    yawHistory,
    pitchHistory,
    blinkLeftHistory,
    blinkRightHistory,
    blinkSamplesValid: state.blinkSamplesValid && hasValidBlinkSamples,
    filteredYaw: hasPrevious ? exponentialMovingAverage(state.filteredYaw, yawMedian) : yawMedian,
    filteredPitch: hasPrevious
      ? exponentialMovingAverage(state.filteredPitch, pitchMedian)
      : pitchMedian,
    filteredBlinkLeft:
      state.blinkLeftHistory.length > 0
        ? exponentialMovingAverage(state.filteredBlinkLeft, leftMedian)
        : leftMedian,
    filteredBlinkRight:
      state.blinkRightHistory.length > 0
        ? exponentialMovingAverage(state.filteredBlinkRight, rightMedian)
        : rightMedian,
  };
}

function advanceTurn(
  state: LivenessState,
  frame: LivenessFrameResult,
  direction: "left" | "right",
  nextPhase: LivenessPhase,
): LivenessState {
  const relativeYaw = state.filteredYaw - state.neutralYaw;
  const magnitude = direction === "left" ? -relativeYaw : relativeYaw;
  const threshold = state.validSince === null ? 15 : 10;

  if (magnitude < threshold) {
    return { ...state, validSince: null, progressPercent: Math.max(0, (magnitude / 15) * 100) };
  }

  const validSince = state.validSince ?? frame.timestampMs;
  const heldFor = frame.timestampMs - validSince;
  if (heldFor >= TURN_HOLD_MS) return transition(state, nextPhase, frame.timestampMs);
  return {
    ...state,
    validSince,
    progressPercent: Math.min(99, (heldFor / TURN_HOLD_MS) * 100),
  };
}

export function advanceLiveness(
  currentState: LivenessState,
  frame: LivenessFrameResult,
): LivenessState {
  if (currentState.phase === "complete" || currentState.phase === "failed") return currentState;

  if (
    frame.timestampMs - currentState.challengeStartedAt > CHALLENGE_TIMEOUT_MS ||
    frame.timestampMs - currentState.phaseStartedAt > PHASE_TIMEOUT_MS
  ) {
    return fail(currentState, "FACE_TIMEOUT");
  }

  const qualityError = evaluateFrameQuality(frame);
  if (qualityError) {
    if (
      qualityError === "FACE_NO_FACE" &&
      currentState.lastFaceAt !== null &&
      frame.timestampMs - currentState.lastFaceAt <= NO_FACE_GRACE_MS
    ) {
      return currentState;
    }
    if (qualityError === "FACE_MODEL_RUNTIME") return fail(currentState, qualityError);
    return {
      ...currentState,
      validSince: null,
      blinkClosedAt: null,
      guidanceCode: qualityError,
      progressPercent: 0,
    };
  }

  const exceededDropoutGrace =
    currentState.lastFaceAt !== null &&
    frame.timestampMs - currentState.lastFaceAt > NO_FACE_GRACE_MS;
  let state = filterFrame(
    {
      ...currentState,
      lastFaceAt: frame.timestampMs,
      guidanceCode: null,
      validSince: exceededDropoutGrace ? null : currentState.validSince,
      blinkClosedAt: exceededDropoutGrace ? null : currentState.blinkClosedAt,
    },
    frame,
  );

  if (state.phase === "calibrate_center") {
    const calibrationSamples = [
      ...state.calibrationSamples,
      {
        yaw: state.filteredYaw,
        pitch: state.filteredPitch,
        blinkLeft: state.filteredBlinkLeft,
        blinkRight: state.filteredBlinkRight,
      },
    ];
    state = {
      ...state,
      calibrationSamples,
      progressPercent: Math.min(
        99,
        Math.min(
          calibrationSamples.length / CALIBRATION_SAMPLE_COUNT,
          (frame.timestampMs - state.phaseStartedAt) / CALIBRATION_DURATION_MS,
        ) * 100,
      ),
    };

    if (
      calibrationSamples.length >= CALIBRATION_SAMPLE_COUNT &&
      frame.timestampMs - state.phaseStartedAt >= CALIBRATION_DURATION_MS
    ) {
      const leftValues = calibrationSamples.map((sample) => sample.blinkLeft);
      const rightValues = calibrationSamples.map((sample) => sample.blinkRight);
      const blinkBaseline = Math.max(median(leftValues), median(rightValues));
      const blinkReliable =
        state.blinkSamplesValid &&
        leftValues.every(Number.isFinite) &&
        rightValues.every(Number.isFinite) &&
        blinkBaseline <= 0.35 &&
        variance(leftValues) <= 0.02 &&
        variance(rightValues) <= 0.02;
      return transition(
        {
          ...state,
          neutralYaw: median(calibrationSamples.map((sample) => sample.yaw)),
          neutralPitch: median(calibrationSamples.map((sample) => sample.pitch)),
          blinkBaseline,
          blinkReliable,
        },
        state.challengeDirection === "left" ? "turn_left" : "turn_right",
        frame.timestampMs,
      );
    }
    return state;
  }

  if (state.phase === "turn_left" || state.phase === "turn_right") {
    const direction = state.phase === "turn_left" ? "left" : "right";
    const nextPhase = state.blinkReliable ? "blink" : oppositeTurnPhase(state.challengeDirection);
    return advanceTurn(state, frame, direction, nextPhase);
  }

  if (state.phase === "blink") {
    if (!state.blinkReliable || frame.timestampMs - state.phaseStartedAt >= BLINK_ATTEMPT_MS) {
      return transition(state, oppositeTurnPhase(state.challengeDirection), frame.timestampMs);
    }

    const closeThreshold = Math.max(0.55, state.blinkBaseline + 0.35);
    const eyesClosed =
      state.filteredBlinkLeft >= closeThreshold && state.filteredBlinkRight >= closeThreshold;
    if (eyesClosed && state.blinkClosedAt === null) {
      return { ...state, blinkClosedAt: frame.timestampMs, progressPercent: 60 };
    }
    if (state.blinkClosedAt !== null) {
      const elapsed = frame.timestampMs - state.blinkClosedAt;
      const eyesOpen = state.filteredBlinkLeft < 0.25 && state.filteredBlinkRight < 0.25;
      if (eyesOpen && elapsed <= BLINK_CLOSE_WINDOW_MS) {
        return transition(state, "capture_lock", frame.timestampMs);
      }
      if (elapsed > BLINK_CLOSE_WINDOW_MS) {
        return { ...state, blinkClosedAt: null, progressPercent: 0 };
      }
    }
    return state;
  }

  if (state.phase === "fallback_turn_left" || state.phase === "fallback_turn_right") {
    return advanceTurn(
      state,
      frame,
      state.phase === "fallback_turn_left" ? "left" : "right",
      "capture_lock",
    );
  }

  if (state.phase === "capture_lock") {
    const relativeYaw = Math.abs(state.filteredYaw - state.neutralYaw);
    const relativePitch = Math.abs(state.filteredPitch - state.neutralPitch);
    const yawLimit = state.validSince === null ? 8 : 12;
    const pitchLimit = state.validSince === null ? 10 : 12;
    if (relativeYaw > yawLimit || relativePitch > pitchLimit) {
      return { ...state, validSince: null, progressPercent: 0 };
    }
    const validSince = state.validSince ?? frame.timestampMs;
    const heldFor = frame.timestampMs - validSince;
    if (heldFor >= CAPTURE_HOLD_MS) return transition(state, "complete", frame.timestampMs);
    return {
      ...state,
      validSince,
      progressPercent: Math.min(99, (heldFor / CAPTURE_HOLD_MS) * 100),
    };
  }

  return state;
}
