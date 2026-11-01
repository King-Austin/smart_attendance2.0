/** Shared client policy; database migration 0027 enforces the same limits. */
export const MAX_LOCATION_AGE_MS = 5000;
export const MAX_CLOCK_SKEW_MS = 2000;
export const MAX_LOCATION_ACCURACY = 25;

export interface LocationReading {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp?: number;
  venueId?: string;
}

export function validCoordinates(reading: LocationReading): boolean {
  return (
    Number.isFinite(reading.lat) &&
    Math.abs(reading.lat) <= 90 &&
    Number.isFinite(reading.lng) &&
    Math.abs(reading.lng) <= 180 &&
    Number.isFinite(reading.accuracy) &&
    reading.accuracy >= 0
  );
}

export function isFreshReading(reading: LocationReading, now = Date.now()): boolean {
  return (
    Number.isFinite(reading.timestamp) &&
    now - reading.timestamp! <= MAX_LOCATION_AGE_MS &&
    reading.timestamp! - now <= MAX_CLOCK_SKEW_MS
  );
}

export function distanceMetres(a: LocationReading, b: LocationReading): number {
  const rad = (n: number) => (n * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export type GeofenceDecision =
  "inside" | "outside" | "uncertain" | "poor_accuracy" | "stale" | "invalid";

export function evaluateGeofence(
  anchor: LocationReading,
  reading: LocationReading,
  radius: number,
  now = Date.now(),
): { decision: GeofenceDecision; distance: number } {
  if (
    !validCoordinates(anchor) ||
    anchor.accuracy > MAX_LOCATION_ACCURACY ||
    !validCoordinates(reading) ||
    !Number.isFinite(radius) ||
    radius < 100 ||
    radius > 250
  ) {
    return { decision: "invalid", distance: NaN };
  }
  const distance = distanceMetres(anchor, reading);
  if (!isFreshReading(reading, now)) return { decision: "stale", distance };
  if (reading.accuracy > MAX_LOCATION_ACCURACY) return { decision: "poor_accuracy", distance };
  // Conservative uncertainty margin, not a guarantee of physical presence.
  const margin = anchor.accuracy + reading.accuracy;
  if (distance + margin <= radius) return { decision: "inside", distance };
  if (distance - margin > radius) return { decision: "outside", distance };
  return { decision: "uncertain", distance };
}
