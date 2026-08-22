import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, User } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { useAuth, useRoleGuard } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { DEPARTMENTS, FACULTIES } from "@/data/constants";
import type { LecturerProfile } from "@/types";

export const Route = createFileRoute("/lecturer/profile")({
  head: () => ({
    meta: [
      { title: "Lecturer Profile — Smart Campus Presence" },
      { name: "description", content: "Your staff details and department information." },
      { property: "og:title", content: "Lecturer Profile — Smart Campus Presence" },
      { property: "og:description", content: "Staff profile details." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LecturerProfilePage,
});

function LecturerProfilePage() {
  const { user } = useRoleGuard("lecturer");
  const { refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);

  if (!user) return null;

  const rows = [
    ["Full name", user.name],
    ["Staff ID", user.staffId],
    ["Email", user.email],
    ["Phone", user.phone ?? "—"],
    ["Faculty", user.faculty],
    ["Department", user.department],
  ];

  return (
    <AppShell role="lecturer" title="Profile">
      <PageHeader
        title="Profile"
        description="Identity is taken from your authenticated session."
        actions={
          <Button onClick={() => setEditing(true)} className="rounded-xl font-semibold shadow-xs">
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
        </CardContent>
      </Card>

      <EditLecturerDialog
        open={editing}
        onOpenChange={setEditing}
        profile={user}
        onSaved={async () => {
          await refreshUser();
        }}
      />
    </AppShell>
  );
}

interface EditLecturerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: LecturerProfile;
  onSaved: () => Promise<void>;
}

function EditLecturerDialog({ open, onOpenChange, profile, onSaved }: EditLecturerDialogProps) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [faculty, setFaculty] = useState(profile.faculty);
  const [department, setDepartment] = useState(profile.department);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authService.updateLecturerProfile(profile.id, {
        name,
        phone: phone.trim() || undefined,
        faculty,
        department,
      });
      await onSaved();
      toast.success("Profile updated successfully");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Edit Profile
          </DialogTitle>
          <DialogDescription>
            Update your staff information and institutional details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="lect-name">Full name</Label>
            <Input id="lect-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lect-phone">Phone number</Label>
            <Input
              id="lect-phone"
              type="tel"
              placeholder="+234..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lect-faculty">Faculty</Label>
            <Select value={faculty} onValueChange={setFaculty}>
              <SelectTrigger id="lect-faculty">
                <SelectValue placeholder="Select faculty" />
              </SelectTrigger>
              <SelectContent>
                {FACULTIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lect-dept">Department</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger id="lect-dept">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
