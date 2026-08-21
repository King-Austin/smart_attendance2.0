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

const MAX_GPS_ACCURACY_THRESHOLD = Number(import.meta.env.VITE_MAX_GPS_ACCURACY_THRESHOLD ?? 25);

/** Anchor fixes worse than this are rejected so a coarse reading can't anchor a session. */
const MAX_ANCHOR_ACCURACY = Number(import.meta.env.VITE_MAX_ANCHOR_ACCURACY ?? 150);

/** Number of consecutive GPS fixes to sample, keeping the most accurate one. */
const SAMPLE_COUNT = Number(import.meta.env.VITE_GPS_SAMPLE_COUNT ?? 5);

/** Pause between samples so the GPS has time to refine its satellite lock. */
const SAMPLE_INTERVAL_MS = Number(import.meta.env.VITE_GPS_SAMPLE_INTERVAL_MS ?? 1500);

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

async function getCurrentPosition(): Promise<GeolocationPosition> {
  if (isNative()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    // Require fine (precise) location. Coarse-only grants return city-level fixes
    // that can be tens of kilometres from the real position.
    const status = await Geolocation.checkPermissions();
    if (status.location !== "granted") {
      const requested = await Geolocation.requestPermissions({
        permissions: ["location"],
      });
      if (requested.location !== "granted") {
        if (requested.coarseLocation === "granted") {
          throw new Error("precise_location_required");
        }
        throw new Error("permission_denied");
      }
    }
    return (await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
    })) as unknown as GeolocationPosition;
  }
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function toReading(position: GeolocationPosition): LocationReading {
  // Never rewrite accuracy: a coarse IP-geolocation fix must stay coarse so the
  // accuracy gate and anchor validation reject it instead of trusting it.
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: Math.round(position.coords.accuracy),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sample several GPS fixes over a few seconds and keep the most accurate one.
 * Real receivers refine their satellite lock as they track, so a later fix is
 * usually tighter than the first. Stops early once a fix meets the gate.
 */
async function getBestPosition(onStep?: StepListener): Promise<GeolocationPosition> {
  let best: GeolocationPosition | null = null;
  let lastError: unknown = null;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    if (i > 0) await delay(SAMPLE_INTERVAL_MS);
    onStep?.(`Sampling GPS fix ${i + 1}/${SAMPLE_COUNT}…`);
    try {
      const position = await getCurrentPosition();
      if (!best || position.coords.accuracy < best.coords.accuracy) {
        best = position;
      }
      if (best.coords.accuracy <= MAX_GPS_ACCURACY_THRESHOLD) break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!best && lastError) throw lastError;
  if (!best) throw new Error("unavailable");
  onStep?.(`Best GPS fix: ${best.coords.accuracy} m accuracy`, "ok");
  return best;
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
    onStep?.("Starting precise GPS verification…");
    let position: GeolocationPosition | null = null;
    let gpsError: string | null = null;

    try {
      position = await getBestPosition(onStep);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "unavailable") {
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

    if (gpsError === "unavailable") {
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
  async captureAnchor(): Promise<LocationReading> {
    const position = await getBestPosition();
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
