import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, ScanFace } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CameraCaptureMock } from "@/components/verification/CameraCaptureMock";
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
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRoleGuard } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { biometricService, imageToBase64 } from "@/services/biometricService";
import { ACADEMIC_SESSIONS, DEPARTMENTS, FACULTIES, LEVELS, SEMESTERS } from "@/data/constants";
import type { StudentProfile } from "@/types";

export const Route = createFileRoute("/student/profile")({
  head: () => ({
    meta: [
      { title: "Student Profile — Smart Campus Presence" },
      {
        name: "description",
        content: "Your personal details, academic information and facial enrollment status.",
      },
      { property: "og:title", content: "Student Profile — Smart Campus Presence" },
      { property: "og:description", content: "Personal and academic profile details." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentProfilePage,
});

function StudentProfilePage() {
  const { user } = useRoleGuard("student");
  const { refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  if (!user) return null;

  const rows: [string, string][] = [
    ["Full name", user.name],
    ["Registration number", user.regNumber],
    ["Email", user.email],
    ["Faculty", user.faculty],
    ["Department", user.department],
    ["Level", user.level],
    ["Semester", user.semester],
    ["Academic session", user.academicSession],
    ["Phone", user.phone ?? "—"],
  ];

  return (
    <AppShell role="student" title="Profile">
      <PageHeader
        title="Profile"
        description="Identity is taken from your authenticated session."
        actions={
          <Button onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit profile
          </Button>
        }
      />
      <Card>
        <CardContent className="p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Face enrollment:</span>
            <StatusBadge tone={user.faceEnrolled ? "success" : "warning"}>
              {user.faceEnrolled ? "Enrolled" : "Not enrolled"}
            </StatusBadge>
            <Button variant="outline" size="sm" onClick={() => setEnrolling(true)}>
              <ScanFace className="mr-2 h-4 w-4" />
              {user.faceEnrolled ? "Re-enroll face" : "Enroll face"}
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Facial embeddings are stored server-side and are never exposed to this browser.
          </p>
        </CardContent>
      </Card>

      <EditProfileDialog
        open={editing}
        onOpenChange={setEditing}
        student={user}
        onSaved={() => {
          toast.success("Profile updated");
        }}
        onRefresh={refreshUser}
      />
      <EnrollFaceDialog
        open={enrolling}
        onOpenChange={setEnrolling}
        student={user}
        onRefresh={refreshUser}
      />
    </AppShell>
  );
}

function EditProfileDialog({
  open,
  onOpenChange,
  student,
  onSaved,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentProfile;
  onSaved: () => void;
  onRefresh: () => Promise<unknown>;
}) {
  const [form, setForm] = useState({
    name: student.name,
    phone: student.phone ?? "",
    faculty: student.faculty,
    department: student.department,
    level: student.level,
    semester: student.semester,
    academicSession: student.academicSession,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        name: student.name,
        phone: student.phone ?? "",
        faculty: student.faculty,
        department: student.department,
        level: student.level,
        semester: student.semester,
        academicSession: student.academicSession,
      });
      setError(null);
    }
  }, [open, student]);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.name.trim()) {
      setError("Full name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await authService.updateStudentProfile(student.id, {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        faculty: form.faculty,
        department: form.department,
        level: form.level,
        semester: form.semester,
        academicSession: form.academicSession,
      });
      await onRefresh();
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update your personal and academic details. Registration number and email cannot be
            changed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" id="edit-name" className="sm:col-span-2">
            <Input id="edit-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Phone (optional)" id="edit-phone" className="sm:col-span-2">
            <Input
              id="edit-phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <PickField
            label="Faculty"
            value={form.faculty}
            options={FACULTIES}
            onChange={(v) => set("faculty", v)}
          />
          <PickField
            label="Department"
            value={form.department}
            options={DEPARTMENTS}
            onChange={(v) => set("department", v)}
          />
          <PickField
            label="Level"
            value={form.level}
            options={LEVELS}
            onChange={(v) => set("level", v)}
          />
          <PickField
            label="Semester"
            value={form.semester}
            options={SEMESTERS}
            onChange={(v) => set("semester", v)}
          />
          <PickField
            label="Academic session"
            value={form.academicSession}
            options={ACADEMIC_SESSIONS}
            onChange={(v) => set("academicSession", v)}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnrollFaceDialog({
  open,
  onOpenChange,
  student,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentProfile;
  onRefresh: () => Promise<unknown>;
}) {
  const [captured, setCaptured] = useState(false);
  const [captureUri, setCaptureUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCaptured(false);
      setCaptureUri(null);
      setProcessing(false);
      setError(null);
    }
  }, [open]);

  const enroll = async () => {
    setProcessing(true);
    setError(null);
    try {
      const image = captureUri ? await imageToBase64(captureUri) : undefined;
      const result = await biometricService.enroll(image);
      if (!result.ok) {
        setError(result.message);
        setCaptured(false);
        setCaptureUri(null);
        return;
      }
      const duplicate = await biometricService.checkDuplicate(result.vector, student.id);
      if (!duplicate.ok) {
        setError(duplicate.message);
        setCaptured(false);
        setCaptureUri(null);
        return;
      }
      await authService.enrollFace(student.id, result.vector);
      await onRefresh();
      toast.success("Face enrolled successfully");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Face enrollment failed.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {student.faceEnrolled ? "Re-enroll your face" : "Enroll your face"}
          </DialogTitle>
          <DialogDescription>
            Follow the liveness prompts to capture your face. The embedding is stored server-side
            and used to verify your identity during check-in.
          </DialogDescription>
        </DialogHeader>

        <CameraCaptureMock
          captured={captured}
          processing={processing}
          onCapture={(uri) => {
            setCaptureUri(uri);
            setCaptured(true);
          }}
          onRetake={() => {
            setCaptureUri(null);
            setCaptured(false);
          }}
          captureLabel="Start Liveness & Face Scan"
        />

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={enroll} disabled={!captured || processing}>
            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save face enrollment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  id,
  className,
  children,
}: {
  label: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function PickField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
