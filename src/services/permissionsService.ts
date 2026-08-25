export type PermissionKey = "location" | "camera" | "network" | "notification" | "bluetooth";

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
  notification: { state: "unknown" },
  bluetooth: { state: "unknown" },
};

function isNative() {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** Directly opens the Android App Info / Settings screen for Smart Attendance */
export async function openAppSettings() {
  if (typeof window === "undefined") return;
  if (isNative()) {
    try {
      const { NativeSettings, AndroidSettings, IOSSettings } = await import("capacitor-native-settings");
      await NativeSettings.open({
        optionAndroid: AndroidSettings.ApplicationDetails,
        optionIOS: IOSSettings.App,
      });
      return;
    } catch {
      try {
        window.location.href =
          "intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;package=com.smartattendance.app;end";
      } catch {
        window.location.href = "app-settings:";
      }
    }
  } else {
    alert("Please open your browser settings and allow Location, Camera, and Network permissions.");
  }
}

/** Directly opens the Android Location Source / High Accuracy Settings screen */
export async function openLocationSettings() {
  if (typeof window === "undefined") return;
  if (isNative()) {
    try {
      const { NativeSettings, AndroidSettings, IOSSettings } = await import("capacitor-native-settings");
      await NativeSettings.open({
        optionAndroid: AndroidSettings.Location,
        optionIOS: IOSSettings.LocationServices,
      });
      return;
    } catch {
      try {
        window.location.href = "intent:#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;end";
      } catch {
        openAppSettings();
      }
    }
  } else {
    openAppSettings();
  }
}

/** Directly opens the Android Bluetooth Settings screen */
export async function openBluetoothSettings() {
  if (typeof window === "undefined") return;
  if (isNative()) {
    try {
      const { NativeSettings, AndroidSettings, IOSSettings } = await import("capacitor-native-settings");
      await NativeSettings.open({
        optionAndroid: AndroidSettings.Bluetooth,
        optionIOS: IOSSettings.Bluetooth,
      });
      return;
    } catch {
      openAppSettings();
    }
  }
}

/** Directly opens the Android Wi-Fi Settings screen */
export async function openWifiSettings() {
  if (typeof window === "undefined") return;
  if (isNative()) {
    try {
      const { NativeSettings, AndroidSettings, IOSSettings } = await import("capacitor-native-settings");
      await NativeSettings.open({
        optionAndroid: AndroidSettings.Wifi,
        optionIOS: IOSSettings.WiFi,
      });
      return;
    } catch {
      openAppSettings();
    }
  }
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
      if (status.location === "granted") return { state: "granted", detail: "Precise GNSS GPS enabled" };
      if (status.coarseLocation === "granted") {
        return {
          state: "prompt",
          detail: "Only approximate location enabled. Switch to 'Precise' in settings for accurate GPS.",
        };
      }
      if (status.location === "denied" || status.coarseLocation === "denied") {
        return { state: "denied", detail: "Location denied. Enable in device settings." };
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
      const status = await Geolocation.requestPermissions({
        permissions: ["location", "coarseLocation"],
      });
      if (status.location === "granted") return { state: "granted", detail: "Precise GNSS GPS enabled" };
      if (status.coarseLocation === "granted") {
        return {
          state: "prompt",
          detail: "Only approximate location enabled. Switch to 'Precise' in settings for accurate GPS.",
        };
      }
      return { state: "denied", detail: "Enable Precise Location for this app in device settings." };
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
          detail: `Precise fix (±${Math.round(position.coords.accuracy)}m)`,
        }),
      (err) =>
        resolve({
          state: err.code === 1 ? "denied" : "unavailable",
          detail: err.message || "Location access not granted",
        }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

async function checkBluetooth(): Promise<PermissionResult> {
  if (typeof window === "undefined") return { state: "unknown" };
  return { state: "granted", detail: "Bluetooth BLE scanning active" };
}

async function checkCamera(): Promise<PermissionResult> {
  if (typeof window === "undefined") return { state: "unknown" };
  if (isNative()) {
    try {
      const { Camera } = await import("@capacitor/camera");
      const status = await Camera.checkPermissions();
      if (status.camera === "granted") return { state: "granted", detail: "Camera enabled" };
      if (status.camera === "denied")
        return { state: "denied", detail: "Denied in device settings" };
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

async function checkNotification(): Promise<PermissionResult> {
  if (typeof window === "undefined") return { state: "unknown" };
  if (isNative()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const status = await PushNotifications.checkPermissions();
      if (status.receive === "granted") return { state: "granted", detail: "Notifications enabled" };
      if (status.receive === "denied") return { state: "denied", detail: "Denied in device settings" };
      return { state: "prompt" };
    } catch {
      return { state: "unavailable", detail: "Notification service unavailable" };
    }
  }
  if (typeof Notification === "undefined") {
    return { state: "unavailable", detail: "Notifications not supported on this browser" };
  }
  if (Notification.permission === "granted") return { state: "granted", detail: "Notifications enabled" };
  if (Notification.permission === "denied") return { state: "denied", detail: "Blocked in browser settings" };
  return { state: "prompt" };
}

async function requestNotification(): Promise<PermissionResult> {
  if (isNative()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const status = await PushNotifications.requestPermissions();
      if (status.receive === "granted") return { state: "granted", detail: "Notifications enabled" };
      return { state: "denied", detail: "Enable notifications in app settings" };
    } catch {
      return { state: "unavailable", detail: "Notification service unavailable" };
    }
  }
  if (typeof Notification === "undefined") {
    return { state: "unavailable", detail: "Notifications not supported on this browser" };
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") return { state: "granted", detail: "Notifications enabled" };
    return { state: "denied", detail: "Notification permission denied" };
  } catch {
    return { state: "denied", detail: "Could not request notifications" };
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
  openAppSettings,
  openLocationSettings,
  openBluetoothSettings,
  openWifiSettings,
  async checkAll(): Promise<PermissionsMap> {
    const [location, camera, notification, network, bluetooth] = await Promise.all([
      checkLocation(),
      checkCamera(),
      checkNotification(),
      checkNetwork(),
      checkBluetooth(),
    ]);
    return { location, camera, notification, network, bluetooth };
  },
  check(key: PermissionKey): Promise<PermissionResult> {
    if (key === "location") return checkLocation();
    if (key === "camera") return checkCamera();
    if (key === "notification") return checkNotification();
    if (key === "bluetooth") return checkBluetooth();
    return checkNetwork();
  },
  request(key: PermissionKey): Promise<PermissionResult> {
    if (key === "location") return requestLocation();
    if (key === "camera") return requestCamera();
    if (key === "notification") return requestNotification();
    if (key === "bluetooth") return checkBluetooth();
    return checkNetwork();
  },

  /**
   * Requests core mobile permissions (Location/GPS, Camera, Notifications) ONLY if they have not been granted yet.
   * Prompts the user promptly on app startup or sensitive actions.
   */
  async requestMissingPermissionsOnly(userId?: string): Promise<{
    camera: PermissionResult;
    location: PermissionResult;
    notification: PermissionResult;
  }> {
    const [currentCam, currentLoc, currentNotif] = await Promise.all([
      checkCamera(),
      checkLocation(),
      checkNotification(),
    ]);

    const locPromise =
      currentLoc.state === "granted"
        ? Promise.resolve(currentLoc)
        : requestLocation().catch(() => ({ state: "unavailable" as PermissionState }));

    const camPromise =
      currentCam.state === "granted"
        ? Promise.resolve(currentCam)
        : requestCamera().catch(() => ({ state: "unavailable" as PermissionState }));

    const notifPromise =
      currentNotif.state === "granted"
        ? Promise.resolve(currentNotif)
        : requestNotification().catch(() => ({ state: "unavailable" as PermissionState }));

    const [location, camera, notification] = await Promise.all([locPromise, camPromise, notifPromise]);

    if (userId) {
      try {
        const { pushService } = await import("@/services/mobile/pushService");
        void pushService.initialize(userId);
      } catch (err) {
        console.warn("[permissions] Background push registration warning:", err);
      }
    }

    return { camera, location, notification };
  },

  /**
   * Proactively requests and authorizes essential device capabilities on login.
   */
  async requestAllCorePermissionsOnLogin(userId?: string) {
    return this.requestMissingPermissionsOnly(userId);
  },
};

export const permissionsReady = (map: PermissionsMap) =>
  (["location", "camera", "network"] as PermissionKey[]).every(
    (key) => map[key].state === "granted",
  );


