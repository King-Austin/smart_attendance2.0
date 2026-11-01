import { Capacitor } from "@capacitor/core";
import type { Position } from "@capacitor/geolocation";
import { reportOperationalError } from "@/lib/operationalError";
import {
  evaluateGeofence,
  isFreshReading,
  validCoordinates,
  type LocationReading,
} from "./locationPolicy";
export type { LocationReading } from "./locationPolicy";

export type LocationFailureCode =
  | "poor_accuracy"
  | "outside_radius"
  | "boundary_uncertain"
  | "permission_denied"
  | "precise_location_required"
  | "location_disabled"
  | "timeout"
  | "provider_error"
  | "unavailable"
  | "cancelled"
  | "invalid_anchor";
export type LocationOutcome =
  | { ok: true; reading: LocationReading; distance: number }
  | {
      ok: false;
      code: LocationFailureCode;
      message: string;
      reading?: LocationReading;
      distance?: number;
      nativeCode?: string;
    };
export type StepKind = "info" | "ok" | "fail";
export type StepListener = (text: string, kind?: StepKind) => void;
export interface AcquisitionOptions {
  signal?: AbortSignal;
  /** Preview only; callers must use acquire's final outcome for attendance. */
  onReading?: (reading: LocationReading) => void;
}

function accuracyLimit(value: unknown): number {
  const configured = Number(value);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 25) : 25;
}
const STUDENT_ACCURACY = accuracyLimit(import.meta.env.VITE_MAX_GPS_ACCURACY_THRESHOLD);
const ANCHOR_ACCURACY = accuracyLimit(import.meta.env.VITE_MAX_ANCHOR_ACCURACY);
const configuredDeadline = Number(import.meta.env.VITE_GPS_ACQUISITION_TIMEOUT_MS);
const ACQUISITION_TIMEOUT_MS =
  Number.isFinite(configuredDeadline) && configuredDeadline > 0
    ? Math.min(60000, Math.max(10000, configuredDeadline))
    : 30000;
const UPDATE_INTERVAL_MS = 2000;

const messages: Record<LocationFailureCode, string> = {
  poor_accuracy: "Location accuracy is too low. Try near a window or in an open area, then retry.",
  outside_radius: "Your location is outside this session's attendance area.",
  boundary_uncertain:
    "Your location is too close to the attendance boundary to verify reliably. Move further inside the venue and retry.",
  permission_denied: "Location permission was denied. Allow location access in app settings.",
  precise_location_required:
    "Only approximate location is allowed. Enable Precise location in app settings.",
  location_disabled:
    "Device location is switched off. Turn on Location in device settings and retry.",
  timeout: "A fresh location could not be obtained in time. Keep the app open and retry.",
  provider_error:
    "The device location provider is unavailable. Check Google Play services and device location settings, then retry.",
  unavailable: "Location is unavailable on this device. Check location settings and retry.",
  cancelled: "Location verification was cancelled.",
  invalid_anchor:
    "This session has an invalid or imprecise venue anchor. Ask the lecturer to recreate it.",
};

export class LocationAcquisitionError extends Error {
  constructor(
    public code: LocationFailureCode,
    public nativeCode?: string,
  ) {
    super(messages[code]);
    this.name = "LocationAcquisitionError";
  }
}

export function mapLocationError(
  error: unknown,
  native = Capacitor.isNativePlatform(),
): LocationAcquisitionError {
  if (error instanceof LocationAcquisitionError) return error;
  const code = String((error as { code?: unknown } | null)?.code ?? "");
  const mapped: Record<string, LocationFailureCode> = native
    ? {
        "OS-PLUG-GLOC-0003": "permission_denied",
        "OS-PLUG-GLOC-0007": "location_disabled",
        "OS-PLUG-GLOC-0008": "permission_denied",
        "OS-PLUG-GLOC-0009": "location_disabled",
        "OS-PLUG-GLOC-0010": "timeout",
        "OS-PLUG-GLOC-0014": "provider_error",
        "OS-PLUG-GLOC-0015": "provider_error",
        "OS-PLUG-GLOC-0016": "provider_error",
        "OS-PLUG-GLOC-0017": "location_disabled",
        "OS-PLUG-GLOC-0018": "provider_error",
      }
    : { "1": "permission_denied", "2": "unavailable", "3": "timeout" };
  return new LocationAcquisitionError(mapped[code] ?? "unavailable", code || undefined);
}

