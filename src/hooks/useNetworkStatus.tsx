import { useEffect, useState } from "react";
import { networkService, type ConnectionType, type NetworkState } from "@/services/mobile/networkService";

/**
 * Returns the current network state and re-renders on changes.
 * Works in the Capacitor Android WebView (via @capacitor/network) and the browser
 * (via `navigator.onLine` + `online`/`offline` events).
 */
export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>(() => networkService.getState());

  useEffect(() => {
    const unsubscribe = networkService.subscribe(setState);
    return unsubscribe;
  }, []);

  return state;
}

export type { ConnectionType, NetworkState };
