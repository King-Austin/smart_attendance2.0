/**
 * Network service — exposes a unified online/offline + connection-type signal.
 * Uses Capacitor Network on native, the browser `online`/`offline` events + a
 * `navigator.connection` lookup on the web.
 */
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { Network, type ConnectionStatus } from "@capacitor/network";

export type ConnectionType = "wifi" | "cellular" | "ethernet" | "none" | "unknown";

export interface NetworkState {
  isOnline: boolean;
  connectionType: ConnectionType;
}

type Listener = (state: NetworkState) => void;

const listeners = new Set<Listener>();
let currentState: NetworkState = { isOnline: true, connectionType: "unknown" };
let nativeHandle: PluginListenerHandle | null = null;
let webOnline: (() => void) | null = null;
let webOffline: (() => void) | null = null;
let initialized = false;

function readWebConnectionType(): ConnectionType {
  const conn = (navigator as unknown as { connection?: { type?: string; effectiveType?: string } })
    .connection;
  const raw = conn?.type;
  if (raw === "wifi") return "wifi";
  if (raw === "cellular") return "cellular";
  if (raw === "ethernet") return "ethernet";
  if (raw === "none") return "none";
  return "unknown";
}

function setState(next: NetworkState): void {
  const prev = currentState;
  currentState = next;
  if (prev.isOnline === next.isOnline && prev.connectionType === next.connectionType) return;
  for (const l of listeners) l(next);
}

async function init(): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (Capacitor.isNativePlatform()) {
    const status: ConnectionStatus = await Network.getStatus();
    setState({ isOnline: status.connected, connectionType: (status.connectionType as ConnectionType) ?? "unknown" });
    nativeHandle = await Network.addListener("networkStatusChange", (s) => {
      setState({ isOnline: s.connected, connectionType: (s.connectionType as ConnectionType) ?? "unknown" });
    });
    return;
  }
  setState({ isOnline: navigator.onLine, connectionType: readWebConnectionType() });
  webOnline = () => setState({ isOnline: true, connectionType: readWebConnectionType() });
  webOffline = () => setState({ isOnline: false, connectionType: "none" });
  window.addEventListener("online", webOnline);
  window.addEventListener("offline", webOffline);
}

async function teardown(): Promise<void> {
  if (nativeHandle) {
    await nativeHandle.remove();
    nativeHandle = null;
  }
  if (webOnline) window.removeEventListener("online", webOnline);
  if (webOffline) window.removeEventListener("offline", webOffline);
  webOnline = null;
  webOffline = null;
  listeners.clear();
  initialized = false;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Lazy init so we don't hit the native bridge before the platform is ready.
  void init();
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

function getState(): NetworkState {
  return currentState;
}

export const networkService = {
  init,
  teardown,
  subscribe,
  getState,
};
