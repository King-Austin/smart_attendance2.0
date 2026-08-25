import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  FileText,
  Layers,
  Loader2,
  MapPin,
  Radio,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GeofencePreview } from "@/components/attendance/GeofencePreview";
import { courseById } from "@/services/courseService";
import { attendanceService, countEnrolled } from "@/services/attendanceService";
import { locationService, type LocationReading } from "@/services/locationService";
import { permissionsService, openLocationSettings, openAppSettings } from "@/services/permissionsService";
import { notificationService } from "@/services/notificationService";
import { emailService } from "@/services/emailService";
import { useRoleGuard, useAuth } from "@/hooks/useAuth";
import { useCourses } from "@/hooks/useCourses";
import { DEPARTMENTS, SEMESTERS, LEVELS } from "@/data/constants";
import { cn } from "@/lib/utils";
import type { AttendanceSession } from "@/types";

const FIXED_RADIUS = Math.max(
  100,
  Number(import.meta.env.VITE_DEFAULT_GEOFENCE_RADIUS ?? 150),
);

export const Route = createFileRoute("/lecturer/create-session")({
  head: () => ({
    meta: [
      { title: "Create Session — Smart Campus" },
      { name: "description", content: "Launch live geofenced attendance session." },
    ],
  }),
  component: CreateSession,
});

