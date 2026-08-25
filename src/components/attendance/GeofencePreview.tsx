export function GeofencePreview({ radius, accuracy }: { radius: number; accuracy?: number }) {
  // Normalize scale between 45% and 80% so it stays comfortably inside the radar circle
  const normalizedScale = Math.min(80, Math.max(45, 45 + ((radius - 100) / 100) * 30));

  return (
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl bg-secondary/30 p-4 text-center w-full max-w-full overflow-hidden">
      <div className="relative flex h-36 w-36 max-w-full items-center justify-center rounded-full bg-secondary/80 border border-border/60 overflow-hidden shadow-inner">
        {/* Subtle Radar concentric grid rings */}
        <div className="absolute h-24 w-24 rounded-full border border-dashed border-primary/20" aria-hidden />
        <div className="absolute h-14 w-14 rounded-full border border-primary/20" aria-hidden />
        
        {/* Active Geofence Area */}
        <div
          className="absolute rounded-full border border-primary/60 bg-primary/15 transition-all animate-pulse"
          style={{ width: `${normalizedScale}%`, height: `${normalizedScale}%` }}
          aria-hidden
        />
        
        {/* Center Anchor Point */}
        <span className="relative z-10 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/20 shadow-sm" aria-hidden />
      </div>

      <div className="space-y-0.5 max-w-full px-2">
        <p className="text-xs font-semibold text-foreground truncate">
          Geofence: {radius}m Radius
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {accuracy !== undefined ? `GPS Lock ±${Math.round(accuracy)}m` : "Stand at venue to anchor"}
        </p>
      </div>
    </div>
  );
}

