import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Camera, CheckCircle2, Loader2, MapPin, RefreshCw, ShieldCheck, Wifi, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  INITIAL_PERMISSIONS,
  permissionsReady,
  permissionsService,
  type PermissionKey,
  type PermissionsMap,
} from "@/services/permissionsService";

const ITEMS: {
  key: PermissionKey;
  label: string;
  why: string;
  icon: typeof MapPin;
}[] = [
  {
    key: "location",
    label: "Location & GPS",
    why: "Used to confirm you are physically inside the lecture geofence.",
    icon: MapPin,
  },
  {
    key: "camera",
    label: "Camera",
    why: "Used for liveness checks and facial verification during check-in.",
    icon: Camera,
  },
  {
    key: "network",
    label: "Wi-Fi / mobile data",
    why: "Needed to reach the verification server. Verification never happens on-device.",
    icon: Wifi,
  },
];

/**
 * Requests and verifies every device permission the attendance flow needs before
 * the app is usable, so nothing is prompted for mid-verification. Permission
 * state is re-checked whenever the app regains focus.
 */
export function PermissionsGate({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<PermissionsMap>(INITIAL_PERMISSIONS);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState<PermissionKey | "all" | null>(null);

  const refresh = useCallback(async () => {
    const next = await permissionsService.checkAll();
    setPermissions(next);
    setChecking(false);
    return next;
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", onFocus);
    window.addEventListener("offline", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("offline", onFocus);
    };
  }, [refresh]);

  const requestOne = async (key: PermissionKey) => {
    setBusy(key);
    const result = await permissionsService.request(key);
    setPermissions((prev) => ({ ...prev, [key]: result }));
    setBusy(null);
  };

  const requestAll = async () => {
    setBusy("all");
    for (const item of ITEMS) {
      const current = await permissionsService.check(item.key);
      if (current.state === "granted") {
        setPermissions((prev) => ({ ...prev, [item.key]: current }));
        continue;
      }
      const result = await permissionsService.request(item.key);
      setPermissions((prev) => ({ ...prev, [item.key]: result }));
    }
    setBusy(null);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Checking device permissions…</p>
        </div>
      </div>
    );
  }

  if (permissionsReady(permissions)) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-lg space-y-5">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            Device permissions required
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Grant these once now so attendance verification is never interrupted halfway
            through. Nothing is captured until you start a check-in.
          </p>
        </div>

        <Card>
          <CardContent className="divide-y divide-border p-0">
            {ITEMS.map((item) => {
              const result = permissions[item.key];
              const granted = result.state === "granted";
              return (
                <div key={item.key} className="flex items-start gap-3 p-4">
                  <span
                    className={
                      granted
                        ? "rounded-lg bg-success/12 p-2 text-success"
                        : "rounded-lg bg-muted p-2 text-muted-foreground"
                    }
                  >
                    <item.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      {granted ? (
                        <StatusBadge tone="success">
                          <CheckCircle2 className="h-3 w-3" /> Granted
                        </StatusBadge>
                      ) : result.state === "denied" ? (
                        <StatusBadge tone="danger">
                          <XCircle className="h-3 w-3" /> Denied
                        </StatusBadge>
                      ) : result.state === "unavailable" ? (
                        <StatusBadge tone="warning">Unavailable</StatusBadge>
                      ) : (
                        <StatusBadge tone="info">Not granted yet</StatusBadge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{result.detail ?? item.why}</p>
                    {!granted && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        disabled={busy !== null}
                        onClick={() => void requestOne(item.key)}
                      >
                        {busy === item.key ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        {result.state === "denied" ? "Check again" : "Allow"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Button className="w-full" disabled={busy !== null} onClick={() => void requestAll()}>
          {busy === "all" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Grant all permissions
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          If a permission was permanently blocked, enable it in your browser site settings or
          device app settings, then return here — this screen re-checks automatically.
        </p>
      </div>
    </div>
  );
}
