import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Plus, Trash2, BookOpen, Search, Check } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { updateUserCourses } from "@/services/courseService";
import { useRoleGuard, useAuth } from "@/hooks/useAuth";
import { useCourses } from "@/hooks/useCourses";
import { DEPARTMENTS, LEVELS, SEMESTERS } from "@/data/constants";
import { cn } from "@/lib/utils";
import type { Course, LecturerProfile } from "@/types";

export const Route = createFileRoute("/lecturer/courses")({
  head: () => ({
    meta: [
      { title: "Assigned Courses — Smart Attendance" },
      {
        name: "description",
        content: "Courses assigned to you for attendance session creation and monitoring.",
      },
      { property: "og:title", content: "Assigned Courses — Smart Attendance" },
      { property: "og:description", content: "Your assigned teaching courses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LecturerCourses,
});

function LecturerCourses() {
  const { user } = useRoleGuard("lecturer");
  const { refreshUser } = useAuth();
  const { courses, loading } = useCourses();
  const [manageOpen, setManageOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  if (!user) return null;

  const mine = courses.filter((c) => user.courseIds.includes(c.id));

  const refreshAfterSave = async (message: string) => {
    await refreshUser();
    toast.success(message);
  };

  const handleRemove = async (courseId: string) => {
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
    <AppShell role="lecturer" title="Courses">
      {/* Compact iOS-Style Header Bar */}
      <div className="flex items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
            Assigned Teaching Courses
          </h1>
          <p className="text-[11px] font-medium text-muted-foreground">
            {mine.length} teaching {mine.length === 1 ? "course" : "courses"} · {user.department}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setManageOpen(true)}
          className="h-8 rounded-xl px-3 text-xs font-semibold shadow-sm"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Edit Courses
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
          Loading courses…
        </div>
      ) : mine.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/70 bg-card/40">
          <CardContent className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
            <BookOpen className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="font-semibold text-foreground text-sm">No teaching courses assigned</p>
            <p className="mt-1 text-[11px] max-w-xs">
              Select the courses you teach in {user.department} to quickly create attendance
              sessions.
            </p>
            <Button
              size="sm"
              onClick={() => setManageOpen(true)}
              className="mt-3.5 h-8 rounded-xl text-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Assign Courses
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {mine.map((c) => (
            <Card
              key={c.id}
              className="group relative overflow-hidden rounded-2xl border-border/50 bg-card p-3.5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className="shrink-0 inline-flex items-center justify-center rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-bold font-mono text-primary border border-primary/20">
                    {c.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-xs font-bold text-foreground leading-snug">
                      {c.title}
                    </h3>
                    <p className="text-[10.5px] font-medium text-muted-foreground mt-0.5">
                      {c.creditUnit} Credit Units · {c.department} ({c.level})
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-lg px-2 text-[10.5px] font-semibold"
                  >
                    <Link to="/lecturer/create-session">Start Session</Link>
                  </Button>
                  <RemoveCourseButton
                    courseId={c.id}
                    courseCode={c.code}
                    removing={removing === c.id}
                    onRemove={() => handleRemove(c.id)}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ManageCoursesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        lecturer={user}
        onSaved={() => refreshAfterSave("Courses updated")}
      />
    </AppShell>
  );
}

function RemoveCourseButton({
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
            This removes the course from your assigned list. You can re-assign it at any time.
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
  lecturer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lecturer: LecturerProfile;
  onSaved: () => void;
}) {
  const { courses } = useCourses();
  const [selected, setSelected] = useState<string[]>(() => lecturer.courseIds);
  const [department, setDepartment] = useState(lecturer.department);
  const [semester, setSemester] = useState(SEMESTERS[0]);
  const [level, setLevel] = useState(LEVELS[0]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(lecturer.courseIds);
      setQuery("");
      setError(null);
    }
  }, [open, lecturer.courseIds]);

  const available = useMemo(
    () =>
      courses
        .filter(
          (c) =>
            c.department === department &&
            c.semester === semester &&
            c.level === level &&
            (c.code.toLowerCase().includes(query.toLowerCase()) ||
              c.title.toLowerCase().includes(query.toLowerCase())),
        )
        .sort((a, b) => a.code.localeCompare(b.code)),
    [courses, department, semester, level, query],
  );

  const toggle = (courseId: string) =>
    setSelected((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateUserCourses(lecturer.id, selected);
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
          <DialogTitle className="text-base font-bold">Manage Teaching Courses</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select courses for session creation and attendance monitoring.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 my-1">
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger aria-label="Department" className="h-8 text-xs rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((dept) => (
                <SelectItem key={dept} value={dept} className="text-xs">
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger aria-label="Semester" className="h-8 text-xs rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEMESTERS.map((sem) => (
                <SelectItem key={sem} value={sem} className="text-xs">
                  {sem}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger aria-label="Level" className="h-8 text-xs rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((lvl) => (
                <SelectItem key={lvl} value={lvl} className="text-xs">
                  {lvl}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative my-1">
          <Search
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label="Search courses"
            placeholder="Search code or title..."
            className="pl-8 h-9 text-xs rounded-xl"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-1">
          {available.length === 0 ? (
            <p className="rounded-xl border border-border bg-secondary/30 p-4 text-center text-xs text-muted-foreground">
              No courses found for {department} · {level} ({semester}).
            </p>
          ) : (
            available.map((course) => (
              <label
                key={course.id}
                onClick={() => toggle(course.id)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5 transition-all select-none",
                  selected.includes(course.id)
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : "border-border/60 bg-card hover:bg-secondary/40 text-foreground",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Checkbox
                    checked={selected.includes(course.id)}
                    onCheckedChange={() => toggle(course.id)}
                    aria-label={`${course.code} — ${course.title}`}
                    className="rounded-md"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {course.code}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground truncate max-w-[180px] sm:max-w-none">
                        · {course.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {course.creditUnit} Units · {course.department}
                    </span>
                  </div>
                </div>
                {selected.includes(course.id) && (
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                )}
              </label>
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
