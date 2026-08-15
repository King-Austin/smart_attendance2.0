import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, ErrorState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { useRoleGuard } from "@/hooks/useAuth";
import { useCourses } from "@/hooks/useCourses";
import { DEPARTMENTS, SEMESTERS, LEVELS } from "@/data/constants";
import type { AttendanceSession } from "@/types";

/** Radius is fixed by campus policy; lecturers only see the enforced range. */
const FIXED_RADIUS = 75;
const RADIUS_RANGE = "75–100 m";

export const Route = createFileRoute("/lecturer/create-session")({
  head: () => ({
    meta: [
      { title: "Create Attendance Session — Smart Campus Presence" },
      {
        name: "description",
        content:
          "Open a geofenced attendance session anchored to your current location for a selected course.",
      },
      { property: "og:title", content: "Create Attendance Session — Smart Campus Presence" },
      {
        property: "og:description",
        content: "Anchor a session to your lecture venue and start verified check-ins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateSession,
});

function CreateSession() {
  const { user } = useRoleGuard("lecturer");
  const { courses, loading } = useCourses();
  const navigate = useNavigate();
  const [department, setDepartment] = useState(user?.department ?? DEPARTMENTS[0]);
  const [semester, setSemester] = useState(SEMESTERS[0]);
  const [level, setLevel] = useState(LEVELS[0]);
  const options = courses.filter((c) => c.department === department && c.semester === semester && c.level === level);
  const [courseId, setCourseId] = useState(options[0]?.id ?? "");

  // Update selected course if options change and current is invalid
  if (options.length > 0 && !options.find((c) => c.id === courseId)) {
    setCourseId(options[0].id);
  } else if (options.length === 0 && courseId !== "") {
    setCourseId("");
  }
  const [topic, setTopic] = useState("");
  const [note, setNote] = useState("");
  const [anchor, setAnchor] = useState<LocationReading | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AttendanceSession | null>(null);

  if (!user) return null;

  const captureAnchor = async () => {
    setCapturing(true);
    setError(null);
    try {
      const reading = await locationService.captureAnchor();
      setAnchor(reading);
      toast.success("Venue location captured");
    } catch {
      setError("Could not capture your location. Check that location access is enabled.");
    } finally {
      setCapturing(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!topic.trim()) return setError("Enter the lecture topic for this session.");
    if (!anchor) return setError("Capture the venue location before starting the session.");
    if (!courseId) return setError("Select a course for this session.");
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
      setCreated(session);
      toast.success("Session is live. Students can now check in.");
    } catch {
      setError("The session could not be created. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  if (created) {
    const course = courseById(created.courseId);
    return (
      <AppShell role="lecturer" title="Session Created">
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden />
            <h1 className="mt-4 text-xl font-semibold text-foreground">Session is live</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {course?.code} — {created.topic}. Students inside the geofence can now complete
              liveness and facial verification.
            </p>
            <dl className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-4 text-left">
              <div className="rounded-lg bg-muted px-3 py-2">
                <dt className="text-xs text-muted-foreground">Session ID</dt>
                <dd className="font-mono text-sm font-medium text-foreground">{created.id}</dd>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <dt className="text-xs text-muted-foreground">Start time</dt>
                <dd className="text-sm font-medium text-foreground">{created.startTime}</dd>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <dt className="text-xs text-muted-foreground">Enforced radius</dt>
                <dd className="text-sm font-medium text-foreground">{created.radius} m</dd>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <dt className="text-xs text-muted-foreground">Anchor accuracy</dt>
                <dd className="text-sm font-medium text-foreground">{created.anchor.accuracy} m</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button
                onClick={() =>
                  navigate({
                    to: "/lecturer/session/$sessionId",
                    params: { sessionId: created.id },
                  })
                }
              >
                Open live monitor
              </Button>
              <Button asChild variant="outline">
                <Link to="/lecturer/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell role="lecturer" title="Create Session">
      <PageHeader
        title="Create attendance session"
        description="The session is anchored to your current location. Only students inside the enforced radius can check in."
      />

      {user.approvalStatus !== "approved" ? (
        <Card className="border-warning bg-warning/10">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold text-warning-foreground">Account Pending Approval</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your lecturer account is currently under review by the administration. You will be able to create attendance sessions once your staff ID and department are verified.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger aria-label="Department">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Semester</Label>
                  <Select value={semester} onValueChange={setSemester}>
                    <SelectTrigger aria-label="Semester">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEMESTERS.map((sem) => (
                        <SelectItem key={sem} value={sem}>
                          {sem}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Level</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger aria-label="Level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((lvl) => (
                        <SelectItem key={lvl} value={lvl}>
                          {lvl}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Course</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger aria-label="Course">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {loading ? (
                      <SelectItem value="loading" disabled>
                        Loading courses…
                      </SelectItem>
                    ) : options.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No courses found
                      </SelectItem>
                    ) : (
                      options.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.code} — {course.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="topic">Lecture topic</Label>
                <Input
                  id="topic"
                  placeholder="State-Space Representation"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="note">Note to students (optional)</Label>
                <Textarea
                  id="note"
                  rows={3}
                  placeholder="Check in within the first 15 minutes."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="rounded-xl border border-border bg-secondary/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Attendance radius</p>
                  <StatusBadge tone="info">{RADIUS_RANGE} enforced</StatusBadge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  The radius is fixed by campus policy at {FIXED_RADIUS} m and is not adjustable.
                  Readings between {RADIUS_RANGE} are accepted by the server depending on GPS
                  accuracy at the venue.
                </p>
              </div>

              <div className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" aria-hidden />
                    <p className="text-sm font-semibold text-foreground">Venue anchor</p>
                  </div>
                  {anchor ? (
                    <StatusBadge tone="success">Captured</StatusBadge>
                  ) : (
                    <StatusBadge>Not captured</StatusBadge>
                  )}
                </div>
                {anchor ? (
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    lat {anchor.lat.toFixed(6)} · lng {anchor.lng.toFixed(6)} · accuracy{" "}
                    {anchor.accuracy} m
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Capture the location while standing inside the lecture venue.
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={captureAnchor}
                  disabled={capturing}
                >
                  {capturing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {anchor ? "Re-capture location" : "Capture current location"}
                </Button>
              </div>

              {error && <ErrorState title="Please review" description={error} />}

              <Button type="submit" className="w-full" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start session
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <GeofencePreview radius={FIXED_RADIUS} accuracy={anchor?.accuracy} />
          <Card>
            <CardContent className="p-5 text-xs text-muted-foreground">
              Creating a new session automatically ends any session you still have running.
              Verification decisions — geofence, liveness and face match — are always made by the
              server, never on the student's device.
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </AppShell>
  );
}
