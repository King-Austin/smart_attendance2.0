import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Loader2, Plus, Search, Trash2, BookOpen, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { courseById as liveCourseById, updateUserCourses } from "@/services/courseService";
import { useRoleGuard } from "@/hooks/useAuth";
import { useStudentAttendance } from "@/hooks/useStudentAttendance";
import { useSessions } from "@/hooks/useSessions";
import { useCourses } from "@/hooks/useCourses";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { Course, StudentProfile } from "@/types";

export const Route = createFileRoute("/student/courses")({
  head: () => ({
    meta: [
      { title: "My Courses — Smart Attendance" },
      {
        name: "description",
        content:
          "Registered courses with sessions held, sessions attended and attendance percentage.",
      },
      { property: "og:title", content: "My Courses — Smart Attendance" },
      { property: "og:description", content: "Your registered courses and attendance rates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentCourses,
});

function StudentCourses() {
  const { user } = useRoleGuard("student");
  const { refreshUser } = useAuth();
  const sessions = useSessions();
  const active = sessions.find((s) => s.status === "active") ?? null;
  const { summaries, loading } = useStudentAttendance(
    user?.id ?? "",
    user?.courseIds ?? [],
    active?.id ?? null,
  );
  useCourses();
  const [manageOpen, setManageOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  if (!user) return null;

  const refreshAfterSave = async (message: string) => {
    await refreshUser();
    toast.success(message);
  };

  const handleRemove = async (courseId: string) => {
    if (!user) return;
    setRemoving(courseId);
    try {
      await updateUserCourses(
        user.id,
        user.courseIds.filter((id) => id !== courseId),
      );
      await refreshAfterSave("Course removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the course.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <AppShell role="student" title="Courses">
      {/* Compact iOS-Style Header Bar */}
      <div className="flex items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
            Registered Courses
          </h1>
          <p className="text-[11px] font-medium text-muted-foreground">
            {summaries.length} enrolled {summaries.length === 1 ? "course" : "courses"} ·{" "}
            {user.department}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setManageOpen(true)}
          className="h-8 rounded-xl px-3 text-xs font-semibold shadow-sm"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Courses
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
          Loading enrolled courses…
        </div>
      ) : summaries.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/70 bg-card/40">
          <CardContent className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
            <BookOpen className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="font-semibold text-foreground text-sm">No enrolled courses</p>
            <p className="mt-1 text-[11px] max-w-xs">
              Add courses matching {user.department} ({user.level}) to track and verify attendance.
            </p>
            <Button
              size="sm"
              onClick={() => setManageOpen(true)}
              className="mt-3.5 h-8 rounded-xl text-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Courses
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {summaries.map((s) => {
            const course = liveCourseById(s.courseId);
            const pct = s.held ? Math.round((s.attended / s.held) * 100) : 0;
            const isGood = pct >= 75;
            const isWarning = pct >= 50 && pct < 75;

            return (
              <Card
                key={s.courseId}
                className="group relative overflow-hidden rounded-2xl border-border/50 bg-card p-3.5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex flex-col gap-2.5">
                  {/* Top Row: Course Code Chip + Title + Remove Button */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="shrink-0 inline-flex items-center justify-center rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-bold font-mono text-primary border border-primary/20">
                        {course?.code ?? s.courseId}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-xs font-bold text-foreground leading-snug">
                          {course?.title ?? "Course"}
                        </h3>
                        <p className="text-[10.5px] font-medium text-muted-foreground mt-0.5">
                          {course?.creditUnit ?? 3} Credit Units ·{" "}
                          {course?.department ?? user.department}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold border",
                          isGood
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : isWarning
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                        )}
                      >
                        {pct}%
                      </span>
                      <RemoveCourseButton
                        courseId={s.courseId}
                        courseCode={course?.code ?? s.courseId}
                        removing={removing === s.courseId}
                        onRemove={() => handleRemove(s.courseId)}
                      />
                    </div>
                  </div>

                  {/* Attendance Progress & Stats */}
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-muted-foreground">
                        <strong className="text-foreground font-semibold">{s.attended}</strong> of{" "}
                        {s.held} lectures attended
                      </span>
                      <Link
                        to="/student/history"
                        className="inline-flex items-center text-[10.5px] font-semibold text-primary hover:underline"
                      >
                        History <ChevronRight className="h-3 w-3 ml-0.5" />
                      </Link>
                    </div>

                    {/* Compact iOS Progress Bar */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          isGood ? "bg-emerald-500" : isWarning ? "bg-amber-500" : "bg-rose-500",
                        )}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ManageCoursesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        student={user}
        onSaved={() => refreshAfterSave("Courses updated")}
      />
    </AppShell>
  );
}

function RemoveCourseButton({
  courseId,
  courseCode,
  removing,
  onRemove,
}: {
  courseId: string;
  courseCode: string;
  removing: boolean;
  onRemove: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${courseCode}`}
          disabled={removing}
          className="h-6 w-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          {removing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-bold">Remove {courseCode}?</AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            This only removes the course from your active registration. Your verified attendance
            records remain safe.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row justify-end gap-2 pt-1">
          <AlertDialogCancel className="rounded-xl text-xs mt-0">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onRemove}
            className="rounded-xl text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ManageCoursesDialog({
  open,
  onOpenChange,
  student,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentProfile;
  onSaved: () => void;
}) {
  const { courses } = useCourses();
  const [selected, setSelected] = useState<string[]>(() => student.courseIds);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(student.courseIds);
      setQuery("");
      setError(null);
    }
  }, [open, student.courseIds]);

  const available = useMemo(
    () =>
      courses
        .filter(
          (c) =>
            c.department === student.department &&
            c.level === student.level &&
            (c.code.toLowerCase().includes(query.toLowerCase()) ||
              c.title.toLowerCase().includes(query.toLowerCase())),
        )
        .sort((a, b) => a.code.localeCompare(b.code)),
    [courses, student.department, student.level, query],
  );

  const toggle = (courseId: string) =>
    setSelected((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateUserCourses(student.id, selected);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your courses could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg p-5">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-bold">Manage Enrolled Courses</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select courses for {student.department} · {student.level} to register on your attendance
            sheet.
          </DialogDescription>
        </DialogHeader>

        <div className="relative my-1">
          <Search
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label="Search courses"
            placeholder="Search code or title (e.g. EEE 501)..."
            className="pl-8 h-9 text-xs rounded-xl"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
          {available.length === 0 ? (
            <p className="rounded-xl border border-border bg-secondary/30 p-4 text-center text-xs text-muted-foreground">
              No courses found matching "{query}" for {student.department} ({student.level}).
            </p>
          ) : (
            available.map((course) => (
              <CourseRow
                key={course.id}
                course={course}
                checked={selected.includes(course.id)}
                onToggle={() => toggle(course.id)}
              />
            ))
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive font-medium" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2 sm:justify-between">
          <p className="text-xs font-medium text-muted-foreground">{selected.length} selected</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-8 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={saving}
              className="h-8 rounded-xl text-xs font-semibold"
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CourseRow({
  course,
  checked,
  onToggle,
}: {
  course: Course;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      onClick={onToggle}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5 transition-all select-none",
        checked
          ? "border-primary/40 bg-primary/5 text-foreground"
          : "border-border/60 bg-card hover:bg-secondary/40 text-foreground",
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={`${course.code} — ${course.title}`}
          className="rounded-md"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-foreground">{course.code}</span>
            <span className="text-[10.5px] text-muted-foreground truncate max-w-[200px] sm:max-w-none">
              · {course.title}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {course.creditUnit} Units · {course.department}
          </span>
        </div>
      </div>
      {checked && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
    </label>
  );
}
