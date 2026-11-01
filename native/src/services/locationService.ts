import * as Location from "expo-location";
import { AppState } from "react-native";
import {
  evaluateGeofence,
  isFreshReading,
  validCoordinates,
  type LocationReading,
} from "./locationPolicy";
export type { LocationReading } from "./locationPolicy";
export type LocationOutcome =
  | { ok: true; reading: LocationReading; distance: number }
  | { ok: false; code: string; message: string; reading?: LocationReading; distance?: number };
type Options = {
  signal?: AbortSignal;
  onReading?: (reading: LocationReading) => void;
  onStep?: (message: string) => void;
};
export async function ensureLocationPermission() {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== "granted" && permission.canAskAgain)
    permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error("Allow location access in app settings to verify attendance.");
  if (permission.android?.accuracy === "coarse" || permission.ios?.accuracy === "reduced")
    throw new Error("Enable Precise location in app settings, then retry.");
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error("Device location is switched off. Turn on Location and retry.");
}
function readingOf(value: Location.LocationObject): LocationReading | null {
  const reading = {
    lat: value.coords.latitude,
    lng: value.coords.longitude,
    accuracy: value.coords.accuracy ?? Infinity,
    timestamp: value.timestamp,
  };
  return validCoordinates(reading) ? reading : null;
}
async function collect(
  accept: (reading: LocationReading) => boolean,
  { signal, onReading, onStep }: Options = {},
): Promise<LocationReading> {
  if (signal?.aborted || AppState.currentState !== "active")
    throw new Error("Location verification was interrupted. Retry with the app open.");
  await ensureLocationPermission();
  if (signal?.aborted) throw new Error("Location verification was cancelled.");
  return new Promise((resolve, reject) => {
    let done = false;
    let watch: Location.LocationSubscription | undefined;
    let lastTimestamp = 0;
    let samples = 0;
    const started = Date.now();
    let firstFix: number | null = null;
    const finish = (reading?: LocationReading, error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      watch?.remove();
      state.remove();
      signal?.removeEventListener("abort", cancel);
      if (__DEV__)
        console.info("[location]", {
          durationMs: Date.now() - started,
          firstFixMs: firstFix,
          samples,
          outcome: reading ? "ready" : "unavailable",
        });
      if (reading) resolve(reading);
      else reject(error ?? new Error("Location timed out. Keep the app open and retry."));
    };
    const cancel = () =>
      finish(
        undefined,
        new Error("Location verification was interrupted. Retry with the app open."),
      );
    const state = AppState.addEventListener("change", (value) => {
      if (value !== "active") cancel();
    });
    const timer = setTimeout(() => finish(), 30000);
    signal?.addEventListener("abort", cancel, { once: true });
    onStep?.("Finding your location…");
    const receive = (value: Location.LocationObject) => {
      if (done) return;
      const reading = readingOf(value);
      if (
        !reading ||
        !reading.timestamp ||
        reading.timestamp <= lastTimestamp ||
        reading.timestamp > Date.now() + 2000
      )
        return;
      lastTimestamp = reading.timestamp;
      samples++;
      firstFix ??= Date.now() - started;
      onReading?.(reading);
      if (!isFreshReading(reading)) {
        onStep?.("Location found. Waiting for a fresh reading…");
        return;
      }
      onStep?.(`Location found: estimated accuracy ±${Math.ceil(reading.accuracy)} m`);
      if (accept(reading)) finish(reading);
    };
    void Location.getLastKnownPositionAsync({ maxAge: 5000, requiredAccuracy: 25 })
      .then((value) => {
        if (value) receive(value);
      })
      .catch(() => {});
    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 2000,
        distanceInterval: 0,
        mayShowUserSettingsDialog: true,
      },
      receive,
      () =>
        finish(
          undefined,
          new Error(
            "The device location provider failed. Check device location settings and retry.",
          ),
        ),
    )
      .then((subscription) => {
        if (done) subscription.remove();
        else watch = subscription;
      })
      .catch(() =>
        finish(
          undefined,
          new Error(
            "Location could not start. Check Precise location permission and device settings.",
          ),
        ),
      );
  });
}
export const locationService = {
  async acquire(
    anchor: LocationReading,
    radius: number,
    options: Options = {},
  ): Promise<LocationOutcome> {
    let latest: LocationReading | undefined;
    let decision = "stale";
    let distance: number | undefined;
    if (!validCoordinates(anchor) || anchor.accuracy > 25)
      return {
        ok: false,
        code: "invalid_anchor",
        message: "The venue anchor is invalid. Ask the lecturer to recreate this session.",
      };
    try {
      const reading = await collect((candidate) => {
        latest = candidate;
        const evaluation = evaluateGeofence(anchor, candidate, radius);
        decision = evaluation.decision;
        distance = evaluation.distance;
        if (decision === "uncertain")
          options.onStep?.("Near the venue boundary. Refining your location…");
        return decision === "inside";
      }, options);
      return { ok: true, reading, distance: distance! };
    } catch (error) {
      const fresh = latest && isFreshReading(latest);
      const code = options.signal?.aborted ? "cancelled" : fresh ? decision : "unavailable";
      return {
        ok: false,
        code,
        message:
          code === "uncertain"
            ? "Your location is uncertain near the venue boundary. Move further inside and retry."
            : code === "outside"
              ? "Your location is outside the attendance area."
              : code === "poor_accuracy"
                ? "Location accuracy is too low. Try near a window or in an open area."
                : error instanceof Error
                  ? error.message
                  : "Location verification failed.",
        reading: latest,
        distance,
      };
    }
  },
  captureAnchor: (options: Options = {}) => collect((reading) => reading.accuracy <= 25, options),
};