/** No coordinates, user IDs, or raw provider error payloads in diagnostic events. */
function diagnostic(detail: Record<string, string | number | boolean | null>) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("scp:location-diagnostic", { detail }));
  }
}

function toReading(position: Position | GeolocationPosition): LocationReading {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };
}

async function collectLocation(
  accept: (reading: LocationReading) => boolean,
  onStep?: StepListener,
  options: AcquisitionOptions = {},
): Promise<LocationReading> {
  const startedAt = Date.now();
  const native = Capacitor.isNativePlatform();
  const { signal, onReading } = options;
  if (
    signal?.aborted ||
    (typeof document !== "undefined" && document.visibilityState === "hidden")
  ) {
    throw new LocationAcquisitionError("cancelled");
  }
  onStep?.("Finding your location…");

  return new Promise<LocationReading>((resolve, reject) => {
    let done = false;
    let stopWatch: (() => void) | undefined;
    let stopLifecycle: (() => void) | undefined;
    let lastError: LocationAcquisitionError | undefined;
    let latest: LocationReading | undefined;
    const seen = new Set<number>();
    let firstFixMs: number | null = null;

    const finish = (reading?: LocationReading, error?: LocationAcquisitionError) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      if (typeof document !== "undefined")
        document.removeEventListener("visibilitychange", onVisibility);
      stopWatch?.();
      stopLifecycle?.();
      diagnostic({
        phase: "complete",
        platform: native ? "native" : "web",
        durationMs: Date.now() - startedAt,
        firstFixMs,
        sampleCount: seen.size,
        accuracy: reading?.accuracy ?? latest?.accuracy ?? null,
        ageMs: latest?.timestamp ? Date.now() - latest.timestamp : null,
        outcome: reading ? "ready" : (error?.code ?? "timeout"),
        nativeCode: error?.nativeCode ?? null,
      });
      if (reading) resolve(reading);
      else reject(error ?? new LocationAcquisitionError("timeout"));
    };
    const cancel = () => finish(undefined, new LocationAcquisitionError("cancelled"));
    const onVisibility = () => {
      if (document.visibilityState === "hidden") cancel();
    };
    const timer = setTimeout(() => finish(undefined, lastError), ACQUISITION_TIMEOUT_MS);
    signal?.addEventListener("abort", cancel, { once: true });
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", onVisibility);

    const receive = (position: Position | GeolocationPosition) => {
      if (done || !position?.coords) return;
      const reading = toReading(position);
      if (
        !validCoordinates(reading) ||
        !Number.isFinite(reading.timestamp) ||
        reading.timestamp! > Date.now() + 2000 ||
        seen.has(reading.timestamp!)
      )
        return;
      // Callback time is not evidence of freshness. Do not let an older fix replace a newer one.
      if (latest?.timestamp && reading.timestamp! < latest.timestamp) return;
      seen.add(reading.timestamp!);
      latest = reading;
      firstFixMs ??= Date.now() - startedAt;
      onReading?.(reading);
      if (!isFreshReading(reading)) {
        onStep?.("Location found. Waiting for a fresh reading…");
        return;
      }
      onStep?.(
        `Location found: estimated accuracy ±${Math.ceil(reading.accuracy)} m. Checking venue…`,
      );
      if (accept(reading)) finish(reading);
    };
    const fail = (error: unknown) => {
      if (done) return;
      lastError = mapLocationError(error, native);
      diagnostic({
        phase: "provider-error",
        code: lastError.code,
        nativeCode: lastError.nativeCode ?? null,
      });
      if (
        [
          "permission_denied",
          "precise_location_required",
          "location_disabled",
          "provider_error",
        ].includes(lastError.code)
      ) {
        finish(undefined, lastError);
      }
    };
    // Permit a short-lived cached fix for immediate preview. Submission remains <=5s old.
    const positionOptions = { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 };
    if (native) {
      void import("@capacitor/app")
        .then(async ({ App }) => {
          if (done) return;
          const listener = await App.addListener("appStateChange", ({ isActive }) => {
            if (!isActive) cancel();
          });
          const remove = () => {
            void listener.remove().catch(() => {});
          };
          if (done) remove();
          else stopLifecycle = remove;
        })
        .catch(() => {});
      void (async () => {
        const { Geolocation } = await import("@capacitor/geolocation");
        if (done) return;
        const status = await Geolocation.checkPermissions();
        if (done) return;
        // Permission prompts belong to the permission gate / explicit user action.
        if (status.location !== "granted") {
          finish(
            undefined,
            new LocationAcquisitionError(
              status.coarseLocation === "granted"
                ? "precise_location_required"
                : "permission_denied",
            ),
          );
          return;
        }
        void Geolocation.getCurrentPosition(positionOptions).then(receive).catch(fail);
        const id = await Geolocation.watchPosition(
          {
            ...positionOptions,
            maximumAge: 0,
            interval: UPDATE_INTERVAL_MS,
            minimumUpdateInterval: UPDATE_INTERVAL_MS,
          },
          (position, error) => {
            if (error) fail(error);
            else if (position) receive(position);
          },
        );
        const clear = () => {
          void Geolocation.clearWatch({ id }).catch(() =>
            reportOperationalError(
              "location",
              "clear position watch",
              new Error("Location watch cleanup failed"),
              { severity: "warning" },
            ),
          );
        };
        // Handles cancellation or a fast fix before watchPosition resolves its ID.
        if (done) clear();
        else stopWatch = clear;
      })().catch((error) => {
        fail(error);
        if (!done) finish(undefined, lastError);
      });
    } else if (typeof navigator === "undefined" || !navigator.geolocation) {
      finish(undefined, new LocationAcquisitionError("unavailable"));
    } else {
      try {
        navigator.geolocation.getCurrentPosition(receive, fail, positionOptions);
        if (!done) {
          const id = navigator.geolocation.watchPosition(receive, fail, {
            ...positionOptions,
            maximumAge: 0,
          });
          const clear = () => navigator.geolocation.clearWatch(id);
          if (done) clear();
          else stopWatch = clear;
        }
      } catch (error) {
        finish(undefined, mapLocationError(error, false));
      }
    }
  });
}

