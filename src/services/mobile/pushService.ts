/**
 * Push service — Supabase Realtime for in-app/foreground notifications, plus
 * Web Push + Service Worker for background notifications. No Firebase.
 *
 * Expected payload structure (server-side):
 * {
 *   "title": "Session started",
 *   "body": "CSC 401 attendance is now open",
 *   "data": { "route": "/student/attendance/SES-2026-1234", "entityId": "SES-2026-1234" }
 * }
 */
import { Capacitor } from "@capacitor/core";
import { PushNotifications, type Token } from "@capacitor/push-notifications";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabase as getSharedSupabase } from "@/lib/supabase";

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  data?: { route?: string; entityId?: string; [key: string]: unknown };
}

interface PushSubscriptionRecord {
  id?: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at?: string;
  updated_at?: string;
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const rawPushEndpoint = import.meta.env.VITE_PUSH_TOKEN_ENDPOINT as string | undefined;

const PUSH_TOKEN_ENDPOINT =
  rawPushEndpoint && !rawPushEndpoint.includes("your-") && !rawPushEndpoint.includes("example.com")
    ? rawPushEndpoint
    : undefined;

let supabase: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let foregroundListenerAttached = false;

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  const shared = getSharedSupabase();
  if (!shared) {
    console.warn("[push] Supabase not configured — realtime disabled");
    return null;
  }
  supabase = shared;
  return supabase;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    let reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn("[push] service worker registration failed", err);
    return null;
  }
}

async function subscribeToWebPush(): Promise<PushSubscription | null> {
  if (!("PushManager" in window)) {
    console.warn("[push] PushManager not supported");
    return null;
  }
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[push] VITE_VAPID_PUBLIC_KEY missing — web push disabled");
    return null;
  }
  const reg = await ensureServiceWorker();
  if (!reg) return null;
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  return subscription;
}

async function sendSubscriptionToSupabase(
  subscription: PushSubscription,
  userId: string,
): Promise<void> {
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error("Invalid push subscription");
  }

  // Prefer a dedicated backend endpoint so secrets (e.g. VAPID private key) stay server-side.
  if (PUSH_TOKEN_ENDPOINT) {
    const res = await fetch(PUSH_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, endpoint, keys: { p256dh, auth } }),
    });
    if (!res.ok) throw new Error(`Failed to register push subscription (${res.status})`);
    return;
  }

  // Fallback: write directly to Supabase from the client.
  const sb = getSupabase();
  if (!sb) return;
  const record: PushSubscriptionRecord = {
    user_id: userId,
    endpoint,
    p256dh,
    auth,
  };
  const { error } = await sb.from("push_subscriptions").upsert(record, {
    onConflict: "endpoint",
  });
  if (error) throw error;
}

async function removeSubscription(userId: string): Promise<void> {
  // 1. Unsubscribe the local Web Push subscription (if any).
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  }

  // 2. Tell the backend (or Supabase) to drop the row(s).
  if (PUSH_TOKEN_ENDPOINT) {
    try {
      await fetch(PUSH_TOKEN_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    } catch (err) {
      console.warn("[push] failed to delete push subscription via endpoint", err);
    }
  } else {
    const sb = getSupabase();
    if (sb) {
      const { error } = await sb.from("push_subscriptions").delete().eq("user_id", userId);
      if (error) console.warn("[push] failed to delete push subscription", error);
    }
  }
}

async function requestWebPushPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

async function setupNativePush(userId: string): Promise<void> {
  let permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive === "prompt") {
    permStatus = await PushNotifications.requestPermissions();
  }
  if (permStatus.receive !== "granted") {
    console.warn("[push] native permission not granted");
    return;
  }
  await PushNotifications.addListener("registration", (token: Token) => {
    // Forward the FCM/APNs token to the backend (still no Firebase project on our end —
    // the OS handles the FCM transport, we just store the token).
    if (PUSH_TOKEN_ENDPOINT) {
      void fetch(PUSH_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          nativeToken: token.value,
          platform: Capacitor.getPlatform(),
        }),
      }).catch((err) => console.warn("[push] native token register failed", err));
    }
  });
  await PushNotifications.addListener("registrationError", (err) => {
    console.warn("[push] native registration error", err);
  });
  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    const payload: PushPayload = {
      title: notification.title ?? "Notification",
      body: notification.body ?? "",
      data: (notification.data as PushPayload["data"]) ?? undefined,
    };
    emitForeground(payload);
  });
  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification.data as PushPayload["data"] | undefined;
    if (data?.route && typeof window !== "undefined") {
      window.history.pushState({}, "", data.route);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  });
}

function emitForeground(payload: PushPayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PushPayload>("scp:push", { detail: payload }));
}

async function subscribeRealtime(userId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  if (realtimeChannel) {
    await sb.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  realtimeChannel = sb
    .channel(`user:${userId}:notifications`)
    .on("broadcast", { event: "notification" }, (msg) => {
      emitForeground(msg.payload as PushPayload);
    })
    .subscribe();
}

function attachForegroundListenerOnce(): void {
  if (foregroundListenerAttached || typeof window === "undefined") return;
  foregroundListenerAttached = true;
  // Consumers (e.g. a toast component) can listen for `scp:push` events.
}

async function initialize(userId: string): Promise<void> {
  if (!userId) return;
  attachForegroundListenerOnce();

  // Realtime — works in both WebView and browser.
  await subscribeRealtime(userId);

  if (Capacitor.isNativePlatform()) {
    await setupNativePush(userId);
    return;
  }

  // Web fallback: Web Push via service worker.
  const permission = await requestWebPushPermission();
  if (permission !== "granted") return;
  const subscription = await subscribeToWebPush();
  if (subscription) {
    try {
      await sendSubscriptionToSupabase(subscription, userId);
    } catch (err) {
      console.warn("[push] failed to register subscription with Supabase", err);
    }
  }
}

async function teardown(userId: string): Promise<void> {
  if (realtimeChannel && supabase) {
    await supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  await removeSubscription(userId);
}

export const pushService = {
  initialize,
  teardown,
  requestWebPushPermission,
  subscribeToWebPush,
  sendSubscriptionToSupabase,
  removeSubscription,
};
