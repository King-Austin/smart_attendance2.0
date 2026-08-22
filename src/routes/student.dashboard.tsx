import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  Clock,
  MapPin,
  Percent,
  User,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge, attendanceTone } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { courseById as liveCourseById } from "@/services/courseService";
import { format12Hour } from "@/services/attendanceService";
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

  const activeRecord = active
    ? records.find((r) => r.sessionId === active.id && r.status === "verified")
    : null;
  const isSigned = Boolean(activeRecord);

  if (!user) return null;

  return (
    <AppShell role="student" title="Dashboard">
      {/* Header Profile Summary */}
      <Card className="overflow-hidden border-border/60 bg-gradient-to-r from-card via-card to-primary/5 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-3 duration-400">
        <CardContent className="flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Hi, {user.name}
            </h1>
            <p className="text-xs font-medium text-muted-foreground">
              {user.regNumber} · {user.department} ({user.level})
            </p>
          </div>
          <span className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground sm:mt-0 sm:self-auto shadow-2xs">
            <Clock className="h-3 w-3" />
            {new Date().toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>
        </CardContent>
      </Card>

      {/* Metrics Row with standard colors and icons */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 animate-in fade-in zoom-in-95 duration-400 delay-100">
        <MetricCard
          label="Attendance rate"
          value={`${overall}%`}
          icon={Percent}
          iconClassName="text-violet-600 dark:text-violet-400"
          iconBgClassName="bg-violet-500/10"
          valueClassName="text-violet-600 dark:text-violet-400"
        />
        <MetricCard
          label="Enrolled"
          value={summaries.length}
          icon={BookOpen}
          iconClassName="text-blue-600 dark:text-blue-400"
          iconBgClassName="bg-blue-500/10"
          valueClassName="text-foreground"
        />
        <MetricCard
          label="Attended"
          value={attended}
          icon={CalendarCheck}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          iconBgClassName="bg-emerald-500/10"
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />
        <MetricCard
          label="Missed"
          value={held - attended}
          icon={CalendarX}
          iconClassName="text-rose-600 dark:text-rose-400"
          iconBgClassName="bg-rose-500/10"
          valueClassName="text-rose-600 dark:text-rose-400"
        />
      </div>

      {/* Active Session - iPhone standard clean card */}
      <section className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-400 delay-150">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live Session
          </h2>
          {active && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              Active Now
            </span>
          )}
        </div>

        {active ? (
          <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-card to-muted/25 shadow-sm rounded-2xl transition-all duration-200 hover:shadow-md active:scale-[0.99]">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {liveCourseById(active.courseId)?.code ?? active.courseId}
                    </span>
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {liveCourseById(active.courseId)?.title ?? "Course"}
                    </h3>
                  </div>

                  {active.topic && (
                    <p className="truncate text-xs text-muted-foreground">{active.topic}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground/90">
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground/70" />
                      {active.lecturerName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground/70" />
                      {format12Hour(active.startTime)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground/70" />
                      {active.radius}m
                    </span>
                  </div>
                </div>

                <div className="sm:self-center">
                  {isSigned ? (
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-2xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Signed{" "}
                      {activeRecord?.verifiedAt ? `· ${format12Hour(activeRecord.verifiedAt)}` : ""}
                    </div>
                  ) : (
                    <Button
                      asChild
                      size="sm"
                      className="rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-transform active:scale-95"
                    >
                      <Link to="/student/attendance/$sessionId" params={{ sessionId: active.id }}>
                        Mark Attendance
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border-dashed border-border/70 bg-transparent">
            <CardContent className="flex items-center justify-center p-6 text-xs text-muted-foreground">
              No active attendance session right now.
            </CardContent>
          </Card>
        )}
      </section>

      {/* Course Performance - Compact iPhone Standard Grid */}
      <section className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-400 delay-200">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Course Performance ({summaries.length})
        </h2>
        {loading ? (
          <Card className="rounded-2xl border-border/60 p-4">
            <p className="text-xs text-muted-foreground">Loading performance…</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {summaries.map((s) => {
              const course = liveCourseById(s.courseId);
              const pct = s.held ? Math.round((s.attended / s.held) * 100) : 0;
              return (
                <Card
                  key={s.courseId}
                  className="rounded-2xl border-border/60 bg-card p-3 shadow-2xs transition-all duration-200 hover:border-primary/40 hover:shadow-xs active:scale-[0.97]"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-bold text-foreground">
                      {course?.code ?? s.courseId}
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        pct >= 75
                          ? "text-emerald-600 dark:text-emerald-400"
                          : pct >= 50
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {pct}%
                    </span>
                  </div>

                  <div className="my-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                    <span>
                      {s.attended}/{s.held} attended
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Records List */}
      <section className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-400 delay-250">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Check-Ins
        </h2>
        <div className="space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading history…</p>
          ) : records.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-border/70 bg-transparent">
              <CardContent className="p-6 text-center text-xs text-muted-foreground">
                No check-in history yet.
              </CardContent>
            </Card>
          ) : (
            records.slice(0, 5).map((r) => (
              <Card
                key={r.id}
                className="rounded-2xl border-border/60 bg-card shadow-2xs transition-all duration-200 hover:border-border active:scale-[0.99]"
              >
                <CardContent className="flex items-center justify-between gap-3 p-3.5 text-xs">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-bold text-foreground">
                      {liveCourseById(r.courseId)?.code ?? r.courseId}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.date} {r.verifiedAt ? `· ${format12Hour(r.verifiedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      tone={attendanceTone(r.status)}
                      className="capitalize px-2.5 py-0.5 text-[11px] font-semibold"
                    >
                      {r.status}
                    </StatusBadge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
