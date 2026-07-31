import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/layout/PageHeader";
import { CameraCaptureMock } from "@/components/verification/CameraCaptureMock";
import { LocationVerificationPanel } from "@/components/verification/LocationVerificationPanel";
import { VerificationStepIndicator } from "@/components/verification/VerificationStepIndicator";
import type { StepState } from "@/components/verification/VerificationStepIndicator";
import { AttendanceResultCard } from "@/components/verification/AttendanceResultCard";
import { attendanceService } from "@/services/attendanceService";
import { locationService } from "@/services/locationService";
import type { LocationOutcome } from "@/services/locationService";
import { biometricService } from "@/services/biometricService";
import { courseById } from "@/data/mockData";
import { useRoleGuard } from "@/hooks/useAuth";

export const Route = createFileRoute("/student/attendance/$sessionId")({
  head: () => ({
    meta: [
      { title: "Mark Attendance — Smart Campus Presence" },
      {
        name: "description",
        content:
          "Complete location and facial verification to record attendance for an active session.",
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
  const session = attendanceService.getSession(sessionId);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gps, setGps] = useState<LocationOutcome | null>(null);
  const [captured, setCaptured] = useState(false);
  const [faceProcessing, setFaceProcessing] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    score: number;
    distance: number;
    recordedAt: string;
  } | null>(null);

  const runLocation = async () => {
    if (!session) return;
    setGps(null);
    setGpsLoading(true);
    const outcome = await locationService.acquire(session.anchor, session.radius);
    setGps(outcome);
    setGpsLoading(false);
  };

  useEffect(() => {
    void runLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (!user) return null;

  if (!session) {
    return (
      <AppShell role="student" title="Mark Attendance">
        <ErrorState
          title="Session not found"
          description="This attendance session does not exist."
          action={
            <Button asChild>
              <Link to="/student/dashboard">Return to dashboard</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const course = courseById(session.courseId);
  const sessionValid = session.status === "active";
  const locationDone = gps?.ok === true;

  const steps: { label: string; state: StepState }[] = [
    { label: "Session validation", state: sessionValid ? "done" : "failed" },
    {
      label: "Location verification",
      state: gpsLoading
        ? "active"
        : gps
          ? gps.ok
            ? "done"
            : "failed"
          : "pending",
    },
    {
      label: "Facial verification",
      state: result
        ? "done"
        : faceError
          ? "failed"
          : faceProcessing
            ? "active"
            : locationDone
              ? "pending"
              : "pending",
    },
  ];

  const submitFace = async () => {
    if (!gps?.ok) return;
    setFaceProcessing(true);
    setFaceError(null);
    const outcome = await biometricService.verify();
    if (!outcome.ok) {
      setFaceProcessing(false);
      setFaceError(outcome.message);
      setCaptured(false);
      return;
    }
    try {
      const recorded = await attendanceService.recordAttendance(session.id, {
        faceScore: outcome.score,
        distance: gps.distance,
      });
      setResult({ score: outcome.score, distance: gps.distance, recordedAt: recorded.recordedAt });
    } catch (err) {
      setFaceError(err instanceof Error ? err.message : "Verification could not be completed.");
    } finally {
      setFaceProcessing(false);
    }
  };

  return (
    <AppShell role="student" title="Mark Attendance">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">
              {course?.code} — {course?.title}
            </h1>
            <StatusBadge tone={sessionValid ? "success" : "warning"} pulse={sessionValid}>
              {sessionValid ? "Active" : "Ended"}
            </StatusBadge>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Lecturer</dt>
              <dd className="font-medium text-foreground">{session.lecturerName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Topic</dt>
              <dd className="font-medium text-foreground">{session.topic}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Start time</dt>
              <dd className="font-medium text-foreground">{session.startTime}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Allowed radius</dt>
              <dd className="font-medium text-foreground">{session.radius} m</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <VerificationStepIndicator steps={steps} />
        </CardContent>
      </Card>

      {result ? (
        <AttendanceResultCard
          success
          title="Attendance verified successfully"
          message={`Your attendance for ${course?.code} has been recorded by the verification server.`}
          details={[
            { label: "Course", value: `${course?.code}` },
            { label: "Verification time", value: result.recordedAt },
            { label: "Face similarity score", value: result.score.toFixed(2) },
            { label: "Distance from anchor", value: `${result.distance} m` },
          ]}
          primaryAction={
            <Button onClick={() => navigate({ to: "/student/dashboard" })}>
              Return to dashboard
            </Button>
          }
        />
      ) : (
        <>
          <LocationVerificationPanel
            radius={session.radius}
            loading={gpsLoading}
            outcome={gps}
          />

          {gps && !gps.ok && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={runLocation}>
                Retry Verification
              </Button>
            </div>
          )}

          {locationDone && (
            <Card>
              <CardContent className="space-y-4 p-6">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Facial verification</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your image is sent to the verification server. Matching happens server-side.
                  </p>
                </div>
                <CameraCaptureMock
                  captured={captured}
                  processing={faceProcessing}
                  onCapture={() => setCaptured(true)}
                  onRetake={() => setCaptured(false)}
                />
                {captured && !faceProcessing && (
                  <Button className="w-full" onClick={submitFace}>
                    Submit for verification
                  </Button>
                )}
                {faceError && <ErrorState title="Verification failed" description={faceError} />}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}
