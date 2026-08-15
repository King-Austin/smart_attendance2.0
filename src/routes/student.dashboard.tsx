import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, CalendarCheck, CalendarX, Percent } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/ui/metric-card";
import { ProgressBar } from "@/components/layout/PageHeader";
import { StatusBadge, attendanceTone } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { courseById as liveCourseById } from "@/services/courseService";
import { useRoleGuard } from "@/hooks/useAuth";
import { useSessions } from "@/hooks/useSessions";
import { useStudentAttendance } from "@/hooks/useStudentAttendance";
import { useCourses } from "@/hooks/useCourses";

export const Route = createFileRoute("/student/dashboard")({
  head: () => ({
    meta: [
      { title: "Student Dashboard — Smart Campus Presence" },
      {
        name: "description",
        content: "View active attendance sessions, attendance performance and recent check-ins.",
      },
      { property: "og:title", content: "Student Dashboard — Smart Campus Presence" },
      { property: "og:description", content: "Your attendance sessions and performance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { user } = useRoleGuard("student");
  useCourses();
  const sessions = useSessions();
  const active = sessions.find((s) => s.status === "active") ?? null;
  const { records, summaries, loading } = useStudentAttendance(
    user?.id ?? "",
    user?.courseIds ?? [],
    active?.id ?? null,
  );
  const held = summaries.reduce((s, c) => s + c.held, 0);
  const attended = summaries.reduce((s, c) => s + c.attended, 0);
  const overall = held ? Math.round((attended / held) * 100) : 0;

  if (!user) return null;

  return (
    <AppShell role="student" title="Dashboard">
      <Card>
        <CardContent className="p-6">
          <h1 className="text-xl font-semibold text-foreground">Welcome, {user.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.regNumber} · {user.department} · {user.level}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Overall attendance" value={`${overall}%`} icon={Percent} />
        <MetricCard label="Courses enrolled" value={summaries.length} icon={BookOpen} />
        <MetricCard label="Sessions attended" value={attended} icon={CalendarCheck} />
        <MetricCard label="Sessions missed" value={held - attended} icon={CalendarX} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Today&apos;s active sessions</h2>
        {active ? (
          <Card>
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-foreground">
                    {liveCourseById(active.courseId)?.code ?? active.courseId} —{" "}
                    {liveCourseById(active.courseId)?.title ?? "Course"}
                  </p>
                  <StatusBadge tone="success" pulse>
                    Active
                  </StatusBadge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Topic: {active.topic}</p>
                <p className="text-sm text-muted-foreground">
                  {active.lecturerName} · Started {active.startTime} · Radius {active.radius} m
                </p>
              </div>
              <Button asChild>
                <Link to="/student/attendance/$sessionId" params={{ sessionId: active.id }}>
                  Mark Attendance
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No active session at the moment.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Course attendance breakdown</h2>
        <Card>
          <CardContent className="space-y-4 p-6">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading attendance…</p>
            ) : (
              summaries.map((s) => {
                const course = liveCourseById(s.courseId);
                const pct = s.held ? Math.round((s.attended / s.held) * 100) : 0;
                return (
                  <div key={s.courseId}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">
                        {course?.code ?? s.courseId}
                      </span>
                      <span className="text-muted-foreground">
                        {s.attended}/{s.held} · {pct}%
                      </span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={pct} label={`${course?.code ?? s.courseId} attendance`} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Recent attendance</h2>
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading recent check-ins…</p>
          ) : (
            records.slice(0, 5).map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium text-foreground">
                      {liveCourseById(r.courseId)?.code ?? r.courseId}
                    </p>
                    <p className="text-muted-foreground">
                      {r.date} {r.verifiedAt ? `· ${r.verifiedAt}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-muted-foreground">
                    <p>Face score: {r.faceScore ?? "—"}</p>
                    <p>Distance: {r.distance !== null ? `${r.distance} m` : "—"}</p>
                  </div>
                  <StatusBadge tone={attendanceTone(r.status)} className="capitalize">
                    {r.status}
                  </StatusBadge>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
