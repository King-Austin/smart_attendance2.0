import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Smart Campus Presence",
  slug: "smart-campus-presence",
  version: "1.0.0",
  scheme: "smartcampus",
  orientation: "default",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  ios: {
    bundleIdentifier: "com.smartattendance.mobile",
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription:
        "Use your camera to enroll your face and verify classroom attendance.",
      NSLocationWhenInUseUsageDescription:
        "Confirm that you are inside the attendance venue while checking in.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.smartattendance.mobile",
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
    permissions: ["CAMERA", "ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "POST_NOTIFICATIONS"],
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
    ],
    adaptiveIcon: { foregroundImage: "./assets/icon.png", backgroundColor: "#123ba8" },
  },
  plugins: [
    "expo-router",
    "expo-dev-client",
    "expo-secure-store",
    "expo-font",
    [
      "expo-camera",
      {
        cameraPermission: "Use your camera for face enrollment and attendance verification.",
        recordAudioAndroid: false,
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission: "Confirm that you are inside the attendance venue.",
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    ["expo-notifications", { color: "#244dc2" }],
    [
      "expo-splash-screen",
      {
        image: "./assets/icon.png",
        imageWidth: 96,
        backgroundColor: "#f6f8fc",
        dark: { backgroundColor: "#070d1c" },
      },
    ],
  ],
  extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined } },
};
export default config;
