import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AttendanceResultCard({
  success,
  title,
  message,
  details,
  primaryAction,
  secondaryAction,
}: {
  success: boolean;
  title: string;
  message: string;
  details?: { label: string; value: string }[];
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      {success ? (
        <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden />
      ) : (
        <XCircle className="mx-auto h-14 w-14 text-destructive" aria-hidden />
      )}
      <h2 className="mt-4 text-xl font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p>

      {details && details.length > 0 && (
        <dl className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-4 text-left">
          {details.map((d) => (
            <div key={d.label} className="rounded-lg bg-muted px-3 py-2">
              <dt className="text-xs text-muted-foreground">{d.label}</dt>
              <dd className="text-sm font-medium text-foreground">{d.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {primaryAction}
        {secondaryAction}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Result returned by the verification server. Attendance is recorded server-side only.
      </p>
    </div>
  );
}

export { Button };
