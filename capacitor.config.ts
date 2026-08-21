import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.smartattendance.app",
  appName: "Smart Campus Presence",
  webDir: "dist/client",
  server: {
    androidScheme: "https",
    url: "https://swirl-stuffing-untoasted.ngrok-free.dev",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: "#0f172a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0f172a",
      overlaysWebView: false,
    },
    Geolocation: {},
    Camera: {},
    App: {
      // Allow callbacks to be registered for app URL open / back button events.
    },
  },
};

export default config;
