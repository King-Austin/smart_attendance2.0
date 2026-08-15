import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Check, Loader2, X, AlertTriangle, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { adminService } from "@/services/adminService";
import { CourseService } from "@/services/courseService";
import { useRoleGuard } from "@/hooks/useAuth";
import type { LecturerProfile } from "@/types";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user } = useRoleGuard("admin");
  const [lecturers, setLecturers] = useState<LecturerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    loadLecturers();
  }, [user]);

  const loadLecturers = async () => {
    setLoading(true);
    try {
      const data = await adminService.getLecturers();
      setLecturers(data);
    } catch (error) {
      toast.error("Failed to load lecturers");
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (id: string, status: "approved" | "rejected") => {
    setUpdating(id);
    try {
      await adminService.updateLecturerApproval(id, status);
      toast.success(`Lecturer ${status}`);
      setLecturers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, approvalStatus: status } : l))
      );
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setUpdating(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setUploading(true);
        const text = event.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) throw new Error("File seems empty or missing headers");
        
        const dataLines = lines.slice(1);
        const coursesToUpload = dataLines.map(line => {
          const parts = line.split(',');
          return {
            code: parts[0]?.trim() || "",
            title: parts[1]?.trim() || "",
            creditUnit: parseInt(parts[2]?.trim() || "0", 10),
            department: parts[3]?.trim() || "",
            level: parts[4]?.trim() || "",
            semester: parts[5]?.trim() || "First Semester"
          };
        }).filter(c => c.code && c.title);

        if (coursesToUpload.length === 0) throw new Error("No valid courses found in CSV");

        const { count, error } = await CourseService.uploadCourses(coursesToUpload);
        if (error) throw error;
        
        toast.success(`Successfully uploaded ${count} courses`);
      } catch (err: any) {
        toast.error(err.message || "Failed to parse/upload CSV");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  if (!user) return null;

  const pendingLecturers = lecturers.filter((l) => l.approvalStatus === "pending");
  const otherLecturers = lecturers.filter((l) => l.approvalStatus !== "pending");

  return (
    <AppShell role="admin" title="Admin Dashboard">
      <PageHeader
        title="Admin Dashboard"
        description="Review and approve lecturer accounts."
      />

      <div className="space-y-6">
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Pending Lecturer Approvals ({pendingLecturers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </p>
            ) : pendingLecturers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending approvals.</p>
            ) : (
              <div className="grid gap-4">
                {pendingLecturers.map((lecturer) => (
                  <div
                    key={lecturer.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4"
                  >
                    <div>
                      <h3 className="font-semibold text-foreground">{lecturer.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {lecturer.email} · {lecturer.staffId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lecturer.faculty} · {lecturer.department}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={updating === lecturer.id}
                        onClick={() => handleApproval(lecturer.id, "rejected")}
                      >
                        {updating === lecturer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={updating === lecturer.id}
                        onClick={() => handleApproval(lecturer.id, "approved")}
                      >
                        {updating === lecturer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Lecturers</CardTitle>
          </CardHeader>
          <CardContent>
            {otherLecturers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other lecturers found.</p>
            ) : (
              <div className="divide-y divide-border">
                {otherLecturers.map((lecturer) => (
                  <div key={lecturer.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{lecturer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {lecturer.staffId} · {lecturer.department}
                      </p>
                    </div>
                    <StatusBadge tone={lecturer.approvalStatus === "approved" ? "success" : "danger"}>
                      {lecturer.approvalStatus}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manage Courses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file to batch insert new courses. The CSV should have the following headers:
                <br />
                <code className="mt-2 block rounded bg-muted p-2 font-mono text-xs">code, title, creditUnit, department, level, semester</code>
              </p>
              
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {uploading ? "Uploading..." : "Upload Courses CSV"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
