import { CheckCircle2, MapPin, Loader2, XCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/ui/status-badge";
import type { LocationOutcome, StepKind } from "@/services/locationService";

export interface VerificationStep {
  text: string;
  kind: StepKind;
}

export function LocationVerificationPanel({
  radius,
  loading,
  outcome,
  steps = [],
}: {
  radius: number;
  loading: boolean;
  outcome: LocationOutcome | null;
  steps?: VerificationStep[];
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
            <Loader2 className="h-3 w-3 animate-spin" /> Verifying location
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

      {steps.length > 0 && (
        <ol className="mt-4 space-y-1.5 border-t border-border pt-4">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              {step.kind === "ok" ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
              ) : step.kind === "fail" ? (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
              ) : (
                <Loader2
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground ${
                    i < steps.length - 1 ? "opacity-40" : ""
                  }`}
                  aria-hidden
                />
              )}
              <span
                className={
                  step.kind === "fail"
                    ? "text-destructive"
                    : step.kind === "ok"
                      ? "text-foreground"
                      : "text-muted-foreground"
                }
              >
                {step.text}
              </span>
            </li>
          ))}
        </ol>
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
