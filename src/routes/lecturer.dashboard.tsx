import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, CalendarClock, ClipboardList, PlusCircle, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { StatusBadge, attendanceTone } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { attendanceService } from "@/services/attendanceService";
import { courseById as liveCourseById } from "@/services/courseService";
import { useRoleGuard } from "@/hooks/useAuth";
import { useSessions } from "@/hooks/useSessions";
import { usePresentCounts } from "@/hooks/usePresentCounts";
import { useCourses } from "@/hooks/useCourses";

export const Route = createFileRoute("/lecturer/dashboard")({
  head: () => ({
    meta: [
      { title: "Lecturer Dashboard — Smart Campus Presence" },
      {
        name: "description",
        content:
          "Monitor your active attendance session, recent sessions and verified check-in counts.",
      },
      { property: "og:title", content: "Lecturer Dashboard — Smart Campus Presence" },
      {
        property: "og:description",
        content: "Create geofenced sessions and monitor verified attendance in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LecturerDashboard,
});

function LecturerDashboard() {
  const { user } = useRoleGuard("lecturer");
  const sessions = useSessions();
  const { courses } = useCourses();
  const relevantSessions = sessions.filter((s) => user?.courseIds.includes(s.courseId));
  const active = relevantSessions.find((s) => s.status === "active" && s.lecturerId === user?.id);
  const past = relevantSessions.filter((s) => s.status === "ended");
  const myPast = past.filter((s) => s.lecturerId === user?.id);
  const feed = active ? attendanceService.getFeed(active.id) : [];
  const verified = feed.filter((f) => f.status === "verified").length;
  const presentCounts = usePresentCounts(myPast.map((s) => s.id));
  const totalPresent = myPast.reduce((sum, s) => sum + (presentCounts[s.id] ?? 0), 0);
  const totalEnrolled = myPast.reduce((sum, s) => sum + s.enrolledCount, 0);
  const avgRate = totalEnrolled ? Math.round((totalPresent / totalEnrolled) * 100) : 0;

  if (!user) return null;

  return (
    <AppShell role="lecturer" title="Dashboard">
      <PageHeader
        title={`Welcome, ${user.name}`}
        description={`${user.department} · Staff ID ${user.staffId}`}
        actions={
          user.approvalStatus === "approved" ? (
            <Button asChild>
              <Link to="/lecturer/create-session">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create session
              </Link>
            </Button>
          ) : (
            <StatusBadge tone="warning">Pending Approval</StatusBadge>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Courses assigned" value={user.courseIds.length} icon={ClipboardList} />
        <MetricCard label="Sessions held" value={myPast.length} icon={CalendarClock} />
        <MetricCard
          label="Average attendance"
          value={`${avgRate}%`}
          hint="Across completed sessions"
          icon={Users}
        />
        <MetricCard
          label="Live check-ins"
          value={active ? verified : 0}
          hint={active ? "Current session" : "No active session"}
          icon={Activity}
        />
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Active session</h2>
            {active ? (
              <StatusBadge tone="success" pulse>
                Live
              </StatusBadge>
            ) : (
              <StatusBadge>Idle</StatusBadge>
            )}
          </div>

          {active ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-base font-semibold text-foreground">
                  {liveCourseById(active.courseId)?.code ?? active.courseId} — {active.topic}
                </p>
                <p className="text-xs text-muted-foreground">
                  Session {active.id} · started {active.startTime} · radius {active.radius} m
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Verified</dt>
                  <dd className="font-medium text-foreground">{verified}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Enrolled</dt>
                  <dd className="font-medium text-foreground">{active.enrolledCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Failed attempts</dt>
                  <dd className="font-medium text-foreground">
                    {feed.filter((f) => f.status === "failed").length}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Anchor accuracy</dt>
                  <dd className="font-medium text-foreground">{active.anchor.accuracy} m</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/lecturer/session/$sessionId" params={{ sessionId: active.id }}>
                    Open live monitor
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/lecturer/ledger/$sessionId" params={{ sessionId: active.id }}>
                    View ledger
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No active session"
                description={
                  user.approvalStatus === "approved" 
                    ? "Create a session to open a geofenced check-in window for your class."
                    : "Your account is pending approval. You cannot create sessions yet."
                }
                action={
                  user.approvalStatus === "approved" ? (
                    <Button asChild>
                      <Link to="/lecturer/create-session">Create session</Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Recent sessions</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/lecturer/sessions">View all</Link>
            </Button>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {past.slice(0, 5).map((session) => {
              const present = presentCounts[session.id] ?? 0;
              return (
                <li key={session.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {liveCourseById(session.courseId)?.code ?? session.courseId} — {session.topic}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.date} · {session.startTime}
                      {session.endTime ? `–${session.endTime}` : ""} · by {session.lecturerName}
                    </p>
                  </div>
                  <StatusBadge tone={attendanceTone(session.status)}>
                    {present}/{session.enrolledCount} verified
                  </StatusBadge>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/lecturer/ledger/$sessionId" params={{ sessionId: session.id }}>
                      Ledger
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold text-foreground">Your courses</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {courses
              .filter((c) => user.courseIds.includes(c.id))
              .map((course) => (
                <StatusBadge key={course.id} tone="info">
                  {course.code}
                </StatusBadge>
              ))}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
