// Mobile (Capacitor) build config.
// Produces a static SPA client bundle in dist/client so Capacitor can load the
// app from local device storage (no SSR/Nitro server on device).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    spa: {
      enabled: true,
      prerender: {
        crawlLinks: false,
        outputPath: "index.html",
      },
    },
  },
  nitro: false,
});
