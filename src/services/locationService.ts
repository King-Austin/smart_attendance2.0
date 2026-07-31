import { delay, demoScenarios } from "./demoScenarios";

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

/**
 * Simulated GPS acquisition. The client only reports a reading — the geofence
 * decision is presented as a server response.
 */
export const locationService = {
  async acquire(anchor: LocationReading, radius: number): Promise<LocationOutcome> {
    await delay(1600);
    const scenario = demoScenarios.get().gps;

    if (scenario === "permission_denied") {
      return {
        ok: false,
        code: "permission_denied",
        message:
          "Location permission was denied. Allow location access in your browser settings and retry.",
      };
    }
    if (scenario === "unavailable") {
      return {
        ok: false,
        code: "unavailable",
        message: "GPS signal unavailable. Move closer to a window or open area and retry.",
      };
    }
    if (scenario === "poor_accuracy") {
      return {
        ok: false,
        code: "poor_accuracy",
        message: "GPS accuracy is too poor for verification (48 m). Required: 25 m or better.",
        reading: { lat: anchor.lat + 0.0002, lng: anchor.lng - 0.0003, accuracy: 48 },
        distance: 37,
      };
    }
    if (scenario === "outside_radius") {
      const distance = radius + 84;
      return {
        ok: false,
        code: "outside_radius",
        message: `You are ${distance} m from the session anchor. The allowed radius is ${radius} m.`,
        reading: { lat: anchor.lat + 0.0012, lng: anchor.lng + 0.0009, accuracy: 11 },
        distance,
      };
    }

    const distance = Math.max(4, Math.round(radius * 0.32));
    return {
      ok: true,
      reading: { lat: anchor.lat + 0.00018, lng: anchor.lng - 0.00011, accuracy: 8 },
      distance,
    };
  },

  async captureAnchor(): Promise<LocationReading> {
    await delay(1500);
    return { lat: 6.5244, lng: 3.3792, accuracy: 6 + Math.round(Math.random() * 6) };
  },
};
