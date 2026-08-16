export type PermissionKey = "location" | "camera" | "network";

export type PermissionState = "unknown" | "prompt" | "granted" | "denied" | "unavailable";

export interface PermissionResult {
  state: PermissionState;
  detail?: string;
}

export type PermissionsMap = Record<PermissionKey, PermissionResult>;

export const INITIAL_PERMISSIONS: PermissionsMap = {
  location: { state: "unknown" },
  camera: { state: "unknown" },
  network: { state: "unknown" },
};

function isNative() {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** Reads a browser Permissions API state without prompting, when available. */
async function queryBrowserPermission(name: string): Promise<PermissionState> {
  try {
    const status = await navigator.permissions.query({
      name: name as PermissionName,
    });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "unknown";
  }
}

async function checkLocation(): Promise<PermissionResult> {
  if (typeof window === "undefined") return { state: "unknown" };
  if (isNative()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const status = await Geolocation.checkPermissions();
      if (status.location === "granted") return { state: "granted", detail: "Precise GPS enabled" };
      if (status.coarseLocation === "granted") {
        return {
          state: "prompt",
          detail: "Only approximate location is enabled. Choose Precise location for accurate GPS.",
        };
      }
      if (status.location === "denied" || status.coarseLocation === "denied") {
        return { state: "denied", detail: "Denied in device settings" };
      }
      return { state: "prompt" };
    } catch {
      return { state: "unavailable", detail: "Location services not available" };
    }
  }
  if (!("geolocation" in navigator)) {
    return { state: "unavailable", detail: "This device has no GPS/location support" };
  }
  const state = await queryBrowserPermission("geolocation");
  return {
    state,
    detail:
      state === "granted"
        ? "Location access allowed"
        : state === "denied"
          ? "Blocked in browser site settings"
          : undefined,
  };
}

async function requestLocation(): Promise<PermissionResult> {
  if (isNative()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const status = await Geolocation.requestPermissions();
      if (status.location === "granted") return { state: "granted", detail: "Precise GPS enabled" };
      if (status.coarseLocation === "granted") {
        return {
          state: "prompt",
          detail: "Only approximate location enabled. Switch the app to Precise location in settings.",
        };
      }
      return { state: "denied", detail: "Enable location for this app in device settings" };
    } catch {
      return { state: "unavailable", detail: "Location services not available" };
    }
  }
  if (!("geolocation" in navigator)) {
    return { state: "unavailable", detail: "This device has no GPS/location support" };
  }
  return new Promise<PermissionResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          state: "granted",
          detail: `GPS fix acquired · accuracy ${Math.round(position.coords.accuracy)} m`,
        }),
      (error) =>
        resolve(
          error.code === error.PERMISSION_DENIED
            ? { state: "denied", detail: "Permission denied. Allow location and try again." }
            : {
                state: "prompt",
                detail: "No GPS fix yet. Move to an open area and try again.",
              },
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}

async function checkCamera(): Promise<PermissionResult> {
  if (typeof window === "undefined") return { state: "unknown" };
  if (isNative()) {
    try {
      const { Camera } = await import("@capacitor/camera");
      const status = await Camera.checkPermissions();
      if (status.camera === "granted") return { state: "granted", detail: "Camera enabled" };
      if (status.camera === "denied") return { state: "denied", detail: "Denied in device settings" };
      return { state: "prompt" };
    } catch {
      return { state: "unavailable", detail: "Camera not available" };
    }
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { state: "unavailable", detail: "No camera API on this device" };
  }
  const state = await queryBrowserPermission("camera");
  return {
    state,
    detail:
      state === "granted"
        ? "Camera access allowed"
        : state === "denied"
          ? "Blocked in browser site settings"
          : undefined,
  };
}

async function requestCamera(): Promise<PermissionResult> {
  if (isNative()) {
    try {
      const { Camera } = await import("@capacitor/camera");
      const status = await Camera.requestPermissions({ permissions: ["camera"] });
      if (status.camera === "granted") return { state: "granted", detail: "Camera enabled" };
      return { state: "denied", detail: "Enable camera for this app in device settings" };
    } catch {
      return { state: "unavailable", detail: "Camera not available" };
    }
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { state: "unavailable", detail: "No camera API on this device" };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    stream.getTracks().forEach((track) => track.stop());
    return { state: "granted", detail: "Front camera ready" };
  } catch {
    return { state: "denied", detail: "Camera permission denied. Allow it and try again." };
  }
}

async function checkNetwork(): Promise<PermissionResult> {
  if (typeof window === "undefined") return { state: "unknown" };
  if (isNative()) {
    try {
      const { Network } = await import("@capacitor/network");
      const status = await Network.getStatus();
      return status.connected
        ? { state: "granted", detail: `Connected via ${status.connectionType}` }
        : { state: "denied", detail: "No network connection. Enable Wi-Fi or mobile data." };
    } catch {
      return { state: "unavailable", detail: "Network status unavailable" };
    }
  }
  const online = navigator.onLine;
  const connection = (
    navigator as unknown as { connection?: { effectiveType?: string; type?: string } }
  ).connection;
  return online
    ? {
        state: "granted",
        detail: connection?.type
          ? `Connected via ${connection.type}`
          : connection?.effectiveType
            ? `Connected (${connection.effectiveType})`
            : "Connected",
      }
    : { state: "denied", detail: "Offline. Enable Wi-Fi or mobile data and retry." };
}

export const permissionsService = {
  isNative,
  async checkAll(): Promise<PermissionsMap> {
    const [location, camera, network] = await Promise.all([
      checkLocation(),
      checkCamera(),
      checkNetwork(),
    ]);
    return { location, camera, network };
  },
  check(key: PermissionKey): Promise<PermissionResult> {
    if (key === "location") return checkLocation();
    if (key === "camera") return checkCamera();
    return checkNetwork();
  },
  request(key: PermissionKey): Promise<PermissionResult> {
    if (key === "location") return requestLocation();
    if (key === "camera") return requestCamera();
    return checkNetwork();
  },
};

export const permissionsReady = (map: PermissionsMap) =>
  (["location", "camera", "network"] as PermissionKey[]).every(
    (key) => map[key].state === "granted",
  );
