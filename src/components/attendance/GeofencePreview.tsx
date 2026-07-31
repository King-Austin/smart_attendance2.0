export function GeofencePreview({
  radius,
  accuracy,
}: {
  radius: number;
  accuracy?: number;
}) {
  const scale = 40 + ((radius - 50) / 50) * 45;
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6">
      <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-secondary">
        <div
          className="absolute rounded-full border-2 border-primary/40 bg-primary/10 transition-all"
          style={{ width: `${scale}%`, height: `${scale}%` }}
          aria-hidden
        />
        <span className="relative z-10 h-3 w-3 rounded-full bg-primary" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">Geofence radius: {radius} m</p>
      <p className="text-xs text-muted-foreground">
        Schematic view of the session anchor
        {accuracy !== undefined ? ` · GPS accuracy ${accuracy} m` : ""}
      </p>
    </div>
  );
}
