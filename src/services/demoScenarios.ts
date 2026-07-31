export type GpsScenario =
  | "auto"
  | "verified"
  | "poor_accuracy"
  | "outside_radius"
  | "permission_denied"
  | "unavailable";

export type FaceScenario =
  | "auto"
  | "verified"
  | "mismatch"
  | "no_face"
  | "multiple_faces"
  | "poor_lighting"
  | "duplicate"
  | "network_error";

type Listener = () => void;

const state = {
  gps: "auto" as GpsScenario,
  face: "auto" as FaceScenario,
};

const listeners = new Set<Listener>();

export const demoScenarios = {
  get: () => state,
  setGps(value: GpsScenario) {
    state.gps = value;
    listeners.forEach((l) => l());
  },
  setFace(value: FaceScenario) {
    state.face = value;
    listeners.forEach((l) => l());
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
