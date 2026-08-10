import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.smartcampuspresence",
  appName: "Smart Campus Presence",
  webDir: ".vercel/output/static",
  server: {
    androidScheme: "https",
  },
  plugins: {
    Geolocation: {},
    Camera: {},
  },
};

export default config;
