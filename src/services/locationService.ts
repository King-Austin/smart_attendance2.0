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

const MAX_GPS_ACCURACY_THRESHOLD = Number(import.meta.env.VITE_MAX_GPS_ACCURACY_THRESHOLD) || 300;

/** Anchor fixes worse than this are rejected so a coarse reading can't anchor a session. */
const MAX_ANCHOR_ACCURACY = Number(import.meta.env.VITE_MAX_ANCHOR_ACCURACY) || 300;

/** Number of consecutive GPS fixes to sample, keeping the most accurate one. */
const SAMPLE_COUNT = Number(import.meta.env.VITE_GPS_SAMPLE_COUNT) || 3;

/** Pause between samples so the GPS has time to refine its satellite lock. */
const SAMPLE_INTERVAL_MS = Number(import.meta.env.VITE_GPS_SAMPLE_INTERVAL_MS) || 1000;

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
 * Fast Campus GNSS Satellite & Fused Location Engine.
 * Dual-tracks continuous satellite streaming with instant hardware-cached fused queries.
 * Exits immediately within 1-2 seconds upon acquiring a reliable campus fix (<=45m).
 */
async function getPreciseConvergedPosition(onStep?: StepListener): Promise<GeolocationPosition> {
  const TARGET_HIGH_PRECISION = 45; // meters (instant lock threshold for 150m classroom geofences)
  const MAX_CONVERGENCE_TIME_MS = 5000; // 5 seconds maximum warm-up window

  if (isNative()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");

      // Verify fine location permission
      const status = await Geolocation.checkPermissions();
      if (status.location !== "granted") {
        const requested = await Geolocation.requestPermissions({
          permissions: ["location", "coarseLocation"],
        });
        if (requested.location !== "granted" && requested.coarseLocation !== "granted") {
          throw new Error("permission_denied");
        }
      }

      // Start dual-track GNSS stream + fast cached query
      return await new Promise<GeolocationPosition>((resolve, reject) => {
        let bestFix: GeolocationPosition | null = null;
        let watchId: string | null = null;
        let isDone = false;
        let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

        const finalize = async () => {
          if (isDone) return;
          isDone = true;
          if (timeoutTimer) clearTimeout(timeoutTimer);
          if (watchId) {
            Geolocation.clearWatch({ id: watchId }).catch(() => {});
            watchId = null;
          }
          if (bestFix) {
            onStep?.(`📍 GPS Lock: ±${Math.round(bestFix.coords.accuracy)}m`, "ok");
            resolve(bestFix);
          } else {
            // High-resilience fallback: query Android Fused Location Provider with cache tolerance
            onStep?.("Fetching network-fused indoor location…");
            try {
              const fallback = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 4000,
                maximumAge: 20000,
              });
              if (fallback?.coords) {
                onStep?.(`📍 Location Lock: ±${Math.round(fallback.coords.accuracy)}m`, "ok");
                resolve(fallback as unknown as GeolocationPosition);
                return;
              }
            } catch {
              try {
                const coarseFallback = await Geolocation.getCurrentPosition({
                  enableHighAccuracy: false,
                  timeout: 3000,
                  maximumAge: 60000,
                });
                if (coarseFallback?.coords) {
                  onStep?.(`📍 Fused Fix: ±${Math.round(coarseFallback.coords.accuracy)}m`, "ok");
                  resolve(coarseFallback as unknown as GeolocationPosition);
                  return;
                }
              } catch {}
            }
            reject(new Error("location_disabled"));
          }
        };

        timeoutTimer = setTimeout(finalize, MAX_CONVERGENCE_TIME_MS);

        // Track A: Fast instant-cached query (resolves in ~300ms if recent fix exists)
        Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 3500,
          maximumAge: 20000,
        })
          .then((quickPos) => {
            if (isDone || !quickPos?.coords) return;
            const accuracy = Math.round(quickPos.coords.accuracy);
            if (accuracy <= TARGET_HIGH_PRECISION) {
              bestFix = quickPos as unknown as GeolocationPosition;
              void finalize();
            } else if (!bestFix || accuracy < bestFix.coords.accuracy) {
              bestFix = quickPos as unknown as GeolocationPosition;
            }
          })
          .catch(() => {});

        // Track B: Continuous hardware stream
        Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: 15000,
          },
          (position, err) => {
            if (isDone) return;
            if (err || !position?.coords) {
              if (err?.message?.toLowerCase().includes("disabled") || err?.message?.toLowerCase().includes("location")) {
                console.warn("[locationService] Native location watch warning:", err);
              }
              return;
            }

            const accuracy = Math.round(position.coords.accuracy);
            const currentPos = position as unknown as GeolocationPosition;

            if (!bestFix || accuracy < bestFix.coords.accuracy) {
              bestFix = currentPos;
            }

            onStep?.(`🛰️ Triangulating GPS: ±${accuracy}m…`);

            // Target precision reached (<=45m)
            if (accuracy <= TARGET_HIGH_PRECISION) {
              void finalize();
            }
          },
        )
          .then((id) => {
            if (isDone) {
              Geolocation.clearWatch({ id }).catch(() => {});
            } else {
              watchId = id;
            }
          })
          .catch((err) => {
            console.warn("Native watchPosition init error:", err);
          });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("permission_denied") || msg.includes("location_disabled")) throw err;
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
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const finalize = () => {
      if (isDone) return;
      isDone = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {}
        watchId = null;
      }
      if (bestFix) {
        onStep?.(`📍 GPS Lock: ±${Math.round(bestFix.coords.accuracy)}m`, "ok");
        resolve(bestFix);
      } else {
        // Fallback single shot
        navigator.geolocation.getCurrentPosition(
          resolve,
          (err) => reject(new Error(err.code === 2 ? "location_disabled" : "unavailable")),
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 20000 },
        );
      }
    };

    timeoutTimer = setTimeout(finalize, MAX_CONVERGENCE_TIME_MS);

    // Fast instant cached browser attempt
    navigator.geolocation.getCurrentPosition(
      (quickPos) => {
        if (isDone || !quickPos?.coords) return;
        const accuracy = Math.round(quickPos.coords.accuracy);
        if (accuracy <= TARGET_HIGH_PRECISION) {
          bestFix = quickPos;
          finalize();
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 20000 },
    );

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (isDone) return;
        const accuracy = Math.round(pos.coords.accuracy);
        if (!bestFix || accuracy < bestFix.coords.accuracy) {
          bestFix = pos;
        }

        onStep?.(`🛰️ Triangulating GPS: ±${accuracy}m…`);

        if (accuracy <= TARGET_HIGH_PRECISION) {
          finalize();
        }
      },
      () => {},
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 15000,
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
 * reading and computes the distance; the geofence decision is made locally
 * against the session anchor and enforced radius.
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
        message: "Device Location/GPS is turned off. Please turn on Location in Quick Settings or Settings, then retry.",
      };
    } else if (gpsError === "unavailable") {
      onStep?.("GPS signal unavailable", "fail");
      return {
        ok: false,
        code: "unavailable",
        message: "GPS signal unavailable. Move closer to a window or an open area, then retry.",
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
