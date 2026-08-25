import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  MapPin,
  PlusCircle,
  ShieldAlert,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { StatusBadge, attendanceTone } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { attendanceService, format12Hour } from "@/services/attendanceService";
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
  const relevantSessions = sessions.filter(
    (s) => user?.courseIds.includes(s.courseId) || s.lecturerId === user?.id,
  );
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
      {/* Header Banner */}
      <Card className="overflow-hidden border-border/60 bg-gradient-to-r from-card via-card to-primary/5 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-3 duration-400">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Welcome, {user.name}
            </h1>
            <p className="text-xs font-medium text-muted-foreground">
              {user.department} · Staff ID {user.staffId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user.approvalStatus === "approved" ? (
              <Button
                asChild
                size="sm"
                className="rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-transform active:scale-95"
              >
                <Link to="/lecturer/create-session">
                  <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                  New Session
                </Link>
              </Button>
            ) : (
              <StatusBadge tone="warning" className="px-3 py-1 text-xs">
                Pending Approval
              </StatusBadge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 animate-in fade-in zoom-in-95 duration-400 delay-100">
        <MetricCard
          label="Assigned"
          value={user.courseIds.length}
          icon={ClipboardList}
          iconClassName="text-blue-600 dark:text-blue-400"
          iconBgClassName="bg-blue-500/10"
          valueClassName="text-foreground"
        />
        <MetricCard
          label="Held"
          value={myPast.length}
          icon={CalendarClock}
          iconClassName="text-amber-600 dark:text-amber-400"
          iconBgClassName="bg-amber-500/10"
          valueClassName="text-foreground"
        />
        <MetricCard
          label="Avg. rate"
          value={`${avgRate}%`}
          icon={Users}
          iconClassName="text-violet-600 dark:text-violet-400"
          iconBgClassName="bg-violet-500/10"
          valueClassName="text-violet-600 dark:text-violet-400"
        />
        <MetricCard
          label="Live checks"
          value={active ? verified : 0}
          icon={Activity}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          iconBgClassName="bg-emerald-500/10"
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* Live Session Card */}
      <section className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-400 delay-150">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live Session Monitor
          </h2>
          {active ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              Broadcasting
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Idle</span>
          )}
        </div>

        {active ? (
          <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-card to-muted/20 rounded-2xl shadow-sm">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {liveCourseById(active.courseId)?.code ?? active.courseId}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">{active.topic}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Started {format12Hour(active.startTime)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {active.radius}m fence (±{active.anchor.accuracy}m)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    size="sm"
                    className="rounded-xl px-3.5 py-1.5 text-xs font-semibold shadow-sm"
                  >
                    <Link to="/lecturer/session/$sessionId" params={{ sessionId: active.id }}>
                      Live Feed
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-xl px-3.5 py-1.5 text-xs font-medium"
                  >
                    <Link to="/lecturer/ledger/$sessionId" params={{ sessionId: active.id }}>
                      Ledger
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 sm:grid-cols-4">
                <div className="text-center sm:text-left">
                  <p className="text-[11px] text-muted-foreground">Verified</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {verified}
                  </p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[11px] text-muted-foreground">Enrolled</p>
                  <p className="text-sm font-bold text-foreground">{active.enrolledCount}</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[11px] text-muted-foreground">Failed</p>
                  <p className="text-sm font-bold text-destructive">
                    {feed.filter((f) => f.status === "failed").length}
                  </p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[11px] text-muted-foreground">Turnout</p>
                  <p className="text-sm font-bold text-foreground">
                    {active.enrolledCount ? Math.round((verified / active.enrolledCount) * 100) : 0}
                    %
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border-dashed border-border/70 bg-transparent">
            <CardContent className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
              <p>No active attendance window at the moment.</p>
              {user.approvalStatus === "approved" && (
                <Button asChild size="sm" variant="link" className="mt-1 text-xs">
                  <Link to="/lecturer/create-session">Start a session now</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Recent Sessions List - iPhone Standard */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Sessions
          </h2>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs font-medium text-primary hover:bg-transparent"
          >
            <Link to="/lecturer/sessions">View all</Link>
          </Button>
        </div>

        <div className="space-y-1.5">
          {past.slice(0, 5).map((session) => {
            const present = presentCounts[session.id] ?? 0;
            return (
              <Link
                key={session.id}
                to="/lecturer/ledger/$sessionId"
                params={{ sessionId: session.id }}
                className="group block"
              >
                <Card className="rounded-xl border-border/60 shadow-xs transition-all hover:bg-muted/15 hover:border-border">
                  <CardContent className="flex items-center justify-between gap-3 p-3 text-xs">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">
                          {liveCourseById(session.courseId)?.code ?? session.courseId}
                        </span>
                        {session.topic && (
                          <span className="truncate text-muted-foreground">· {session.topic}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                        <span className="truncate">
                          {session.date} · {format12Hour(session.startTime)}
                          {session.endTime ? ` – ${format12Hour(session.endTime)}` : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Users className="h-3 w-3" />
                        <span>{present}</span>
                        <span className="text-emerald-600/60 dark:text-emerald-400/60">
                          /{session.enrolledCount}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Courses Assigned */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Teaching Courses
        </h2>
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="flex flex-wrap gap-2 p-4">
            {courses
              .filter((c) => user.courseIds.includes(c.id))
              .map((course) => (
                <span
                  key={course.id}
                  className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                >
                  {course.code}
                  <span className="text-[11px] font-normal text-muted-foreground">
                    ({course.title})
                  </span>
                </span>
              ))}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
