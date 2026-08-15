import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, PageHeader, ProgressBar } from "@/components/layout/PageHeader";
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
import { courseById as liveCourseById, updateStudentCourses } from "@/services/courseService";
import { useRoleGuard } from "@/hooks/useAuth";
import { useStudentAttendance } from "@/hooks/useStudentAttendance";
import { useSessions } from "@/hooks/useSessions";
import { useCourses } from "@/hooks/useCourses";
import { useAuth } from "@/hooks/useAuth";
import type { Course, StudentProfile } from "@/types";

export const Route = createFileRoute("/student/courses")({
  head: () => ({
    meta: [
      { title: "My Courses — Smart Campus Presence" },
      {
        name: "description",
        content:
          "Registered courses with sessions held, sessions attended and attendance percentage.",
      },
      { property: "og:title", content: "My Courses — Smart Campus Presence" },
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
      await updateStudentCourses(
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
      <PageHeader
        title="My courses"
        description="Attendance performance per registered course."
        actions={
          <Button onClick={() => setManageOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add courses
          </Button>
        }
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading courses…</p>
      ) : summaries.length === 0 ? (
        <EmptyState
          title="You are not enrolled in any courses"
          description="Add courses for your department and level to start tracking attendance."
          action={
            <Button onClick={() => setManageOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add courses
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {summaries.map((s) => {
            const course = liveCourseById(s.courseId);
            const pct = s.held ? Math.round((s.attended / s.held) * 100) : 0;
            return (
              <Card key={s.courseId}>
                <CardContent className="space-y-3 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        {course?.code ?? s.courseId}
                      </p>
                      <p className="text-sm text-muted-foreground">{course?.title}</p>
                    </div>
                    <RemoveCourseButton
                      courseId={s.courseId}
                      courseCode={course?.code ?? s.courseId}
                      removing={removing === s.courseId}
                      onRemove={() => handleRemove(s.courseId)}
                    />
                  </div>
                  <ProgressBar value={pct} label={`${course?.code ?? s.courseId} attendance`} />
                  <p className="text-sm text-muted-foreground">
                    {s.attended} of {s.held} sessions attended · {pct}%
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/student/history">View History</Link>
                  </Button>
                </CardContent>
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
        <Button variant="ghost" size="icon" aria-label={`Remove ${courseCode}`} disabled={removing}>
          {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {courseCode}?</AlertDialogTitle>
          <AlertDialogDescription>
            This only removes the course from your registered list. Your attendance history is kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onRemove}>Remove course</AlertDialogAction>
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
      await updateStudentCourses(student.id, selected);
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage your courses</DialogTitle>
          <DialogDescription>
            Add or remove courses for {student.department} · {student.level}. Courses you are
            already registered for are checked.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label="Search courses"
            placeholder="Search by code or title"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {available.length === 0 ? (
            <p className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
              No courses found for {student.department} at {student.level}. Adjust your search or
              update your department/level on your profile.
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
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="sm:justify-between">
          <p className="text-sm text-muted-foreground">{selected.length} course(s) selected</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-secondary">
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        aria-label={`${course.code} — ${course.title}`}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {course.code} — {course.title}
        </span>
        <span className="block text-xs text-muted-foreground">
          {course.creditUnit} credit units
        </span>
      </span>
      {checked && <Check className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />}
    </label>
  );
}
