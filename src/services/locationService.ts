import { reportOperationalError } from "@/lib/operationalError";

export interface LocationReading {
  lat: number;
  lng: number;
  accuracy: number;
}

export type LocationOutcome =
  | { ok: true; reading: LocationReading; distance: number }
  | {
      ok: false;
      code: "poor_accuracy" | "outside_radius" | "permission_denied" | "unavailable";
      message: string;
      reading?: LocationReading;
      distance?: number;
    };

/** Kind of a live verification step shown to the user on screen. */
export type StepKind = "info" | "ok" | "fail";

/** Called as each verification step completes so the UI can show progress. */
export type StepListener = (text: string, kind?: StepKind) => void;

function preciseAccuracyLimit(value: unknown): number {
  const configured = Number(value);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 25) : 25;
}

const MAX_GPS_ACCURACY_THRESHOLD = preciseAccuracyLimit(
  import.meta.env.VITE_MAX_GPS_ACCURACY_THRESHOLD,
);

/** Anchor fixes worse than this are rejected so a coarse reading can't anchor a session. */
const MAX_ANCHOR_ACCURACY = preciseAccuracyLimit(import.meta.env.VITE_MAX_ANCHOR_ACCURACY);

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const configured = Number(value);
  if (!Number.isFinite(configured)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(configured)));
}

/** Number of fresh GPS fixes to sample, keeping the most accurate one. */
const SAMPLE_COUNT = boundedInteger(import.meta.env.VITE_GPS_SAMPLE_COUNT, 5, 3, 10);

/** Pause between samples so the GPS has time to refine its satellite lock. */
const SAMPLE_INTERVAL_MS = boundedInteger(
  import.meta.env.VITE_GPS_SAMPLE_INTERVAL_MS,
  1500,
  250,
  5000,
);

