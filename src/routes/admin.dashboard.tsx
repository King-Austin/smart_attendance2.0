import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Check, Loader2, X, AlertTriangle, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { adminService } from "@/services/adminService";
import { CourseService } from "@/services/courseService";
import { useRoleGuard } from "@/hooks/useAuth";
import type { LecturerProfile, StudentProfile } from "@/types";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user } = useRoleGuard("admin");
  const [lecturers, setLecturers] = useState<LecturerProfile[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
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
      const [lecturerData, studentData] = await Promise.all([
        adminService.getLecturers(),
        adminService.getStudents(),
      ]);
      setLecturers(lecturerData);
      setStudents(studentData);
    } catch (error) {
      toast.error("Failed to load admin records");
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (id: string, status: "approved" | "rejected" | "pending") => {
    setUpdating(id);
    try {
      await adminService.updateLecturerApproval(id, status);
      toast.success(`Lecturer ${status}`);
      setLecturers((prev) => prev.map((l) => (l.id === id ? { ...l, approvalStatus: status } : l)));
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
        const lines = text
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        if (lines.length < 2) throw new Error("File seems empty or missing headers");

        const dataLines = lines.slice(1);
        const coursesToUpload = dataLines
          .map((line) => {
            const parts = line.split(",");
            return {
              code: parts[0]?.trim() || "",
              title: parts[1]?.trim() || "",
              creditUnit: parseInt(parts[2]?.trim() || "0", 10),
              department: parts[3]?.trim() || "",
              level: parts[4]?.trim() || "",
              semester: parts[5]?.trim() || "First Semester",
            };
          })
          .filter((course) => course.code && course.title);

        if (coursesToUpload.length === 0) throw new Error("No valid courses found in CSV");

        const { count, error } = await CourseService.uploadCourses(coursesToUpload);
        if (error) throw error;

        toast.success(`Successfully uploaded ${count} courses`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to parse/upload CSV");
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
  const approvedLecturers = lecturers.filter((l) => l.approvalStatus === "approved");
  const enrolledStudents = students.filter((student) => student.courseIds.length > 0);
  const faceReadyStudents = students.filter((student) => student.faceEnrolled);
  const guardianReadyStudents = students.filter((student) => student.guardianEmail);

  return (
    <AppShell role="admin" title="Admin Dashboard">
      <PageHeader
        title="Admin Dashboard"
        description="Oversee lecturer approvals, student readiness, guardian coverage, and course setup."
      />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Students" value={students.length} />
          <MetricCard label="Lecturers" value={lecturers.length} />
          <MetricCard label="Pending approvals" value={pendingLecturers.length} />
          <MetricCard
            label="Face enrolled"
            value={`${faceReadyStudents.length}/${students.length}`}
          />
        </div>

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
                        {updating === lecturer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="mr-2 h-4 w-4" />
                        )}
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={updating === lecturer.id}
                        onClick={() => handleApproval(lecturer.id, "approved")}
                      >
                        {updating === lecturer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 h-4 w-4" />
                        )}
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
            <CardTitle>Lecturer Oversight</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading lecturers...
              </p>
            ) : lecturers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lecturers found.</p>
            ) : (
              <div className="divide-y divide-border">
                {lecturers.map((lecturer) => (
                  <div
                    key={lecturer.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{lecturer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {lecturer.email} · {lecturer.staffId || "No staff ID"} ·{" "}
                        {lecturer.department || "No department"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lecturer.courseIds.length} assigned course
                        {lecturer.courseIds.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        tone={lecturer.approvalStatus === "approved" ? "success" : "danger"}
                      >
                        {lecturer.approvalStatus}
                      </StatusBadge>
                      {lecturer.approvalStatus !== "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updating === lecturer.id}
                          onClick={() => handleApproval(lecturer.id, "approved")}
                        >
                          Approve
                        </Button>
                      )}
                      {lecturer.approvalStatus === "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updating === lecturer.id}
                          onClick={() => handleApproval(lecturer.id, "pending")}
                        >
                          Suspend
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student Oversight</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading students...
              </p>
            ) : students.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students found.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Course enrolled</p>
                    <p className="text-lg font-semibold text-foreground">
                      {enrolledStudents.length}/{students.length}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Face enrolled</p>
                    <p className="text-lg font-semibold text-foreground">
                      {faceReadyStudents.length}/{students.length}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Guardian email</p>
                    <p className="text-lg font-semibold text-foreground">
                      {guardianReadyStudents.length}/{students.length}
                    </p>
                  </div>
                </div>

                <div className="max-h-[32rem] overflow-y-auto divide-y divide-border rounded-lg border border-border">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{student.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {student.regNumber || "No reg. number"} · {student.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {student.department || "No department"} · {student.level || "No level"} ·{" "}
                          {student.courseIds.length} course
                          {student.courseIds.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <StatusBadge tone={student.faceEnrolled ? "success" : "warning"}>
                          {student.faceEnrolled ? "Face ready" : "No face"}
                        </StatusBadge>
                        <StatusBadge tone={student.courseIds.length > 0 ? "success" : "warning"}>
                          {student.courseIds.length > 0 ? "Courses set" : "No courses"}
                        </StatusBadge>
                        <StatusBadge tone={student.guardianEmail ? "success" : "warning"}>
                          {student.guardianEmail ? "Guardian email" : "No guardian email"}
                        </StatusBadge>
                      </div>
                    </div>
                  ))}
                </div>
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
                Upload a CSV file to batch insert new courses. The CSV should have the following
                headers:
                <br />
                <code className="mt-2 block rounded bg-muted p-2 font-mono text-xs">
                  code, title, creditUnit, department, level, semester
                </code>
              </p>

              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
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
