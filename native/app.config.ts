import type { ExpoConfig } from "expo/config";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch {}
}

loadEnvFile(path.resolve(__dirname, ".env"));
loadEnvFile(path.resolve(__dirname, "..", "mobile", ".env"));
loadEnvFile(path.resolve(__dirname, "..", ".env"));

if (!process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
  process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
}
if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY && process.env.VITE_SUPABASE_ANON_KEY) {
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
}
if (!process.env.EXPO_PUBLIC_BIOMETRIC_API_URL && process.env.VITE_BIOMETRIC_API_URL) {
  process.env.EXPO_PUBLIC_BIOMETRIC_API_URL = process.env.VITE_BIOMETRIC_API_URL;
}

const config: ExpoConfig = {
  name: "Smart Campus Presence",
  slug: "smart-campus-presence",
  version: "1.0.0",
  scheme: "smartcampus",
  orientation: "default",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  ios: {
    bundleIdentifier: "com.smartattendance.native",
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
    package: "com.smartattendance.native",
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
  extra: {
    eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "https://jtezcxkjjrrzqakrfukf.supabase.co",
    supabaseAnonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZXpjeGtqanJyenFha3JmdWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMDUzNjYsImV4cCI6MjA3NTc4MTM2Nn0.uJs56vN9vSV2hlAcf196bb5d9TqYl1VeYAZRAa9HZAI",
    apiBase: process.env.EXPO_PUBLIC_API_BASE_URL || "https://insightface.pharmaloop.org",
    biometricBase: process.env.EXPO_PUBLIC_BIOMETRIC_API_URL || "https://insightface.pharmaloop.org",
  },
};
export default config;
