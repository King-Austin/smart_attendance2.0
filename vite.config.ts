// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Pre-bundle every browser dependency imported by lazily loaded routes. Without
// this list Vite discovers them during navigation and invalidates its optimized
// chunk graph repeatedly; concurrent pages can then request a chunk that the
// optimizer has just replaced and fall into the root error boundary.
const CLIENT_OPTIMIZED_DEPENDENCIES = [
  "@capacitor/app",
  "@capacitor/camera",
  "@capacitor/core",
  "@capacitor/geolocation",
  "@capacitor/network",
  "@capacitor/preferences",
  "@capacitor/push-notifications",
  "@capacitor/splash-screen",
  "@mediapipe/tasks-vision",
  "@radix-ui/react-accordion",
  "@radix-ui/react-alert-dialog",
  "@radix-ui/react-aspect-ratio",
  "@radix-ui/react-avatar",
  "@radix-ui/react-checkbox",
  "@radix-ui/react-collapsible",
  "@radix-ui/react-context-menu",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-hover-card",
  "@radix-ui/react-label",
  "@radix-ui/react-menubar",
  "@radix-ui/react-navigation-menu",
  "@radix-ui/react-popover",
  "@radix-ui/react-progress",
  "@radix-ui/react-radio-group",
  "@radix-ui/react-scroll-area",
  "@radix-ui/react-select",
  "@radix-ui/react-separator",
  "@radix-ui/react-slider",
  "@radix-ui/react-slot",
  "@radix-ui/react-switch",
  "@radix-ui/react-tabs",
  "@radix-ui/react-toggle",
  "@radix-ui/react-toggle-group",
  "@radix-ui/react-tooltip",
  "@supabase/supabase-js",
  "@tanstack/react-query",
  "@vercel/analytics/react",
  "capacitor-native-settings",
  "class-variance-authority",
  "clsx",
  "cmdk",
  "embla-carousel-react",
  "input-otp",
  "lucide-react",
  "react-day-picker",
  "react-hook-form",
  "react-resizable-panels",
  "recharts",
  "sonner",
  "tailwind-merge",
  "vaul",
  "zod",
] as const;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Pass configuration overrides directly to the underlying Nitro engine
  nitro: {
    preset: "vercel",
  },
  // Allow ngrok tunnel domains to reach the dev server
  vite: {
    optimizeDeps: {
      include: [...CLIENT_OPTIMIZED_DEPENDENCIES],
    },
    server: {
      allowedHosts: [".ngrok-free.dev", ".loca.lt", "poor-sheep-wish.loca.lt"],
    },
  },
});
