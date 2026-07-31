import { MapPin, Loader2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/ui/status-badge";
import type { LocationOutcome } from "@/services/locationService";

export function LocationVerificationPanel({
  radius,
  loading,
  outcome,
}: {
  radius: number;
  loading: boolean;
  outcome: LocationOutcome | null;
}) {
  const reading = outcome && "reading" in outcome ? outcome.reading : undefined;
  const distance = outcome && "distance" in outcome ? outcome.distance : undefined;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" aria-hidden />
          <p className="text-sm font-semibold text-foreground">Location verification</p>
        </div>
        {loading ? (
          <StatusBadge tone="info">
            <Loader2 className="h-3 w-3 animate-spin" /> Acquiring GPS
          </StatusBadge>
        ) : outcome ? (
          <StatusBadge tone={outcome.ok ? "success" : "danger"}>
            {outcome.ok ? "Location verified" : "Verification failed"}
          </StatusBadge>
        ) : (
          <StatusBadge>Waiting</StatusBadge>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">GPS accuracy</dt>
          <dd className="font-medium text-foreground">
            {reading ? `${reading.accuracy} m` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Distance from anchor</dt>
          <dd className="font-medium text-foreground">
            {distance !== undefined ? `${distance} m` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Allowed radius</dt>
          <dd className="font-medium text-foreground">{radius} m</dd>
        </div>
      </dl>

      {outcome && !outcome.ok && (
        <p className="mt-4 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">
          {outcome.message}
        </p>
      )}

      {reading && (
        <Collapsible className="mt-4">
          <CollapsibleTrigger className="text-xs font-medium text-primary underline underline-offset-4">
            Technical details
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            lat {reading.lat.toFixed(6)} · lng {reading.lng.toFixed(6)} · accuracy{" "}
            {reading.accuracy} m
          </CollapsibleContent>
        </Collapsible>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        The reading is submitted to the server. The geofence decision is made server-side.
      </p>
    </div>
  );
}