export const locationService = {
  async acquire(
    anchor: LocationReading,
    radius: number,
    _sessionId?: string,
    onStep?: StepListener,
    options: AcquisitionOptions = {},
  ): Promise<LocationOutcome> {
    if (
      !validCoordinates(anchor) ||
      anchor.accuracy > 25 ||
      !Number.isFinite(radius) ||
      radius < 100 ||
      radius > 250
    ) {
      return { ok: false, code: "invalid_anchor", message: messages.invalid_anchor };
    }
    let latest: LocationReading | undefined;
    let decision = "stale";
    let distance: number | undefined;
    try {
      const reading = await collectLocation(
        (candidate) => {
          latest = candidate;
          const evaluation = evaluateGeofence(anchor, candidate, radius);
          decision = candidate.accuracy > STUDENT_ACCURACY ? "poor_accuracy" : evaluation.decision;
          distance = evaluation.distance;
          if (decision === "uncertain")
            onStep?.("Near the venue boundary. Refining your location…");
          if (decision === "outside")
            onStep?.("Location appears outside the venue. Checking for an updated reading…");
          return decision === "inside";
        },
        onStep,
        options,
      );
      onStep?.("Location verified", "ok");
      return { ok: true, reading, distance: distance! };
    } catch (error) {
      const failure = mapLocationError(error);
      // Only describe a boundary/accuracy failure if its supporting reading is still fresh.
      const code: LocationFailureCode =
        failure.code === "timeout" && latest && isFreshReading(latest)
          ? decision === "uncertain"
            ? "boundary_uncertain"
            : decision === "outside"
              ? "outside_radius"
              : decision === "poor_accuracy"
                ? "poor_accuracy"
                : failure.code
          : failure.code;
      diagnostic({ phase: "decision", outcome: code });
      if (code !== "cancelled") onStep?.(messages[code], "fail");
      return {
        ok: false,
        code,
        message: messages[code],
        reading: latest,
        distance,
        nativeCode: failure.nativeCode,
      };
    }
  },

  async captureAnchor(
    onStep?: StepListener,
    options: AcquisitionOptions = {},
  ): Promise<LocationReading> {
    let latest: LocationReading | undefined;
    try {
      return await collectLocation(
        (reading) => {
          latest = reading;
          return reading.accuracy <= ANCHOR_ACCURACY;
        },
        onStep,
        options,
      );
    } catch (error) {
      const failure = mapLocationError(error);
      if (
        failure.code === "timeout" &&
        latest &&
        isFreshReading(latest) &&
        latest.accuracy > ANCHOR_ACCURACY
      ) {
        throw new LocationAcquisitionError("poor_accuracy");
      }
      throw failure;
    }
  },
};
