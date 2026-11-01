// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Position, WatchPositionCallback } from "@capacitor/geolocation";
const mocks = vi.hoisted(() => ({
  native: true,
  checkPermissions: vi.fn(),
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
  requestPermissions: vi.fn(),
  appListener: vi.fn(),
  removeListener: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => mocks.native } }));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: mocks }));
vi.mock("@capacitor/app", () => ({ App: { addListener: mocks.appListener } }));
import { locationService, mapLocationError } from "./locationService";

let callback: WatchPositionCallback;
const anchor = { lat: 0, lng: 0, accuracy: 5 };
const position = (metres = 0, accuracy = 10, timestamp = Date.now()): Position => ({
  timestamp,
  coords: {
    latitude: metres / 111194.9266,
    longitude: 0,
    accuracy,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    magneticHeading: null,
    trueHeading: null,
    headingAccuracy: null,
    course: null,
  },
});
async function startWatch() {
  // Dynamic plugin import and permission check run before native registration.
  await vi.waitFor(() => expect(mocks.watchPosition).toHaveBeenCalled());
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_800_000_000_000);
  vi.clearAllMocks();
  mocks.native = true;
  mocks.removeListener.mockResolvedValue(undefined);
  mocks.appListener.mockResolvedValue({ remove: mocks.removeListener });
  mocks.checkPermissions.mockResolvedValue({ location: "granted", coarseLocation: "granted" });
  mocks.getCurrentPosition.mockImplementation(() => new Promise(() => {}));
  mocks.watchPosition.mockImplementation((_options, listener) => {
    callback = listener;
    return Promise.resolve("watch-1");
  });
  mocks.clearWatch.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Capacitor attendance acquisition", () => {
  it("accepts one suitable fix immediately and explicitly configures Android cadence", async () => {
    const pending = locationService.acquire(anchor, 100);
    await startWatch();
    expect(mocks.watchPosition.mock.calls[0][0]).toMatchObject({
      interval: 2000,
      minimumUpdateInterval: 2000,
      maximumAge: 0,
    });
    callback(position(), undefined);
    await expect(pending).resolves.toMatchObject({ ok: true, reading: { accuracy: 10 } });
    expect(mocks.clearWatch).toHaveBeenCalledWith({ id: "watch-1" });
  });
  it("waits through a stale fix, repeated timestamp, and uncertain boundary, then accepts a newer fix", async () => {
    const previews = vi.fn();
    const pending = locationService.acquire(anchor, 100, undefined, undefined, {
      onReading: previews,
    });
    await startWatch();
    callback(position(0, 1, Date.now() - 6000), undefined);
    callback(position(95, 10), undefined);
    callback(position(0, 1), undefined); // Same timestamp: do not count twice or swap coordinates.
    expect(previews).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    callback(position(20, 12), undefined);
    await expect(pending).resolves.toMatchObject({ ok: true });
  });
  it("times out without requiring five callbacks", async () => {
    const pending = locationService.acquire(anchor, 100);
    await startWatch();
    await vi.advanceTimersByTimeAsync(30000);
    await expect(pending).resolves.toMatchObject({ ok: false, code: "timeout" });
    expect(mocks.clearWatch).toHaveBeenCalled();
  });
  it("returns an uncertain boundary result rather than accepting or immediately rejecting", async () => {
    const pending = locationService.acquire(anchor, 100);
    await startWatch();
    for (let i = 0; i < 15; i++) {
      callback(position(95), undefined);
      await vi.advanceTimersByTimeAsync(2000);
    }
    await expect(pending).resolves.toMatchObject({ ok: false, code: "boundary_uncertain" });
  });
  it("clears a watch ID that arrives after cancellation and ignores late positions", async () => {
    let register!: (id: string) => void;
    mocks.watchPosition.mockImplementation((_options, listener) => {
      callback = listener;
      return new Promise<string>((resolve) => {
        register = resolve;
      });
    });
    const controller = new AbortController();
    const preview = vi.fn();
    const pending = locationService.acquire(anchor, 100, undefined, undefined, {
      signal: controller.signal,
      onReading: preview,
    });
    await startWatch();
    controller.abort();
    await expect(pending).resolves.toMatchObject({ code: "cancelled" });
    register("late-id");
    await Promise.resolve();
    callback(position(), undefined);
    expect(mocks.clearWatch).toHaveBeenCalledWith({ id: "late-id" });
    expect(preview).not.toHaveBeenCalled();
  });
  it("stops native acquisition when the app backgrounds", async () => {
    const pending = locationService.acquire(anchor, 100);
    await startWatch();
    const onStateChange = mocks.appListener.mock.calls[0][1];
    onStateChange({ isActive: false });
    await expect(pending).resolves.toMatchObject({ code: "cancelled" });
    expect(mocks.clearWatch).toHaveBeenCalled();
    expect(mocks.removeListener).toHaveBeenCalled();
  });
  it("will not start an acquisition for an already aborted screen", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      locationService.acquire(anchor, 100, undefined, undefined, { signal: controller.signal }),
    ).resolves.toMatchObject({ code: "cancelled" });
    expect(mocks.watchPosition).not.toHaveBeenCalled();
  });
  it("does not prompt again for approximate permissions", async () => {
    mocks.checkPermissions.mockResolvedValue({ location: "denied", coarseLocation: "granted" });
    await expect(locationService.acquire(anchor, 100)).resolves.toMatchObject({
      code: "precise_location_required",
    });
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.watchPosition).not.toHaveBeenCalled();
  });
  it("preserves disabled-location error codes instead of reporting poor satellite signal", async () => {
    mocks.checkPermissions.mockRejectedValue({ code: "OS-PLUG-GLOC-0007" });
    await expect(locationService.acquire(anchor, 100)).resolves.toMatchObject({
      code: "location_disabled",
      nativeCode: "OS-PLUG-GLOC-0007",
    });
  });
  it("keeps fractional accuracy and timestamps on captured anchors", async () => {
    const pending = locationService.captureAnchor();
    await startWatch();
    callback(position(0, 24.9), undefined);
    await expect(pending).resolves.toMatchObject({ accuracy: 24.9, timestamp: Date.now() });
  });
  it("emits diagnostics without coordinates or identities", async () => {
    const diagnostic = vi.fn();
    window.addEventListener("scp:location-diagnostic", diagnostic);
    const pending = locationService.acquire(anchor, 100);
    await startWatch();
    callback(position(), undefined);
    await pending;
    const detail = diagnostic.mock.calls.at(-1)![0].detail;
    expect(detail).toMatchObject({ outcome: "ready", sampleCount: 1 });
    expect(detail).not.toHaveProperty("lat");
    expect(detail).not.toHaveProperty("lng");
    expect(detail).not.toHaveProperty("sessionId");
    window.removeEventListener("scp:location-diagnostic", diagnostic);
  });
  it("supports browser location and clears its watch after acceptance", async () => {
    mocks.native = false;
    let browserCallback!: PositionCallback;
    const clearWatch = vi.fn();
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn((listener: PositionCallback) => {
          browserCallback = listener;
          return 0;
        }),
        clearWatch,
      },
    });
    const pending = locationService.acquire(anchor, 100);
    browserCallback(position() as unknown as GeolocationPosition);
    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(clearWatch).toHaveBeenCalledWith(0);
    expect(mapLocationError({ code: 1 }, false).code).toBe("permission_denied");
  });
});