/** Haversine distance in metres between two coordinates. */
function haversine(a: LocationReading, b: LocationReading): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function isNative() {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/**
 * Campus GNSS convergence engine. It combines a fresh high-accuracy query with
 * a continuous stream, requires multiple time-separated readings, and keeps
 * the most accurate fresh fix.
 */
async function getPreciseConvergedPosition(onStep?: StepListener): Promise<GeolocationPosition> {
  const targetHighPrecision = Math.min(MAX_GPS_ACCURACY_THRESHOLD, MAX_ANCHOR_ACCURACY);
  const maxConvergenceTimeMs = Math.max(8000, SAMPLE_COUNT * SAMPLE_INTERVAL_MS + 5000);

  if (isNative()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");

      // Verify fine location permission
      const status = await Geolocation.checkPermissions();
      if (status.location !== "granted") {
        if (status.coarseLocation === "granted") {
          throw new Error("precise_location_required");
        }
        const requested = await Geolocation.requestPermissions({
          permissions: ["location", "coarseLocation"],
        });
        if (requested.location !== "granted") {
          if (requested.coarseLocation === "granted") {
            throw new Error("precise_location_required");
          }
          throw new Error("permission_denied");
        }
      }

      // Start dual-track GNSS stream + fast cached query
      return await new Promise<GeolocationPosition>((resolve, reject) => {
        let bestFix: GeolocationPosition | null = null;
        let watchId: string | null = null;
        let isDone = false;
        let watchErrorReported = false;
        let acceptedSamples = 0;
        let lastSampleAt = 0;
        let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

        const finalize = () => {
          if (isDone) return;
          isDone = true;
          if (timeoutTimer) clearTimeout(timeoutTimer);
          if (watchId) {
            Geolocation.clearWatch({ id: watchId }).catch((error) =>
              reportOperationalError("location", "clear native position watch", error, {
                severity: "warning",
              }),
            );
            watchId = null;
          }
          if (bestFix && acceptedSamples >= SAMPLE_COUNT) {
            onStep?.(`📍 GPS Lock: ±${Math.round(bestFix.coords.accuracy)}m`, "ok");
            resolve(bestFix);
          } else {
            reject(new Error(bestFix ? "insufficient_samples" : "unavailable"));
          }
        };

        const considerPosition = (position: GeolocationPosition) => {
          if (isDone || !position.coords) return;
          const { latitude, longitude, accuracy } = position.coords;
          if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            !Number.isFinite(accuracy) ||
            accuracy < 0
          ) {
            return;
          }

          if (!bestFix || accuracy < bestFix.coords.accuracy) bestFix = position;

          const now = Date.now();
          if (lastSampleAt && now - lastSampleAt < SAMPLE_INTERVAL_MS) return;
          lastSampleAt = now;
          acceptedSamples += 1;
          onStep?.(`🛰️ GPS sample ${acceptedSamples}/${SAMPLE_COUNT}: ±${Math.round(accuracy)}m…`);

          if (acceptedSamples >= SAMPLE_COUNT && bestFix.coords.accuracy <= targetHighPrecision) {
            void finalize();
          }
        };

        timeoutTimer = setTimeout(finalize, maxConvergenceTimeMs);

        // Track A: Fast instant-cached query (resolves in ~300ms if recent fix exists)
        Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 3500,
          maximumAge: 0,
        })
          .then((quickPos) => {
            if (!quickPos?.coords) return;
            considerPosition(quickPos as unknown as GeolocationPosition);
          })
          .catch((error) => {
            reportOperationalError("location", "native cached position", error, {
              severity: "warning",
            });
          });

        // Track B: Continuous hardware stream
        Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: 0,
          },
          (position, err) => {
            if (isDone) return;
            if (err || !position?.coords) {
              if (!watchErrorReported) {
                watchErrorReported = true;
                reportOperationalError(
                  "location",
                  "receive native position watch update",
                  err ?? new Error("Native location watch returned no coordinates."),
                  { severity: "warning" },
                );
              }
              return;
            }

            considerPosition(position as unknown as GeolocationPosition);
          },
        )
          .then((id) => {
            if (isDone) {
              Geolocation.clearWatch({ id }).catch((error) =>
                reportOperationalError("location", "clear late native position watch", error, {
                  severity: "warning",
                }),
              );
            } else {
              watchId = id;
            }
          })
          .catch((err) => {
            reportOperationalError("location", "native position watch", err);
          });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.includes("permission_denied") ||
        msg.includes("location_disabled") ||
        msg.includes("precise_location_required")
      ) {
        throw err;
      }
      reportOperationalError("location", "native geolocation", err);
      throw new Error("unavailable", { cause: err });
    }
  }

  // Browser / WebView Geolocation Convergence Stream
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("unavailable"));
      return;
    }

    let bestFix: GeolocationPosition | null = null;
    let watchId: number | null = null;
    let isDone = false;
    let acceptedSamples = 0;
    let lastSampleAt = 0;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const finalize = () => {
      if (isDone) return;
      isDone = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch (error) {
          reportOperationalError("location", "clear browser position watch", error, {
            severity: "warning",
          });
        }
        watchId = null;
      }
      if (bestFix && acceptedSamples >= SAMPLE_COUNT) {
        onStep?.(`📍 GPS Lock: ±${Math.round(bestFix.coords.accuracy)}m`, "ok");
        resolve(bestFix);
      } else {
        reject(new Error(bestFix ? "insufficient_samples" : "unavailable"));
      }
    };

    const considerPosition = (position: GeolocationPosition) => {
      if (isDone || !position.coords) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(accuracy) ||
        accuracy < 0
      ) {
        return;
      }

      if (!bestFix || accuracy < bestFix.coords.accuracy) bestFix = position;

      const now = Date.now();
      if (lastSampleAt && now - lastSampleAt < SAMPLE_INTERVAL_MS) return;
      lastSampleAt = now;
      acceptedSamples += 1;
      onStep?.(`🛰️ GPS sample ${acceptedSamples}/${SAMPLE_COUNT}: ±${Math.round(accuracy)}m…`);

      if (acceptedSamples >= SAMPLE_COUNT && bestFix.coords.accuracy <= targetHighPrecision) {
        finalize();
      }
    };

    timeoutTimer = setTimeout(finalize, maxConvergenceTimeMs);

    // Fast instant cached browser attempt
    navigator.geolocation.getCurrentPosition(
      (quickPos) => {
        considerPosition(quickPos);
      },
      (error) => {
        reportOperationalError("location", "browser cached position", error, {
          severity: "warning",
        });
      },
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 0 },
    );

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        considerPosition(pos);
      },
      (error) => {
        reportOperationalError("location", "browser position watch", error, {
          severity: "warning",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 0,
      },
    );
  });
}

