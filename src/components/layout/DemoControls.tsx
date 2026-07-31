import { useEffect, useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { demoScenarios } from "@/services/demoScenarios";
import type { FaceScenario, GpsScenario } from "@/services/demoScenarios";

const GPS_OPTIONS: { value: GpsScenario; label: string }[] = [
  { value: "auto", label: "Automatic (success)" },
  { value: "poor_accuracy", label: "GPS accuracy too poor" },
  { value: "outside_radius", label: "Outside attendance radius" },
  { value: "permission_denied", label: "Location permission denied" },
  { value: "unavailable", label: "GPS unavailable" },
];

const FACE_OPTIONS: { value: FaceScenario; label: string }[] = [
  { value: "auto", label: "Automatic (success)" },
  { value: "mismatch", label: "Face mismatch" },
  { value: "no_face", label: "No face detected" },
  { value: "multiple_faces", label: "Multiple faces detected" },
  { value: "poor_lighting", label: "Image too dark" },
  { value: "duplicate", label: "Duplicate face (enrollment)" },
  { value: "network_error", label: "Network error" },
];

export function DemoControls() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return demoScenarios.subscribe(() => force((n) => n + 1));
  }, []);

  if (!mounted) return null;
  const state = demoScenarios.get();

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-4">
      {open ? (
        <div className="w-72 rounded-lg border border-border bg-card p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Demo controls</p>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close demo controls"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Prototype only. Forces simulated verification outcomes.
          </p>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="demo-gps">Location outcome</Label>
              <Select
                value={state.gps}
                onValueChange={(v) => demoScenarios.setGps(v as GpsScenario)}
              >
                <SelectTrigger id="demo-gps">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GPS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-face">Face outcome</Label>
              <Select
                value={state.face}
                onValueChange={(v) => demoScenarios.setFace(v as FaceScenario)}
              >
                <SelectTrigger id="demo-face">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FACE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="shadow-md"
          onClick={() => setOpen(true)}
        >
          <FlaskConical className="mr-2 h-4 w-4" />
          Demo controls
        </Button>
      )}
    </div>
  );
}
