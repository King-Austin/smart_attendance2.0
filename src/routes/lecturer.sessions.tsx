import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Clock, PlusCircle, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { attendanceService, format12Hour } from "@/services/attendanceService";
import { courseById as liveCourseById } from "@/services/courseService";
import { useRoleGuard } from "@/hooks/useAuth";
import { useSessions } from "@/hooks/useSessions";
import { usePresentCounts } from "@/hooks/usePresentCounts";
import { useCourses } from "@/hooks/useCourses";

export const Route = createFileRoute("/lecturer/sessions")({
  head: () => ({
    meta: [
      { title: "Session History — Smart Campus Presence" },
      {
        name: "description",
        content: "Review every attendance session you have held, with verified counts per course.",
      },
      { property: "og:title", content: "Session History — Smart Campus Presence" },
      {
        property: "og:description",
        content: "Filter past attendance sessions and open their verification ledgers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LecturerSessions,
});

function LecturerSessions() {
  const { user } = useRoleGuard("lecturer");
  const sessions = useSessions();
  const { courses } = useCourses();
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const relevant = sessions.filter(
    (s) => user?.courseIds.includes(s.courseId) || s.lecturerId === user?.id,
  );
  const presentCounts = usePresentCounts(relevant.map((s) => s.id));

  if (!user) return null;

  const isPending = user.approvalStatus === "pending";
  const courseOptions = courses.filter((c) => user.courseIds.includes(c.id));

  const filtered = relevant.filter((s) => {
    if (courseFilter !== "all" && s.courseId !== courseFilter) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    return true;
  });

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    setDeleting(true);
    try {
      await attendanceService.deleteSession(sessionToDelete.id);
      toast.success("Attendance session deleted");
      setSessionToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete session.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell role="lecturer" title="Sessions">
      <PageHeader
        title="Attendance Sessions"
        description="Review every lecture session, check-in turnout, and full verification ledgers."
        actions={
          isPending ? (
            <Button
              size="sm"
              disabled
              className="rounded-xl px-4 py-2 text-xs font-semibold shadow-sm opacity-60 cursor-not-allowed"
            >
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              Create session
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              className="rounded-xl px-4 py-2 text-xs font-semibold shadow-sm"
            >
              <Link to="/lecturer/create-session">
                <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                Create session
              </Link>
            </Button>
          )
        }
      />

      <Card className="rounded-2xl border-border/60 shadow-sm mb-4">
        <CardContent className="flex flex-wrap gap-2.5 p-3.5">
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="w-52 rounded-xl text-xs" aria-label="Filter by course">
              <SelectValue placeholder="All courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {courseOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 rounded-xl text-xs" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="No sessions match these filters"
          description="Adjust the course or status filter to see more results."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((session) => {
            const present =
              session.status === "active"
                ? attendanceService.getFeed(session.id).filter((f) => f.status === "verified")
                    .length
                : (presentCounts[session.id] ?? 0);
            const courseCode = liveCourseById(session.courseId)?.code ?? session.courseId;
            return (
              <div
                key={session.id}
                className="group relative flex items-center justify-between rounded-xl border border-border/60 bg-card p-3.5 shadow-2xs transition-all hover:bg-muted/15 hover:border-border"
              >
                <Link
                  to="/lecturer/ledger/$sessionId"
                  params={{ sessionId: session.id }}
                  className="flex-1 min-w-0 pr-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">{courseCode}</span>
                      {session.topic && (
                        <span className="truncate text-muted-foreground">· {session.topic}</span>
                      )}
                      {session.status === "active" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          Live
                        </span>
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
                </Link>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Users className="h-3 w-3" />
                    <span>{present}</span>
                    <span className="text-emerald-600/60 dark:text-emerald-400/60">
                      /{session.enrolledCount}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSessionToDelete({
                        id: session.id,
                        title: `${courseCode} (${session.topic || session.date})`,
                      });
                    }}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                    title="Delete session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <Link
                    to="/lecturer/ledger/$sessionId"
                    params={{ sessionId: session.id }}
                    className="text-muted-foreground/50 hover:text-foreground transition-transform group-hover:translate-x-0.5"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Session Confirmation Dialog */}
      <AlertDialog
        open={!!sessionToDelete}
        onOpenChange={(open) => !open && setSessionToDelete(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Delete Attendance Session?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Permanently delete{" "}
              <strong className="text-foreground">{sessionToDelete?.title}</strong> and all student
              check-in records associated with it? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row items-center justify-end gap-2 pt-2">
            <AlertDialogCancel className="rounded-xl text-xs mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold"
            >
              {deleting ? "Deleting..." : "Delete Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