function toReading(position: GeolocationPosition): LocationReading {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: Math.round(position.coords.accuracy),
  };
}

/**
 * Real GPS acquisition with geofence enforcement. The client reports the
 * reading and computes an immediate UI distance; the database repeats the
 * accuracy and geofence checks before accepting attendance.
 */
export const locationService = {
  async acquire(
    anchor: LocationReading,
    radius: number,
    _sessionId?: string,
    onStep?: StepListener,
  ): Promise<LocationOutcome> {
    onStep?.("Starting GNSS satellite triangulation…");
    let position: GeolocationPosition | null = null;
    let gpsError: string | null = null;

    try {
      position = await getPreciseConvergedPosition(onStep);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "location_disabled" || message.includes("location_disabled")) {
        gpsError = "location_disabled";
      } else if (message === "unavailable") {
        gpsError = "unavailable";
      } else if (message === "insufficient_samples") {
        gpsError = "insufficient_samples";
      } else if (message === "precise_location_required") {
        gpsError = "precise_location_required";
      } else if (
        message.toLowerCase().includes("denied") ||
        message.toLowerCase().includes("permission")
      ) {
        gpsError = "permission_denied";
      } else {
        gpsError = "unavailable";
      }
    }

    if (gpsError === "location_disabled") {
      onStep?.("Device location services are disabled", "fail");
      return {
        ok: false,
        code: "permission_denied",
        message:
          "Device Location/GPS is turned off. Please turn on Location in Quick Settings or Settings, then retry.",
      };
    } else if (gpsError === "unavailable") {
      onStep?.("GPS signal unavailable", "fail");
      return {
        ok: false,
        code: "unavailable",
        message: "GPS signal unavailable. Move closer to a window or an open area, then retry.",
      };
    } else if (gpsError === "insufficient_samples") {
      onStep?.("Not enough fresh GPS readings", "fail");
      return {
        ok: false,
        code: "unavailable",
        message:
          "Could not collect enough fresh GPS readings. Keep the device still in an open area, then retry.",
      };
    } else if (gpsError === "precise_location_required") {
      onStep?.("Precise location is required", "fail");
      return {
        ok: false,
        code: "permission_denied",
        message:
          "Precise location is required for attendance. Enable Precise location for this app in device settings, then retry.",
      };
    } else if (gpsError === "permission_denied") {
      onStep?.("Location permission was denied", "fail");
      return {
        ok: false,
        code: "permission_denied",
        message: "Location permission was denied.",
      };
    }

    if (!position) {
      return { ok: false, code: "unavailable", message: "Unknown location error" };
    }

    const reading = toReading(position);
    if (reading.accuracy > MAX_GPS_ACCURACY_THRESHOLD) {
      onStep?.(`GPS accuracy too poor (${reading.accuracy} m)`, "fail");
      return {
        ok: false,
        code: "poor_accuracy",
        message: `GPS accuracy is too poor (${reading.accuracy} m). Move to an open area, enable precise location, and retry.`,
        reading,
      };
    }

    onStep?.("Computing distance from anchor…");
    const distance = Math.round(haversine(anchor, reading));
    if (distance > radius) {
      onStep?.(`Distance ${distance} m exceeds the ${radius} m radius`, "fail");
      return {
        ok: false,
        code: "outside_radius",
        message: `You are ${distance} m away from the session geofence.`,
        reading,
        distance,
      };
    }

    onStep?.(`Distance ${distance} m is within the ${radius} m radius`, "ok");
    return { ok: true, reading, distance };
  },

  /**
   * Captures a session anchor. Coarse fixes (IP geolocation on desktop, coarse-only
   * grants on mobile) are rejected so a session can never be anchored tens of
   * kilometres away from the real venue.
   */
  async captureAnchor(onStep?: StepListener): Promise<LocationReading> {
    const position = await getPreciseConvergedPosition(onStep);
    const reading = toReading(position);
    if (reading.accuracy > MAX_ANCHOR_ACCURACY) {
      throw new Error(
        `Location is too imprecise to anchor a session (${reading.accuracy} m). ` +
          "Enable precise GPS, or move closer to a window or open area, then retry.",
      );
    }
    return reading;
  },
};
