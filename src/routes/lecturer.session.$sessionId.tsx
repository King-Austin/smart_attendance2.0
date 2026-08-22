import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpDown,
  CheckCircle2,
  Clock,
  MapPin,
  Percent,
  Search,
  Square,
  Users,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge, attendanceTone } from "@/components/ui/status-badge";
import { StudentAvatar } from "@/components/ui/student-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { courseById } from "@/services/courseService";
import { attendanceService, format12Hour } from "@/services/attendanceService";
import { useRoleGuard } from "@/hooks/useAuth";
import { useSessionFeed } from "@/hooks/useSessions";
import { useCourses } from "@/hooks/useCourses";

export const Route = createFileRoute("/lecturer/session/$sessionId")({
  head: () => ({
    meta: [
      { title: "Live Session Monitor — Smart Campus Presence" },
      {
        name: "description",
        content:
          "Watch verified check-ins arrive in real time and end the attendance window when the lecture closes.",
      },
      { property: "og:title", content: "Live Session Monitor — Smart Campus Presence" },
      {
        property: "og:description",
        content: "Real-time verified attendance feed for an active geofenced session.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveSession,
});

type SortOption = "latest" | "alphabetical" | "status";

const MAX_DURATION_SECONDS = 30 * 60; // 30 minutes

function LiveSession() {
  const { user } = useRoleGuard("lecturer");
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [elapsed, setElapsed] = useState(0);
  useCourses();

  const session = attendanceService.getSession(sessionId);
  const isActive = session?.status === "active";
  const isOwner = session?.lecturerId === user?.id;
  const feed = useSessionFeed(sessionId);

  // Manual Add Student Dialog
  const [addOpen, setAddOpen] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState<
    { id: string; name: string; regNumber: string; email: string }[]
  >([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [addingLoading, setAddingLoading] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    const clock = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= MAX_DURATION_SECONDS && session) {
          // Auto-end session after 30 mins
          void attendanceService.endSession(session.id);
          toast.info("30-minute attendance window closed automatically.");
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(clock);
  }, [isActive, session]);

  // Load enrolled students for manual check-in
  useEffect(() => {
    if (!session?.courseId) return;
    void attendanceService.getEnrolledStudents(session.courseId).then(setEnrolledStudents);
  }, [session?.courseId]);

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = feed.filter((f) => {
      if (!q) return true;
      return f.name.toLowerCase().includes(q) || f.regNumber.toLowerCase().includes(q);
    });

    result = [...result].sort((a, b) => {
      if (sortBy === "alphabetical") return a.name.localeCompare(b.name);
      if (sortBy === "status") {
        if (a.status !== b.status) return a.status === "verified" ? -1 : 1;
        return a.name.localeCompare(b.name);
      }
      // default: latest check-in first
      return (b.verifiedAt || "").localeCompare(a.verifiedAt || "") || a.name.localeCompare(b.name);
    });

    return result;
  }, [feed, query, sortBy]);

  if (!user) return null;

  if (!session) {
    return (
      <AppShell role="lecturer" title="Session">
        <EmptyState
          title="Session not found"
          description="This session may have been removed."
          action={
            <Button asChild>
              <Link to="/lecturer/sessions">Back to sessions</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const verified = feed.filter((f) => f.status === "verified").length;
  const failed = feed.filter((f) => f.status === "failed").length;
  const rate = session.enrolledCount ? Math.round((verified / session.enrolledCount) * 100) : 0;

  const remainingSeconds = Math.max(0, MAX_DURATION_SECONDS - elapsed);
  const remainingStr = `${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s`;

  const endSession = async () => {
    await attendanceService.endSession(session.id);
    toast.success("Session ended. No further check-ins will be accepted.");
  };

  const handleManualAdd = async () => {
    if (!selectedStudentId) {
      toast.error("Please select a student");
      return;
    }
    const student = enrolledStudents.find((s) => s.id === selectedStudentId);
    if (!student) return;

    setAddingLoading(true);
    try {
      await attendanceService.manualRecord(
        session.id,
        {
          id: student.id,
          name: student.name,
          regNumber: student.regNumber,
          courseId: session.courseId,
          topic: session.topic,
        },
        "verified",
      );
      toast.success(`Recorded verified attendance for ${student.name}`);
      setAddOpen(false);
      setSelectedStudentId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record attendance.");
    } finally {
      setAddingLoading(false);
    }
  };

  return (
    <AppShell role="lecturer" title="Live Monitor">
      {/* Header Banner */}
      <Card className="overflow-hidden border-border/60 bg-gradient-to-r from-card via-card to-primary/5 rounded-2xl shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {courseById(session.courseId)?.code}
              </span>
              <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                {session.topic}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Started {format12Hour(session.startTime)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {session.radius}m fence
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                Live · {remainingStr} left
              </span>
            ) : (
              <StatusBadge className="px-3 py-1 text-xs">
                Ended {format12Hour(session.endTime)}
              </StatusBadge>
            )}

            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="h-8 rounded-xl px-3 text-xs font-semibold shadow-sm"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Manual Add
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-xl px-3 text-xs font-medium"
              onClick={() =>
                navigate({
                  to: "/lecturer/ledger/$sessionId",
                  params: { sessionId: session.id },
                })
              }
            >
              Ledger
            </Button>

            {isActive && isOwner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 rounded-xl px-3 text-xs font-semibold shadow-sm"
                  >
                    <Square className="mr-1.5 h-3.5 w-3.5" />
                    End Session
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>End attendance session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The session will close immediately and no further check-ins will be accepted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Keep open</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={endSession}
                      className="rounded-xl bg-destructive text-destructive-foreground"
                    >
                      End session
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {isActive && !isOwner && (
              <StatusBadge tone="info" className="px-3 py-1 text-xs">
                View-only
              </StatusBadge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metrics Row with Colored Icons */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Verified"
          value={verified}
          icon={CheckCircle2}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          iconBgClassName="bg-emerald-500/10"
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />
        <MetricCard
          label="Failed"
          value={failed}
          icon={XCircle}
          iconClassName="text-rose-600 dark:text-rose-400"
          iconBgClassName="bg-rose-500/10"
          valueClassName="text-rose-600 dark:text-rose-400"
        />
        <MetricCard
          label="Enrolled"
          value={session.enrolledCount}
          icon={Users}
          iconClassName="text-blue-600 dark:text-blue-400"
          iconBgClassName="bg-blue-500/10"
          valueClassName="text-foreground"
        />
        <MetricCard
          label="Turnout"
          value={`${rate}%`}
          icon={Percent}
          iconClassName="text-violet-600 dark:text-violet-400"
          iconBgClassName="bg-violet-500/10"
          valueClassName="text-violet-600 dark:text-violet-400"
        />
      </div>

      {/* Live Check-In Feed Toolbar */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Realtime Feed ({filteredAndSorted.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 w-44 rounded-xl pl-8 text-xs sm:w-52"
                placeholder="Search student..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-8 w-36 rounded-xl text-xs" aria-label="Sort attendance">
                <ArrowUpDown className="mr-1.5 h-3 w-3 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredAndSorted.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/70 bg-transparent">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">No check-ins yet</p>
              <p className="mt-1">
                Verified check-ins will arrive here in real time as students mark attendance.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredAndSorted.map((entry) => (
              <Card
                key={entry.id}
                className="rounded-xl border-border/60 shadow-sm transition-colors hover:bg-muted/10"
              >
                <CardContent className="flex items-center justify-between gap-3 p-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <StudentAvatar name={entry.name} size="sm" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-semibold text-foreground">{entry.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {entry.regNumber || "No Reg No"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden text-right text-[11px] text-muted-foreground sm:block">
                      <p>
                        {entry.distance}m (±{entry.gpsAccuracy}m)
                      </p>
                      <p>Score: {entry.faceScore.toFixed(2)}</p>
                    </div>

                    <span className="text-[11px] font-mono text-muted-foreground">
                      {format12Hour(entry.verifiedAt)}
                    </span>

                    <StatusBadge
                      tone={attendanceTone(entry.status)}
                      className="capitalize px-2.5 py-0.5 text-[11px]"
                    >
                      {entry.status}
                    </StatusBadge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Manual Add Student Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manual Student Check-In</DialogTitle>
            <DialogDescription>
              Mark verified attendance for an enrolled student who could not use their phone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue placeholder="Choose an enrolled student..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {enrolledStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name} ({s.regNumber || s.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleManualAdd}
              disabled={addingLoading || !selectedStudentId}
              className="rounded-xl text-xs"
            >
              {addingLoading ? "Saving..." : "Record Verified Attendance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