function CreateSession() {
  const { user } = useRoleGuard("lecturer");
  const { refreshUser } = useAuth();
  const { courses, loading } = useCourses();
  const navigate = useNavigate();

  const [department, setDepartment] = useState(user?.department ?? DEPARTMENTS[0]);
  const [semester, setSemester] = useState(SEMESTERS[0]);
  const [level, setLevel] = useState(LEVELS[0]);

  const assignedCourses = user ? courses.filter((c) => user.courseIds.includes(c.id)) : [];
  const options = assignedCourses.filter(
    (c) => c.department === department && c.semester === semester && c.level === level,
  );
  const [courseId, setCourseId] = useState(options[0]?.id ?? "");

  if (options.length > 0 && !options.find((c) => c.id === courseId)) {
    setCourseId(options[0].id);
  } else if (options.length === 0 && courseId !== "") {
    setCourseId("");
  }

  const [topic, setTopic] = useState("");
  const [note, setNote] = useState("");
  const [anchor, setAnchor] = useState<LocationReading | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [gpsTelemetry, setGpsTelemetry] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AttendanceSession | null>(null);

  if (!user) return null;

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    try {
      const updated = await refreshUser();
      if (updated && updated.role === "lecturer" && updated.approvalStatus === "approved") {
        toast.success("Account Approved", {
          description: "Session creation is unlocked.",
        });
      } else {
        toast.info("Status Pending", {
          description: "Awaiting administrator verification.",
        });
      }
    } catch {
      toast.error("Status check failed.");
    } finally {
      setCheckingStatus(false);
    }
  };

  const captureAnchor = async () => {
    setCapturing(true);
    setGpsTelemetry("Connecting to GNSS Satellites…");
    setError(null);
    try {
      // 1. Proactively check if location permission is active. If not, prompt immediately.
      const perm = await permissionsService.check("location");
      if (perm.state !== "granted") {
        toast.info("Requesting GPS Permission", {
          description: "Tap 'While using the app' / 'Allow' on the prompt.",
        });
        const req = await permissionsService.request("location");
        if (req.state === "denied") {
          setError("Location permission denied. Tap 'Settings' below to enable Precise Location.");
          return;
        }
      }

      toast.loading("Locking Venue GPS Coordinates…", { id: "gps-lock" });
      const reading = await locationService.captureAnchor((stepText) => {
        setGpsTelemetry(stepText);
        toast.loading(stepText, { id: "gps-lock" });
      });
      setAnchor(reading);
      toast.success("Venue GPS locked", {
        id: "gps-lock",
        description: `Accuracy ±${Math.round(reading.accuracy)}m (${FIXED_RADIUS}m zone active)`,
      });
    } catch (err) {
      toast.dismiss("gps-lock");
      const msg = err instanceof Error ? err.message : "GPS acquisition failed.";
      if (msg.includes("location_disabled")) {
        setError("Device Location/GPS is turned OFF. Turn ON Location in your Android quick settings, then retry.");
      } else if (msg.includes("permission_denied")) {
        setError("Location permission was not granted. Tap 'Settings' to enable it.");
      } else if (msg.includes("precise_location_required")) {
        setError("Please choose 'Precise' location in Android settings for accurate geofencing.");
      } else {
        setError(msg);
      }
    } finally {
      setCapturing(false);
      setGpsTelemetry("");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!courseId) return setError("Please choose a course.");
    if (!topic.trim()) return setError("Lecture topic required.");
    if (!anchor) return setError("GPS venue anchor required.");

    setCreating(true);
    try {
      const enrolledCount = await countEnrolled(courseId);
      const session = await attendanceService.createSession({
        courseId,
        topic: topic.trim(),
        radius: FIXED_RADIUS,
        note: note.trim() || undefined,
        anchor,
        lecturerName: user.name,
        lecturerId: user.id,
        enrolledCount,
      });

      const selectedCourse = courses.find((c) => c.id === courseId);
      notificationService.notifySessionStarted(
        session.id,
        selectedCourse?.code ?? courseId,
        selectedCourse?.title ?? topic.trim(),
      );

      void emailService.sendSessionStartEmail({ sessionId: session.id }).catch(() => {});

      setCreated(session);
      toast.success("Live Session Started");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Session creation failed.");
    } finally {
      setCreating(false);
    }
  };

  if (created) {
    const course = courseById(created.courseId);
    return (
      <AppShell role="lecturer" title="Live Session">
        <div className="max-w-md mx-auto pt-6">
          <Card className="rounded-3xl border border-border/60 bg-card shadow-lg overflow-hidden">
            <div className="bg-emerald-500/10 p-8 text-center border-b border-emerald-500/20">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="mt-4 text-xl font-bold text-foreground">Session Active</h1>
              <p className="mt-1 text-xs text-muted-foreground font-medium">
                {course?.code} &bull; {created.topic}
              </p>
            </div>

            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-secondary/50 p-3.5 border border-border/40">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <Compass className="h-3.5 w-3.5 text-primary" />
                    <span>Geofence</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-foreground">{created.radius}m</p>
                </div>
                <div className="rounded-2xl bg-secondary/50 p-3.5 border border-border/40">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                    <span>GPS Lock</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-foreground">±{Math.round(created.anchor.accuracy)}m</p>
                </div>
              </div>

              <Button
                className="w-full h-12 rounded-2xl text-sm font-semibold shadow-md bg-primary hover:bg-primary/90"
                onClick={() =>
                  navigate({
                    to: "/lecturer/session/$sessionId",
                    params: { sessionId: created.id },
                  })
                }
              >
                Enter Live Monitor
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <Button asChild variant="ghost" className="w-full rounded-xl text-xs text-muted-foreground">
                <Link to="/lecturer/dashboard">Back to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="lecturer" title="New Session">
      <div className="max-w-4xl mx-auto space-y-5 w-full min-w-0 max-w-full overflow-x-hidden">
        {/* Sleek Minimalist Header */}
        <div className="flex items-center justify-between pb-2">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              <span>Live Attendance</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1.5">
              Launch Session
            </h1>
          </div>
        </div>

        {user.approvalStatus !== "approved" ? (
          <Card className="rounded-3xl border-warning/30 bg-warning/5 backdrop-blur-md shadow-sm w-full max-w-full overflow-hidden">
            <CardContent className="p-6 sm:p-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/20 text-warning-foreground">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Verification Pending</h2>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Administrator approval is required to launch attendance sessions.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckStatus}
                disabled={checkingStatus}
                className="rounded-full border-warning/30 px-5 text-xs font-semibold"
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", checkingStatus && "animate-spin")} />
                Check Status
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.3fr_0.9fr] items-start w-full min-w-0 max-w-full">
            {/* Main Form Group (Apple-style Grouped Box) */}
            <form onSubmit={submit} className="space-y-4 w-full min-w-0 max-w-full">
              <Card className="rounded-3xl border border-border/50 bg-card/90 backdrop-blur-md shadow-sm overflow-hidden w-full min-w-0 max-w-full">
                <CardContent className="p-4 sm:p-5 space-y-4 w-full min-w-0">
                  {/* Category Pills Header */}
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground pb-1">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span>Target Cohort</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full min-w-0">
                    <Select value={department} onValueChange={setDepartment}>
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-secondary/30 border-border/40 font-medium w-full min-w-0 overflow-hidden">
                        <SelectValue placeholder="Dept" className="truncate" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl text-xs max-h-60">
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={semester} onValueChange={setSemester}>
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-secondary/30 border-border/40 font-medium w-full min-w-0 overflow-hidden">
                        <SelectValue placeholder="Semester" className="truncate" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl text-xs">
                        {SEMESTERS.map((sem) => (
                          <SelectItem key={sem} value={sem}>
                            {sem}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={level} onValueChange={setLevel}>
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-secondary/30 border-border/40 font-medium w-full min-w-0 overflow-hidden">
                        <SelectValue placeholder="Level" className="truncate" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl text-xs">
                        {LEVELS.map((lvl) => (
                          <SelectItem key={lvl} value={lvl}>
                            {lvl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Course Picker */}
                  <div className="space-y-1.5 pt-1 w-full min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                      <span>Course</span>
                    </div>
                    <Select value={courseId} onValueChange={setCourseId}>
                      <SelectTrigger className="h-11 rounded-xl bg-secondary/40 border-border/40 font-medium text-xs w-full min-w-0 overflow-hidden">
                        <SelectValue placeholder="Choose assigned course" className="truncate" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl text-xs max-h-60">
                        {loading ? (
                          <SelectItem value="loading" disabled>
                            Loading…
                          </SelectItem>
                        ) : options.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No matching courses
                          </SelectItem>
                        ) : (
                          options.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.code} — {c.title}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Topic & Notes */}
                  <div className="space-y-3 pt-1 w-full min-w-0">
                    <div className="relative w-full min-w-0">
                      <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                      <Input
                        placeholder="Lecture Topic / Title"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="h-11 pl-10 rounded-xl bg-secondary/30 border-border/40 text-xs font-medium w-full min-w-0"
                      />
                    </div>

                    <div className="relative w-full min-w-0">
                      <FileText className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground/70" />
                      <Input
                        placeholder="Note / Announcement (Optional)"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="h-11 pl-10 rounded-xl bg-secondary/30 border-border/40 text-xs font-medium w-full min-w-0"
                      />
                    </div>
                  </div>

                  {/* iOS Grouped Location Lock Card */}
                  <div className="rounded-2xl border border-border/50 bg-secondary/30 p-3.5 flex items-center justify-between gap-2.5 w-full min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={cn(
                          "flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                          anchor
                            ? "bg-emerald-500/15 text-emerald-600"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {capturing ? "Triangulating Satellites…" : anchor ? "Venue GPS Locked" : "Venue GPS Anchor"}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono truncate">
                          {capturing
                            ? gpsTelemetry || "Warming up GNSS satellite receiver…"
                            : anchor
                              ? `±${Math.round(anchor.accuracy)}m (${FIXED_RADIUS}m zone)`
                              : "Required for geofence validation"}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant={anchor ? "secondary" : "default"}
                      size="sm"
                      onClick={captureAnchor}
                      disabled={capturing}
                      className="rounded-xl h-9 px-3 text-xs shrink-0 font-medium shadow-none"
                    >
                      {capturing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : anchor ? (
                        <RefreshCw className="h-3.5 w-3.5" />
                      ) : (
                        "Lock GPS"
                      )}
                    </Button>
                  </div>

                  {error && (
                    <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium flex items-center justify-between gap-2 w-full min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span className="truncate">{error}</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl h-7 px-2.5 text-[11px] font-bold border-destructive/30 text-destructive bg-destructive/5 shrink-0"
                        onClick={() => openLocationSettings()}
                      >
                        <Settings className="mr-1 h-3 w-3" />
                        Settings
                      </Button>
                    </div>
                  )}

                  {/* Main Action Button */}
                  <Button
                    type="submit"
                    disabled={creating}
                    className="w-full h-12 rounded-2xl text-sm font-semibold shadow-md bg-primary hover:bg-primary/90 mt-2"
                  >
                    {creating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Radio className="mr-2 h-4 w-4" />
                    )}
                    Start Live Session
                  </Button>
                </CardContent>
              </Card>
            </form>

            {/* Radar / Geofence Visualizer */}
            <div className="space-y-3 w-full min-w-0 max-w-full">
              <Card className="rounded-3xl border border-border/50 bg-card/80 backdrop-blur-md shadow-sm overflow-hidden w-full min-w-0 max-w-full">
                <CardContent className="p-4 space-y-3 w-full min-w-0">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
                    <div className="flex items-center gap-1.5">
                      <Compass className="h-3.5 w-3.5 text-primary" />
                      <span>Live Radar</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>{FIXED_RADIUS}m Active</span>
                    </div>
                  </div>

                  <div className="rounded-2xl overflow-hidden border border-border/40 w-full min-w-0 max-w-full">
                    <GeofencePreview radius={FIXED_RADIUS} accuracy={anchor?.accuracy} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

