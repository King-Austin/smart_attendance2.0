import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

/**
 * Full-page fallback for API failures. Only renders when the user is offline
 * (so an actual server outage isn't misclassified as a connectivity problem).
 * The host route decides when to show this — see useApiWithOfflineFallback.
 */
export function OfflineScreen({ onRetry }: { onRetry?: () => void }) {
  const { isOnline } = useNetworkStatus();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="rounded-full bg-muted p-4">
        <WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">You're offline</h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {isOnline
            ? "We couldn't reach the server. Check your connection and try again."
            : "Reconnect to the internet to load the latest data."}
        </p>
      </div>
      {onRetry ? (
        <Button onClick={onRetry} variant="default">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
