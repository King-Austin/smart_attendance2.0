import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Fingerprint,
  Loader2,
  MapPin,
  Radio,
  RefreshCw,
  Satellite,
  ScanFace,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PermissionsGate } from "@/components/permissions/PermissionsGate";
import { ErrorState } from "@/components/layout/PageHeader";
import { FaceVerificationFlow } from "@/components/verification/FaceVerificationFlowModal";
import { AttendanceResultCard } from "@/components/verification/AttendanceResultCard";
import { attendanceService } from "@/services/attendanceService";
import { locationService } from "@/services/locationService";
import type { LocationOutcome, StepKind } from "@/services/locationService";
import { biometricService, imageToBase64 } from "@/services/biometricService";
import { permissionsService, openLocationSettings } from "@/services/permissionsService";
import { courseById } from "@/services/courseService";
import { useRoleGuard } from "@/hooks/useAuth";
import { useSessions } from "@/hooks/useSessions";
import { useCourses } from "@/hooks/useCourses";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/attendance/$sessionId")({
  head: () => ({
    meta: [
      { title: "Mark Attendance — Smart Campus Presence" },
      {
        name: "description",
        content: "Complete high-precision GPS geofencing and neural biometric facial verification.",
      },
      { property: "og:title", content: "Mark Attendance — Smart Campus Presence" },
      { property: "og:description", content: "Location and face verification for attendance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AttendanceFlow,
});

function AttendanceFlow() {
  const { sessionId } = Route.useParams();
  const { user } = useRoleGuard("student");
  const navigate = useNavigate();
  useCourses();
  const sessions = useSessions();
  const session = sessions.find((s) => s.id === sessionId);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gps, setGps] = useState<LocationOutcome | null>(null);
  const [stepLog, setStepLog] = useState<{ text: string; kind: StepKind }[]>([]);
  const [faceProcessing, setFaceProcessing] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    score: number;
    distance: number;
    recordedAt: string;
  } | null>(null);

  const runToken = useRef(0);

  const runLocation = async () => {
    if (!session) return;
    const token = ++runToken.current;
    setGps(null);
    setStepLog([]);
    setGpsLoading(true);
    setFaceError(null);

    // Proactively verify & prompt location permission on mobile
    const perm = await permissionsService.check("location");
    if (perm.state !== "granted") {
      await permissionsService.request("location");
    }

    const outcome = await locationService.acquire(
      session.anchor,
      session.radius,
      session.id,
      (text, kind) => {
        if (runToken.current === token) {
          setStepLog((prev) => [...prev, { text, kind: kind ?? "info" }]);
        }
      },
    );

    if (runToken.current === token) {
      setGps(outcome);
      setGpsLoading(false);
      if (outcome.ok) {
        toast.success("Venue GPS Verified", {
          description: `Distance: ${outcome.distance}m · Zone: ${session.radius}m`,
        });
      }
    }
  };

  useEffect(() => {
    if (!user?.id || !sessionId) return;
    let cancelled = false;
    (async () => {
      const records = await attendanceService.getStudentRecords(user.id);
      const existing = records.find((r) => r.sessionId === sessionId && r.status === "verified");
      if (existing && !cancelled) {
        setResult({
          score: existing.faceScore ?? 1.0,
          distance: existing.distance ?? 0,
          recordedAt: existing.verifiedAt ?? "",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, sessionId]);

  useEffect(() => {
    if (!session || result) return;
    void runLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.status, Boolean(result)]);

  if (!user) return null;

  if (!session) {
    return (
      <AppShell role="student" title="Mark Attendance">
        <ErrorState
          title="Session not found"
          description="This attendance session does not exist or has concluded."
          action={
            <Button asChild className="rounded-2xl">
              <Link to="/student/dashboard">Return to Dashboard</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const course = courseById(session.courseId);
  const sessionValid = session.status === "active";
  const isEnrolled = user.courseIds.includes(session.courseId);
  const locationDone = gps?.ok === true;

  const handleFaceCaptured = async (base64OrUri: string) => {
    if (!gps?.ok) {
      setFaceError("GPS verification must be completed first.");
      return;
    }
    if (!isEnrolled) {
      setFaceError("You are not enrolled in this course.");
      return;
    }

    setFaceProcessing(true);
    setFaceError(null);

    try {
      const image = await imageToBase64(base64OrUri);
      const network = await permissionsService.check("network");

      if (network.state !== "granted") {
        setFaceProcessing(false);
        setFaceError("Network connection required for secure biometric verification.");
        return;
      }

      const outcome = await biometricService.verify(image, user?.faceVector);
      if (!outcome.ok) {
        setFaceProcessing(false);
        setFaceError(outcome.message);
        return;
      }

      const recorded = await attendanceService.recordAttendance(session.id, {
        faceScore: outcome.score,
        lat: gps.reading.lat,
        lng: gps.reading.lng,
        gpsAccuracy: gps.reading.accuracy,
        distance: gps.distance ?? 0,
      });

      setResult({
        score: outcome.score,
        distance: recorded.distance ?? gps.distance ?? 0,
        recordedAt: recorded.recordedAt,
      });
      toast.success("Attendance Verified & Recorded");
    } catch (err) {
      setFaceError(err instanceof Error ? err.message : "Biometric verification failed.");
    } finally {
      setFaceProcessing(false);
    }
  };

  return (
    <PermissionsGate>
      <AppShell role="student" title="Attendance Check-In">
        <div className="max-w-xl mx-auto space-y-4 w-full min-w-0 max-w-full overflow-x-hidden pb-8">
          {/* iOS Standard Header Card */}
          <Card className="rounded-3xl border border-border/50 bg-card/90 backdrop-blur-md shadow-sm overflow-hidden w-full">
            <CardContent className="p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                    <Radio className="h-3 w-3 animate-pulse" />
                    <span>{course?.code ?? session.courseId}</span>
                  </div>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0",
                      sessionValid
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {sessionValid ? "Live Session" : "Ended"}
                  </span>
                </div>
                {!isEnrolled && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive shrink-0">
                    Not Enrolled
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
                  {course?.title ?? "Course Attendance"}
                </h1>
                <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
                  Topic: {session.topic}
                </p>
              </div>

              {/* Minimalist Info Row */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-center">
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-secondary/30">
                  <User className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                  <span className="text-[11px] font-semibold text-foreground truncate max-w-full">
                    {session.lecturerName.split(" ")[0]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Lecturer</span>
                </div>

                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-secondary/30">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                  <span className="text-[11px] font-semibold text-foreground truncate max-w-full">
                    {session.startTime}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Started</span>
                </div>

                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-secondary/30">
                  <Compass className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                  <span className="text-[11px] font-semibold text-foreground truncate max-w-full">
                    {session.radius}m Zone
                  </span>
                  <span className="text-[10px] text-muted-foreground">Geofence</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Futuristic 3-Stage Verification Pipeline HUD */}
          <div className="grid grid-cols-3 gap-2 w-full">
            {/* Stage 1: Session Token */}
            <div
              className={cn(
                "rounded-2xl p-2.5 text-center transition-all border",
                sessionValid
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-secondary/40 border-border/40 text-muted-foreground",
              )}
            >
              <div className="flex justify-center mb-1">
                {sessionValid ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
              </div>
              <p className="text-[11px] font-bold">1. Session</p>
              <p className="text-[9px] opacity-80">{sessionValid ? "Active" : "Invalid"}</p>
            </div>

            {/* Stage 2: GPS Geofence */}
            <div
              className={cn(
                "rounded-2xl p-2.5 text-center transition-all border relative overflow-hidden",
                locationDone
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : gpsLoading
                    ? "bg-primary/10 border-primary/40 text-primary animate-pulse"
                    : gps && !gps.ok
                      ? "bg-destructive/10 border-destructive/30 text-destructive"
                      : "bg-secondary/40 border-border/40 text-muted-foreground",
              )}
            >
              <div className="flex justify-center mb-1">
                {locationDone ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : gpsLoading ? (
                  <Satellite className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </div>
              <p className="text-[11px] font-bold">2. Geofence</p>
              <p className="text-[9px] opacity-80">
                {locationDone
                  ? `${gps.distance}m lock`
                  : gpsLoading
                    ? "Triangulating…"
                    : gps && !gps.ok
                      ? "Out of Zone"
                      : "Pending"}
              </p>
            </div>

            {/* Stage 3: Biometric Face AI */}
            <div
              className={cn(
                "rounded-2xl p-2.5 text-center transition-all border",
                result
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : faceProcessing
                    ? "bg-primary/10 border-primary/40 text-primary animate-pulse"
                    : faceError
                      ? "bg-destructive/10 border-destructive/30 text-destructive"
                      : locationDone
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-secondary/40 border-border/40 text-muted-foreground",
              )}
            >
              <div className="flex justify-center mb-1">
                {result ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : faceProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <ScanFace className="h-4 w-4" />
                )}
              </div>
              <p className="text-[11px] font-bold">3. Face AI</p>
              <p className="text-[9px] opacity-80">
                {result
                  ? "Verified"
                  : faceProcessing
                    ? "Matching…"
                    : locationDone
                      ? "Ready"
                      : "Locked"}
              </p>
            </div>
          </div>

          {/* Main Stage Content Display */}
          {result ? (
            /* Stage Completed: Digital Attendance Pass Receipt */
            <AttendanceResultCard
              success
              title="Attendance Verified"
              message={`Biometric & geofence verification confirmed for ${course?.code ?? session.courseId}.`}
              details={[
                { label: "Course", value: `${course?.code ?? session.courseId}` },
                { label: "Verification Time", value: result.recordedAt },
                { label: "Face Match Score", value: `${Math.round(result.score * 100)}%` },
                { label: "Geofence Distance", value: `${result.distance}m from lecturer` },
              ]}
              primaryAction={
                <Button
                  onClick={() => navigate({ to: "/student/dashboard" })}
                  className="w-full h-12 rounded-2xl font-semibold shadow-md bg-primary"
                >
                  Return to Dashboard
                </Button>
              }
            />
          ) : (
            <>
              {/* STAGE 2: GPS RADAR SCANNER PANEL (Tech-Savvy iOS Radar HUD) */}
              {!locationDone && (
                <Card className="rounded-3xl border border-border/50 bg-card/90 backdrop-blur-md shadow-sm overflow-hidden w-full">
                  <CardContent className="p-6 text-center space-y-4">
                    {/* Tech Radar Visualizer */}
                    <div className="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-secondary/80 border border-border/60 overflow-hidden shadow-inner">
                      {/* Concentric Radar Grid Rings */}
                      <div className="absolute h-32 w-32 rounded-full border border-dashed border-primary/20" />
                      <div className="absolute h-20 w-20 rounded-full border border-primary/30" />

                      {/* Radar Scanning Sweep Beam */}
                      {gpsLoading && (
                        <div
                          className="absolute inset-0 rounded-full border-t-2 border-primary bg-gradient-to-tr from-transparent via-primary/10 to-primary/30 animate-spin"
                          style={{ animationDuration: "2.5s" }}
                        />
                      )}

                      {/* Center Node */}
                      <div className="relative z-10 flex flex-col items-center justify-center">
                        {gpsLoading ? (
                          <Satellite className="h-6 w-6 text-primary animate-bounce" />
                        ) : gps && !gps.ok ? (
                          <ShieldAlert className="h-6 w-6 text-destructive" />
                        ) : (
                          <MapPin className="h-6 w-6 text-primary" />
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        {gpsLoading
                          ? "Calibrating Satellite Triangulation…"
                          : gps && !gps.ok
                            ? "Geofence Verification Failed"
                            : "Verifying Venue Geofence"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                        {gpsLoading
                          ? "Sampling GPS satellite fix to ensure physical presence inside the lecture hall."
                          : gps && !gps.ok
                            ? gps.message
                            : "Acquiring live GPS coordinates…"}
                      </p>
                    </div>

                    {/* Step log live telemetry ticker */}
                    {stepLog.length > 0 && (
                      <div className="rounded-2xl bg-secondary/40 border border-border/40 p-3 space-y-1 text-left max-w-sm mx-auto">
                        {stepLog.slice(-3).map((s, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[11px]">
                            {s.kind === "ok" ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            ) : s.kind === "fail" ? (
                              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                            ) : (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                            )}
                            <span
                              className={cn(
                                "truncate font-mono",
                                s.kind === "fail"
                                  ? "text-destructive"
                                  : s.kind === "ok"
                                    ? "text-foreground"
                                    : "text-muted-foreground",
                              )}
                            >
                              {s.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {gps && !gps.ok && (
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <Button
                          onClick={runLocation}
                          disabled={gpsLoading}
                          className="rounded-2xl h-11 px-5 text-xs font-semibold shadow-md bg-primary hover:bg-primary/90"
                        >
                          <RefreshCw
                            className={cn("mr-1.5 h-3.5 w-3.5", gpsLoading && "animate-spin")}
                          />
                          Retry GPS Scan
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => openLocationSettings()}
                          className="rounded-2xl h-11 px-4 text-xs font-semibold border-border/60"
                        >
                          <Settings className="mr-1.5 h-3.5 w-3.5" />
                          Location Settings
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* STAGE 3: BIOMETRIC FACE AI & LIVENESS SCANNER */}
              {locationDone && isEnrolled && (
                <Card className="rounded-3xl border border-border/50 bg-card/90 backdrop-blur-md shadow-sm overflow-hidden w-full">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <ScanFace className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground">
                            Biometric Face Verification
                          </h3>
                          <p className="text-[11px] text-muted-foreground">
                            MediaPipe Neural Mesh & Liveness
                          </p>
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[11px] font-semibold">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>GPS Locked ({gps.distance}m)</span>
                      </div>
                    </div>

                    {/* Integrated Camera + Face Landmarker + Liveness Flow */}
                    <FaceVerificationFlow
                      processing={faceProcessing}
                      onCaptureCompleted={handleFaceCaptured}
                      captureLabel="Scan Face & Mark Attendance"
                    />

                    {faceError && (
                      <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-3.5 text-xs text-destructive font-medium flex items-center gap-2.5">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{faceError}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {!isEnrolled && (
                <Card className="rounded-3xl border-destructive/30 bg-destructive/5 backdrop-blur-md p-6 text-center space-y-3">
                  <ShieldAlert className="h-8 w-8 text-destructive mx-auto" />
                  <h3 className="text-sm font-bold text-foreground">Course Enrollment Required</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    This attendance session belongs to a course you have not enrolled in yet.
                  </p>
                  <Button asChild variant="outline" size="sm" className="rounded-2xl text-xs">
                    <Link to="/student/courses">Enroll in Courses</Link>
                  </Button>
                </Card>
              )}
            </>
          )}
        </div>
      </AppShell>
    </PermissionsGate>
  );
}

