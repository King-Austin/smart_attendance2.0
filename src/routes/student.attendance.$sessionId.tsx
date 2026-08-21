import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppShell } from "@/components/layout/AppShell";
import { PermissionsGate } from "@/components/permissions/PermissionsGate";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/layout/PageHeader";
import { CameraCaptureMock } from "@/components/verification/CameraCaptureMock";
import { LivenessChallenge } from "@/components/verification/LivenessChallenge";
import { LocationVerificationPanel } from "@/components/verification/LocationVerificationPanel";
import { VerificationStepIndicator } from "@/components/verification/VerificationStepIndicator";
import type { StepState } from "@/components/verification/VerificationStepIndicator";
import { AttendanceResultCard } from "@/components/verification/AttendanceResultCard";
import { attendanceService } from "@/services/attendanceService";
import { locationService } from "@/services/locationService";
import type { LocationOutcome, StepKind } from "@/services/locationService";
import { biometricService, imageToBase64 } from "@/services/biometricService";
import { permissionsService } from "@/services/permissionsService";
import { courseById } from "@/services/courseService";
import { useRoleGuard } from "@/hooks/useAuth";
import { useSessions } from "@/hooks/useSessions";
import { useCourses } from "@/hooks/useCourses";

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
  useCourses();
  const sessions = useSessions();
  const session = sessions.find((s) => s.id === sessionId);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gps, setGps] = useState<LocationOutcome | null>(null);
  const [stepLog, setStepLog] = useState<{ text: string; kind: StepKind }[]>([]);
  const [live, setLive] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [captureUri, setCaptureUri] = useState<string | null>(null);
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
    // Ignore overlapping runs (e.g. effect re-firing) so a stale scan can't
    // interleave with the current one or clobber its result.
    const token = ++runToken.current;
    setGps(null);
    setStepLog([]);
    setGpsLoading(true);
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
    }
  };

  useEffect(() => {
    if (!session) return;
    void runLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.status]);

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
  const isEnrolled = user.courseIds.includes(session.courseId);
  const locationDone = gps?.ok === true;

  const steps: { label: string; state: StepState }[] = [
    { label: "Session validation", state: sessionValid ? "done" : "failed" },
    {
      label: "Location verification",
      state: gpsLoading ? "active" : gps ? (gps.ok ? "done" : "failed") : "pending",
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
    if (!isEnrolled) {
      setFaceError("You are not enrolled in this course, so attendance cannot be recorded.");
      return;
    }
    setFaceProcessing(true);
    setFaceError(null);
    try {
      const image = captureUri ? await imageToBase64(captureUri) : undefined;
      const network = await permissionsService.check("network");

      if (network.state !== "granted") {
        setFaceProcessing(false);
        setFaceError("You must be online to verify face and record legally binding attendance.");
        return;
      }

      const outcome = await biometricService.verify(image, user?.faceVector);
      if (!outcome.ok) {
        setFaceProcessing(false);
        setFaceError(outcome.message);
        setCaptured(false);
        setCaptureUri(null);
        setLive(false);
        return;
      }
      try {
        const recorded = await attendanceService.recordAttendance(session.id, {
          faceScore: outcome.score,
          distance: gps.distance ?? 0,
          gpsAccuracy: gps.reading.accuracy,
        });
        setResult({
          score: outcome.score,
          distance: gps.distance ?? 0,
          recordedAt: recorded.recordedAt,
        });
      } catch (err) {
        setFaceError(err instanceof Error ? err.message : "Verification could not be completed.");
      } finally {
        setFaceProcessing(false);
      }
    } catch (err) {
      setFaceProcessing(false);
      setFaceError(err instanceof Error ? err.message : "Verification could not be completed.");
    }
  };

  return (
    <PermissionsGate>
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
              {!isEnrolled && <StatusBadge tone="danger">Not enrolled</StatusBadge>}
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
              steps={stepLog}
            />

            {gps && !gps.ok && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={runLocation}>
                  Retry Verification
                </Button>
              </div>
            )}

            {!isEnrolled && (
              <ErrorState
                title="Course enrollment required"
                description="This attendance session belongs to a course you have not enrolled in."
              />
            )}

            {locationDone && isEnrolled && (
              <Card>
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Facial verification</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Your image is sent to the verification server. Matching happens server-side.
                    </p>
                  </div>
                  {live ? (
                    <CameraCaptureMock
                      captured={captured}
                      processing={faceProcessing}
                      onCapture={(uri) => {
                        setCaptureUri(uri);
                        setCaptured(true);
                      }}
                      onRetake={() => {
                        setCaptureUri(null);
                        setCaptured(false);
                      }}
                    />
                  ) : (
                    <LivenessChallenge onPassed={() => setLive(true)} />
                  )}
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
    </PermissionsGate>
  );
}
