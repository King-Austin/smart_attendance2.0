import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { pushService, type PushPayload } from "@/services/mobile/pushService";

export type PushHandler = (payload: PushPayload) => void;

/**
 * Hook for wiring up push notifications for the currently authenticated user.
 * - Initializes the Supabase Realtime channel + Web Push subscription (or native
 *   FCM/APNs registration on Android via @capacitor/push-notifications).
 * - Routes tapped notifications (foreground + background) via TanStack Router.
 * - Tears everything down on logout (pass `null` as `userId`).
 *
 * Optional `onPayload` lets the host app show a custom toast/UI for foreground
 * pushes — the default behaviour is to deep-link via `data.route`.
 */
export function usePushNotifications(
  userId: string | null,
  options: { onPayload?: PushHandler } = {},
) {
  const navigate = useNavigate();
  const handlerRef = useRef(options.onPayload);
  handlerRef.current = options.onPayload;

  useEffect(() => {
    if (!userId) return;
    void pushService.initialize(userId);
    return () => {
      void pushService.teardown(userId);
    };
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPush = (event: Event) => {
      const detail = (event as CustomEvent<PushPayload>).detail;
      if (!detail) return;
      handlerRef.current?.(detail);
      const route = detail.data?.route;
      if (route && typeof route === "string") {
        navigate({ to: route as never });
      }
    };
    window.addEventListener("scp:push", onPush as EventListener);
    return () => window.removeEventListener("scp:push", onPush as EventListener);
  }, [navigate]);
}
