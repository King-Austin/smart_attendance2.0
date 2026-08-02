import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { appLifecycleService } from "@/services/mobile/appLifecycleService";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";

/**
 * Mounts platform-specific lifecycle handlers. Render once near the top of the
 * tree (inside the AuthProvider so push notifications can resolve the user).
 *
 * - Registers the Android hardware back button.
 * - Hides the native splash screen after first paint.
 * - Wires up Supabase Realtime + Web Push for the signed-in user.
 * - Subscribes to foreground notification events.
 */
export function AndroidBackHandler() {
  const router = useRouter();
  const { user } = useAuth();
  const [, setExitArmed] = useState(false);

  // Hide the splash once the SPA shell has rendered. Safe to call repeatedly.
  useEffect(() => {
    void appLifecycleService.hideSplashScreen();
  }, []);

  // Wire up the back button on native only.
  useEffect(() => {
    void appLifecycleService.registerBackButton(router);
  }, [router]);

  // Show a toast on the second-back exit-confirm event.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onExit = () => {
      setExitArmed(true);
      toast.message("Press back again to exit", { duration: 2000 });
      window.setTimeout(() => setExitArmed(false), 2000);
    };
    window.addEventListener("scp:exit-confirm", onExit);
    return () => window.removeEventListener("scp:exit-confirm", onExit);
  }, []);

  // Push notifications: initialise when we have a user, tear down on logout.
  usePushNotifications(user?.id ?? null, {
    onPayload: (payload) => {
      toast.message(payload.title, { description: payload.body });
    },
  });

  return null;
}
