import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
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
import type { LecturerProfile } from "@/types";

export const Route = createFileRoute("/lecturer/courses")({
  head: () => ({
    meta: [
      { title: "Assigned Courses — Smart Campus Presence" },
      {
        name: "description",
        content: "Courses assigned to you for attendance session creation and monitoring.",
      },
      { property: "og:title", content: "Assigned Courses — Smart Campus Presence" },
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
      <PageHeader
        title="Assigned courses"
        description="Courses you are currently teaching and can quickly create sessions for."
        actions={
          <Button onClick={() => setManageOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Edit courses
          </Button>
        }
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your courses…</p>
      ) : mine.length === 0 ? (
        <EmptyState
          title="No courses assigned"
          description="You have not selected any courses to teach yet."
          action={
            <Button onClick={() => setManageOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Edit courses
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {mine.map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-3 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-foreground">{c.code}</p>
                    <p className="text-sm text-muted-foreground">{c.title}</p>
                  </div>
                  <RemoveCourseButton
                    courseId={c.id}
                    courseCode={c.code}
                    removing={removing === c.id}
                    onRemove={() => handleRemove(c.id)}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {c.creditUnit} credit units · {c.department}
                </p>
              </CardContent>
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
        <Button variant="ghost" size="icon" aria-label={`Remove ${courseCode}`} disabled={removing}>
          {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {courseCode}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the course from your assigned list. You can add it back later.
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Assigned Courses</DialogTitle>
          <DialogDescription>
            Select the courses you are teaching. You can filter by department, level, and semester.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger aria-label="Department">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger aria-label="Level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger aria-label="Semester">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEMESTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Input
          placeholder="Search by course code or title..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="max-h-[40vh] overflow-y-auto rounded-md border border-border">
          {available.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No courses found for this filter.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {available.map((c) => {
                const checked = selected.includes(c.id);
                return (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-start gap-3 p-4 hover:bg-accent/50">
                      <Checkbox
                        className="mt-1"
                        checked={checked}
                        onCheckedChange={() => toggle(c.id)}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{c.code}</p>
                        <p className="text-sm text-muted-foreground">{c.title}</p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
