import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateGeofence, isFreshReading, distanceMetres } from "../src/services/locationPolicy";
import {
  advanceLiveness,
  createLivenessState,
  evaluateFrameQuality,
  type LivenessFrameResult,
} from "../src/services/livenessStateMachine";
import { attendanceCsv, csvCell, escapeHtml } from "../src/lib/exportFormat";
const now = 1_800_000_000_000;
const anchor = { lat: 0, lng: 0, accuracy: 10 };
const fix = (metres: number, accuracy = 10, timestamp = now) => ({
  lat: metres / 111194.9266,
  lng: 0,
  accuracy,
  timestamp,
});
describe("native venue policy", () => {
  it("accepts only a fresh reading comfortably inside the boundary", () => {
    assert.equal(evaluateGeofence(anchor, fix(50), 100, now).decision, "inside");
    assert.equal(evaluateGeofence(anchor, fix(95), 100, now).decision, "uncertain");
    assert.equal(evaluateGeofence(anchor, fix(110), 100, now).decision, "uncertain");
    assert.equal(evaluateGeofence(anchor, fix(140), 100, now).decision, "outside");
  });
  it("rejects stale, future, imprecise and invalid readings", () => {
    assert.equal(isFreshReading(fix(0, 1, now - 5001), now), false);
    assert.equal(isFreshReading(fix(0, 1, now + 2001), now), false);
    assert.equal(evaluateGeofence(anchor, fix(0, 25.001), 100, now).decision, "poor_accuracy");
    assert.equal(evaluateGeofence(anchor, { ...fix(0), lat: 91 }, 100, now).decision, "invalid");
    assert.equal(
      evaluateGeofence({ ...anchor, accuracy: 50 }, fix(0), 100, now).decision,
      "invalid",
    );
  });
  it("does not round an outside coordinate into the permitted radius", () => {
    assert.ok(distanceMetres(anchor, fix(100.4)) > 100);
    assert.equal(
      evaluateGeofence({ ...anchor, accuracy: 0 }, fix(100.4, 0), 100, now).decision,
      "outside",
    );
  });
});
const frame = (
  time: number,
  overrides: Partial<LivenessFrameResult> = {},
): LivenessFrameResult => ({
  timestampMs: time,
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
  for (const time of [0, 200, 400, 600, 800, 1000]) state = advanceLiveness(state, frame(time));
  return state;
}
describe("native camera liveness contract", () => {
  it("requires a stable one-second calibration before the turn challenge", () => {
    assert.equal(calibrate().phase, "turn_left");
    let state = createLivenessState("right", 0);
    state = advanceLiveness(state, frame(0));
    assert.equal(state.phase, "calibrate_center");
  });
  it("rejects multiple faces, off-center frames, poor exposure and native runtime errors", () => {
    assert.equal(evaluateFrameQuality(frame(0, { faceCount: 2 })), "FACE_MULTIPLE_FACES");
    assert.equal(evaluateFrameQuality(frame(0, { faceCenterOffsetRatio: 0.3 })), "FACE_POSITION");
    assert.equal(evaluateFrameQuality(frame(0, { lightingStatus: "too_dark" })), "FACE_TOO_DARK");
    assert.equal(evaluateFrameQuality(frame(0, { runtimeError: true })), "FACE_MODEL_RUNTIME");
  });
  it("requires a sustained directional movement rather than one pose spike", () => {
    let state = calibrate();
    state = advanceLiveness(state, frame(1100, { yawDegrees: -30 }));
    assert.equal(state.phase, "turn_left");
    for (let time = 1200; time <= 3000 && state.phase === "turn_left"; time += 100)
      state = advanceLiveness(state, frame(time, { yawDegrees: -18 }));
    assert.equal(state.phase, "blink");
  });
  it("fails closed when the challenge expires", () => {
    const state = advanceLiveness(calibrate(), frame(13100));
    assert.equal(state.phase, "failed");
    assert.equal(state.errorCode, "FACE_TIMEOUT");
  });
  it("requires a centered capture hold before completing", () => {
    let state = {
      ...calibrate(),
      phase: "capture_lock" as const,
      phaseStartedAt: 2000,
      validSince: null,
    };
    for (let time = 2000; time <= 2700; time += 100)
      state = advanceLiveness(state, frame(time)) as typeof state;
    assert.equal(state.phase, "complete");
  });
});
describe("native report safety", () => {
  it("escapes arbitrary student names before PDF HTML interpolation", () => {
    assert.equal(
      escapeHtml('<img src=x onerror="bad">'),
      "&lt;img src=x onerror=&quot;bad&quot;&gt;",
    );
  });
  it("prevents spreadsheet formulas and quotes CSV fields correctly", () => {
    assert.equal(csvCell("=1+1"), '"\'=1+1"');
    assert.equal(csvCell('Doe, "Jane"'), '"Doe, ""Jane"""');
  });
  it("exports actual records and explicit statuses", () => {
    const csv = attendanceCsv([
      {
        id: "1",
        studentId: "2",
        name: "Student",
        regNumber: "REG-1",
        status: "missed",
        faceScore: null,
        distance: null,
        gpsAccuracy: null,
        verifiedAt: null,
      },
    ]);
    assert.match(csv, /"REG-1","Student","missed",""/);
  });
});

import { splitSecureValue } from "../src/lib/secureChunks";
describe("secure session encoding", () => {
  it("round-trips Unicode and keeps native secure-storage chunks below 2 KiB", () => {
    const original = '{"name":"' + "😀漢字".repeat(900) + '","token":"session"}';
    const chunks = splitSecureValue(original);
    assert.equal(chunks.join(""), original);
    for (const chunk of chunks) assert.ok(Buffer.byteLength(chunk, "utf8") <= 2000);
  });
});
