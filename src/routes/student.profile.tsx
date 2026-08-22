import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  CheckCircle2,
  HeartHandshake,
  Loader2,
  Mail,
  Pencil,
  Phone,
  ScanFace,
  ShieldCheck,
  Smartphone,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CameraCaptureMock } from "@/components/verification/CameraCaptureMock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const GUARDIAN_RELATIONSHIPS = [
  "Father",
  "Mother",
  "Legal Guardian",
  "Sponsor",
  "Relative",
  "Other",
];

export const Route = createFileRoute("/student/profile")({
  head: () => ({
    meta: [
      { title: "Student Profile — Smart Campus Presence" },
      {
        name: "description",
        content:
          "Your personal details, guardian contact information and notification preferences.",
      },
      { property: "og:title", content: "Student Profile — Smart Campus Presence" },
      { property: "og:description", content: "Personal and guardian profile details." },
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

  const academicRows: [string, string][] = [
    ["Full name", user.name],
    ["Registration number", user.regNumber],
    ["Email", user.email],
    ["Phone", user.phone ?? "—"],
    ["Faculty", user.faculty],
    ["Department", user.department],
    ["Level", user.level],
    ["Semester", user.semester],
    ["Academic session", user.academicSession],
  ];

  const guardianRows: [string, string][] = [
    ["Parent / Guardian name", user.guardianName ?? "Not specified"],
    ["Relationship", user.guardianRelationship ?? "Not specified"],
    ["Parent / Guardian phone", user.guardianPhone ?? "Not specified"],
    ["Parent / Guardian email", user.guardianEmail ?? "Not specified"],
  ];

  const channelLabel = {
    both: "Email & Push Notifications",
    email: "Email Only",
    push: "Push Notifications Only",
    none: "Muted (No Alerts)",
  }[user.notificationChannel ?? "both"];

  return (
    <AppShell role="student" title="Profile">
      <PageHeader
        title="Profile"
        description="Identity is taken from your authenticated session."
        actions={
          <Button onClick={() => setEditing(true)} className="rounded-xl font-semibold shadow-sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit profile
          </Button>
        }
      />

      <div className="space-y-4">
        {/* Academic & Personal Card */}
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Academic & Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {academicRows.map(([label, value]) => (
                <div key={label} className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Biometric Face ID:
                </span>
                <StatusBadge tone={user.faceEnrolled ? "success" : "warning"} className="text-xs">
                  {user.faceEnrolled ? "Enrolled" : "Not enrolled"}
                </StatusBadge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEnrolling(true)}
                className="rounded-xl text-xs"
              >
                <ScanFace className="mr-1.5 h-3.5 w-3.5" />
                {user.faceEnrolled ? "Re-enroll face" : "Enroll face"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Parent / Guardian Information Card */}
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Parent & Guardian Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3.5 sm:grid-cols-2">
              {guardianRows.map(([label, value]) => (
                <div key={label} className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Notification Preferences Card */}
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bell className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              Notification & Attendance Alert System
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">{channelLabel}</p>
              <p className="text-xs text-muted-foreground">
                Automated attendance reports and missed lecture alerts are delivered via this
                channel.
              </p>
            </div>
            <StatusBadge tone="info" className="self-start sm:self-auto px-3 py-1 text-xs">
              {user.notificationChannel === "email" ? (
                <Mail className="mr-1.5 h-3.5 w-3.5" />
              ) : user.notificationChannel === "push" ? (
                <Smartphone className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              )}
              {channelLabel}
            </StatusBadge>
          </CardContent>
        </Card>
      </div>

      <EditProfileDialog
        open={editing}
        onOpenChange={setEditing}
        student={user}
        onSaved={() => {
          toast.success("Profile and parent details updated successfully");
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
    guardianName: student.guardianName ?? "",
    guardianPhone: student.guardianPhone ?? "",
    guardianEmail: student.guardianEmail ?? "",
    guardianRelationship: student.guardianRelationship ?? "Father",
    notificationChannel: student.notificationChannel ?? "both",
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
        guardianName: student.guardianName ?? "",
        guardianPhone: student.guardianPhone ?? "",
        guardianEmail: student.guardianEmail ?? "",
        guardianRelationship: student.guardianRelationship ?? "Father",
        notificationChannel: student.notificationChannel ?? "both",
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
        guardianName: form.guardianName.trim() || undefined,
        guardianPhone: form.guardianPhone.trim() || undefined,
        guardianEmail: form.guardianEmail.trim() || undefined,
        guardianRelationship: form.guardianRelationship || undefined,
        notificationChannel: form.notificationChannel as "email" | "push" | "both" | "none",
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
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Student Profile</DialogTitle>
          <DialogDescription>
            Update personal info, parent/guardian contacts, and notification channels.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Section: Personal & Academic */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Personal & Academic Details
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" id="edit-name" className="sm:col-span-2">
                <Input
                  id="edit-name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="rounded-xl text-xs"
                />
              </Field>
              <Field label="Student Phone" id="edit-phone" className="sm:col-span-2">
                <Input
                  id="edit-phone"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="e.g. +234 800 000 0000"
                  className="rounded-xl text-xs"
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
          </div>

          {/* Section: Parent / Guardian */}
          <div className="space-y-3 pt-3 border-t border-border/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <HeartHandshake className="h-3.5 w-3.5 text-emerald-600" />
              Parent / Guardian Information
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Guardian Full Name" id="edit-guardian-name">
                <Input
                  id="edit-guardian-name"
                  value={form.guardianName}
                  onChange={(e) => set("guardianName", e.target.value)}
                  placeholder="e.g. Mr. Arthur Noel"
                  className="rounded-xl text-xs"
                />
              </Field>
              <PickField
                label="Relationship"
                value={form.guardianRelationship}
                options={GUARDIAN_RELATIONSHIPS}
                onChange={(v) => set("guardianRelationship", v)}
              />
              <Field label="Guardian Phone Number" id="edit-guardian-phone">
                <Input
                  id="edit-guardian-phone"
                  value={form.guardianPhone}
                  onChange={(e) => set("guardianPhone", e.target.value)}
                  placeholder="e.g. +234 812 345 6789"
                  className="rounded-xl text-xs"
                />
              </Field>
              <Field label="Guardian Email" id="edit-guardian-email">
                <Input
                  id="edit-guardian-email"
                  type="email"
                  value={form.guardianEmail}
                  onChange={(e) => set("guardianEmail", e.target.value)}
                  placeholder="guardian@example.com"
                  className="rounded-xl text-xs"
                />
              </Field>
            </div>
          </div>

          {/* Section: Notification Channels */}
          <div className="space-y-3 pt-3 border-t border-border/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-violet-600" />
              Attendance Notification Channel
            </h3>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Delivery Method</Label>
              <Select
                value={form.notificationChannel}
                onValueChange={(v) => set("notificationChannel", v)}
              >
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Email & Push Notifications (Recommended)</SelectItem>
                  <SelectItem value="email">Email Notification Only</SelectItem>
                  <SelectItem value="push">Push Notification Only</SelectItem>
                  <SelectItem value="none">Muted (Do Not Send)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs font-medium text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="rounded-xl text-xs font-semibold shadow-sm"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
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

  const handleCapture = async (uri: string) => {
    setCaptured(true);
    setCaptureUri(uri);
    setProcessing(true);
    setError(null);
    try {
      const outcome = await biometricService.enroll(uri);
      if (!outcome.ok || !outcome.vector) {
        throw new Error(outcome.ok ? "Face features could not be extracted." : outcome.message);
      }

      await authService.enrollFace(student.id, outcome.vector);
      await onRefresh();
      toast.success("Face ID enrolled successfully!");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Face enrollment failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Biometric Face Enrollment</DialogTitle>
          <DialogDescription>
            Position your face squarely within the frame in a well-lit area.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <CameraCaptureMock
            captured={captured}
            processing={processing}
            onCapture={handleCapture}
            onRetake={() => {
              setCaptured(false);
              setCaptureUri(null);
              setError(null);
            }}
            captureLabel="Start Face Enrollment Scan"
          />

          {error && (
            <p className="mt-3 text-center text-xs font-medium text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={processing}
            className="rounded-xl text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  id,
  children,
  className = "",
}: {
  label: string;
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={id} className="text-xs font-semibold text-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function PickField({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-xl text-xs">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-xs">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
