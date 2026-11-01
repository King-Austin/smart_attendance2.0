import { describe, expect, it } from "vitest";
import { evaluateGeofence, isFreshReading, type LocationReading } from "./locationPolicy";
const now = 1_800_000_000_000;
const anchor = { lat: 0, lng: 0, accuracy: 10 };
const fix = (metres: number, accuracy = 10): LocationReading => ({
  lat: metres / 111194.9266,
  lng: 0,
  accuracy,
  timestamp: now,
});

describe("attendance location policy", () => {
  it("accepts a fresh fix safely inside while retaining both uncertainty estimates", () => {
    expect(evaluateGeofence(anchor, fix(60), 100, now).decision).toBe("inside");
    expect(evaluateGeofence(anchor, fix(90), 100, now).decision).toBe("uncertain");
    expect(evaluateGeofence(anchor, fix(110), 100, now).decision).toBe("uncertain");
    expect(evaluateGeofence(anchor, fix(130), 100, now).decision).toBe("outside");
  });
  it("rejects stale, future, missing timestamp, invalid coordinates and imprecise fixes", () => {
    expect(isFreshReading({ ...fix(0), timestamp: now - 5001 }, now)).toBe(false);
    expect(isFreshReading({ ...fix(0), timestamp: now + 2001 }, now)).toBe(false);
    expect(isFreshReading({ ...fix(0), timestamp: undefined }, now)).toBe(false);
    expect(evaluateGeofence(anchor, fix(0, 25.01), 100, now).decision).toBe("poor_accuracy");
    expect(evaluateGeofence(anchor, { ...fix(0), lat: 91 }, 100, now).decision).toBe("invalid");
    expect(evaluateGeofence({ ...anchor, accuracy: 26 }, fix(0), 100, now).decision).toBe(
      "invalid",
    );
    expect(evaluateGeofence(anchor, fix(0), NaN, now).decision).toBe("invalid");
  });
});
