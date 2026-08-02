import { useEffect, useState } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { cn } from "@/lib/utils";

const RECONNECT_DISMISS_MS = 3000;

/**
 * Fixed banner shown when the device is offline. Non-blocking — the rest of the
 * UI stays interactive. Briefly shows a "Back online" confirmation when the
 * connection returns, then auto-dismisses.
 */
export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineRef = useOfflineTracker(isOnline);

  useEffect(() => {
    if (!isOnline) return;
    if (!wasOfflineRef.current) return;
    setShowReconnected(true);
    const t = window.setTimeout(() => setShowReconnected(false), RECONNECT_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [isOnline, wasOfflineRef]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 top-0 z-50 px-4 py-2 text-center text-xs font-medium shadow-md transition-colors",
        isOnline ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground",
      )}
    >
      {isOnline
        ? "Back online"
        : "No internet connection — check your Wi-Fi or mobile data"}
    </div>
  );
}

// Tiny helper hook so we know whether the user *was* offline before the
// transition, without re-rendering on every online tick.
function useOfflineTracker(isOnline: boolean) {
  const ref = usePrev(isOnline === false);
  return ref;
}

import { useRef } from "react";
function usePrev<T>(value: T) {
  const ref = useRef<T>(value);
  const previousRef = useRef<T | undefined>(undefined);
  previousRef.current = ref.current;
  ref.current = value;
  return previousRef as React.MutableRefObject<T | undefined>;
}
