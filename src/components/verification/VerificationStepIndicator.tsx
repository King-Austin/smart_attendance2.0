import { Check, Circle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepState = "pending" | "active" | "done" | "failed";

export function VerificationStepIndicator({
  steps,
}: {
  steps: { label: string; state: StepState }[];
}) {
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
      {steps.map((step, i) => (
        <li key={step.label} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              step.state === "done" && "border-success bg-success/15 text-success",
              step.state === "failed" && "border-destructive bg-destructive/10 text-destructive",
              step.state === "active" && "border-primary bg-primary/10 text-primary",
              step.state === "pending" && "border-border bg-muted text-muted-foreground",
            )}
          >
            {step.state === "done" ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : step.state === "failed" ? (
              <X className="h-4 w-4" aria-hidden />
            ) : step.state === "active" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Circle className="h-2.5 w-2.5" aria-hidden />
            )}
          </span>
          <span
            className={cn(
              "text-sm font-medium",
              step.state === "pending" ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {i + 1}. {step.label}
          </span>
          {i < steps.length - 1 && (
            <span className="hidden h-px flex-1 bg-border sm:block" aria-hidden />
          )}
        </li>
      ))}
    </ol>
  );
}
