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

const MAX_GPS_ACCURACY_THRESHOLD = Number(import.meta.env.VITE_MAX_GPS_ACCURACY_THRESHOLD ?? 25);

/** Anchor fixes worse than this are rejected so a coarse reading can't anchor a session. */
const MAX_ANCHOR_ACCURACY = 100;

/** Number of consecutive GPS fixes to sample, keeping the most accurate one. */
const SAMPLE_COUNT = 3;

/** Pause between samples so the GPS has time to refine its satellite lock. */
const SAMPLE_INTERVAL_MS = 1200;

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
    if ((status.location ?? status.coarseLocation) !== "granted") {
      await Geolocation.requestPermissions();
    }
    return (await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 8000,
    })) as unknown as GeolocationPosition;
  }
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
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
async function getBestPosition(): Promise<GeolocationPosition> {
  let best: GeolocationPosition | null = null;
  let lastError: unknown = null;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    if (i > 0) await delay(SAMPLE_INTERVAL_MS);
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
  return best;
}

/**
 * Real GPS acquisition with geofence enforcement. The client reports the
 * reading and computes the distance; the geofence decision is made locally
 * against the session anchor and enforced radius.
 */
export const locationService = {
  async acquire(anchor: LocationReading, radius: number): Promise<LocationOutcome> {
    let position: GeolocationPosition;
    try {
      position = await getBestPosition();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "unavailable") {
        return {
          ok: false,
          code: "unavailable",
          message: "GPS signal unavailable. Move closer to a window or open area and retry.",
        };
      }
      if (
        message.toLowerCase().includes("denied") ||
        message.toLowerCase().includes("permission")
      ) {
        return {
          ok: false,
          code: "permission_denied",
          message: "Location permission was denied. Allow precise location access and retry.",
        };
      }
      return {
        ok: false,
        code: "unavailable",
        message: "GPS signal unavailable. Move closer to a window or open area and retry.",
      };
    }

    const reading = toReading(position);
    if (reading.accuracy > MAX_GPS_ACCURACY_THRESHOLD) {
      return {
        ok: false,
        code: "poor_accuracy",
        message: `GPS accuracy is too poor for verification (${reading.accuracy} m). Required: ${MAX_GPS_ACCURACY_THRESHOLD} m or better.`,
        reading,
      };
    }

    const distance = Math.round(haversine(anchor, reading));
    if (distance > radius) {
      return {
        ok: false,
        code: "outside_radius",
        message: `You are ${distance} m from the session anchor. The allowed radius is ${radius} m.`,
        reading,
        distance,
      };
    }

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
