import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Bluetooth,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  RefreshCw,
  Settings,
  ShieldCheck,
  Wifi,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  INITIAL_PERMISSIONS,
  openAppSettings,
  openLocationSettings,
  openBluetoothSettings,
  openWifiSettings,
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
    label: "Precise GNSS GPS Location",
    why: "Required to confirm physical classroom geofence attendance.",
    icon: MapPin,
  },
  {
    key: "camera",
    label: "High-Resolution Camera",
    why: "Used for 3D liveness detection & facial verification check-in.",
    icon: Camera,
  },
  {
    key: "bluetooth",
    label: "Bluetooth & Beacon Scanning",
    why: "Assists micro-location positioning inside academic halls.",
    icon: Bluetooth,
  },
  {
    key: "notification",
    label: "Push Notifications",
    why: "Alerts you when a lecture attendance session starts or status changes.",
    icon: Bell,
  },
  {
    key: "network",
    label: "Wi-Fi & Cellular Data",
    why: "Needed to connect securely to the verification server.",
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
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            Hardware Permissions Required
          </h1>
          <p className="mt-2 text-xs text-muted-foreground max-w-sm mx-auto">
            Grant all capabilities so precise satellite geofencing and facial verification run without interruption.
          </p>
        </div>

        <Card className="rounded-3xl border border-border/50 bg-card/90 backdrop-blur-md shadow-sm overflow-hidden">
          <CardContent className="divide-y divide-border/50 p-0">
            {ITEMS.map((item) => {
              const result = permissions[item.key];
              const granted = result.state === "granted";
              return (
                <div key={item.key} className="flex items-start gap-3 p-4">
                  <span
                    className={
                      granted
                        ? "rounded-xl bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400"
                        : "rounded-xl bg-muted p-2 text-muted-foreground"
                    }
                  >
                    <item.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold text-foreground">{item.label}</p>
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
                        <StatusBadge tone="info">Pending</StatusBadge>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                      {result.detail ?? item.why}
                    </p>
                    {!granted && (
                      <div className="flex items-center gap-2 mt-2.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl h-8 text-xs font-semibold"
                          disabled={busy !== null}
                          onClick={() => void requestOne(item.key)}
                        >
                          {busy === item.key ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          {result.state === "denied" ? "Retry" : "Allow"}
                        </Button>

                        {result.state === "denied" && (
                          <Button
                            variant="default"
                            size="sm"
                            className="rounded-xl h-8 text-xs font-semibold bg-primary"
                            onClick={() =>
                              item.key === "location"
                                ? openLocationSettings()
                                : item.key === "bluetooth"
                                  ? openBluetoothSettings()
                                  : item.key === "network"
                                    ? openWifiSettings()
                                    : openAppSettings()
                            }
                          >
                            <Settings className="mr-1.5 h-3.5 w-3.5" />
                            Settings
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-2 pt-1">
          <Button
            className="w-full h-12 rounded-2xl font-bold shadow-md bg-primary hover:bg-primary/90 text-xs sm:text-sm"
            disabled={busy !== null}
            onClick={() => void requestAll()}
          >
            {busy === "all" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Grant All Core Permissions
          </Button>

          <Button
            variant="outline"
            className="w-full h-11 rounded-2xl font-semibold border-border/60 text-xs text-muted-foreground"
            onClick={() => openAppSettings()}
          >
            <Settings className="mr-2 h-4 w-4" />
            Open Android App Settings
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground font-medium max-w-xs mx-auto">
          If permissions are permanently blocked or approximate only, enable <span className="font-semibold text-foreground">Precise Location</span> in Android App Settings.
        </p>
      </div>
    </div>
  );
}
