import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
  valueClassName,
  iconClassName,
  iconBgClassName,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
  valueClassName?: string;
  iconClassName?: string;
  iconBgClassName?: string;
}) {
  return (
    <Card className={cn("border-border/60 shadow-sm rounded-2xl", className)}>
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p
            className={cn("mt-1 text-2xl font-bold tracking-tight text-foreground", valueClassName)}
          >
            {value}
          </p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span
            className={cn("rounded-xl bg-primary/10 p-2.5 text-primary shadow-xs", iconBgClassName)}
          >
            <Icon className={cn("h-5 w-5", iconClassName)} aria-hidden />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
