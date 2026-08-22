import { useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import { SplashScreen } from "@capacitor/splash-screen";
import { cn } from "@/lib/utils";

/**
 * Native iOS-style animated splash screen that plays a smooth logo spring entrance
 * and breathing glow animation on initial app launch, then smoothly fades out.
 */
export function AnimatedSplashScreen() {
  const [visible, setVisible] = useState(true);
  const [animating, setAnimating] = useState(true);

  useEffect(() => {
    // Dismiss native static splash immediately
    void SplashScreen.hide().catch(() => {});

    // Begin fade-out sequence after 1.1s
    const fadeTimer = setTimeout(() => {
      setAnimating(false);
    }, 1100);

    // Unmount after fade completes
    const removeTimer = setTimeout(() => {
      setVisible(false);
    }, 1700);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 px-6 transition-opacity duration-600 ease-out",
        animating ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      aria-hidden="true"
    >
      {/* Ambient background glow */}
      <div className="absolute h-64 w-64 rounded-full bg-primary/20 blur-3xl" />

      {/* Center Icon & Branding */}
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-primary via-primary/90 to-primary/70 text-primary-foreground shadow-2xl shadow-primary/50 ring-4 ring-white/10 transition-transform duration-700 animate-in zoom-in-75">
          <ScanFace className="h-12 w-12 stroke-[2.2] animate-pulse" />
          {/* Subtle spinning accent ring */}
          <div className="absolute -inset-1 rounded-3xl border border-primary/40 animate-ping opacity-25" />
        </div>

        <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Smart Attendance
          </h1>
          <p className="text-xs font-medium tracking-wide text-slate-400">
            Biometric & Geofenced Ledger
          </p>
        </div>

        {/* Minimal iOS loading dot pill */}
        <div className="mt-6 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
        </div>
      </div>
    </div>
  );
}
