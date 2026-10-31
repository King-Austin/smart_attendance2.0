import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { z } from "zod";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Layers,
  ListPlus,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { useAcademicOptions } from "@/hooks/useAcademicOptions";
import { adminService } from "@/services/adminService";
import { CourseService } from "@/services/courseService";
import { useRoleGuard } from "@/hooks/useAuth";
import type { Course, LecturerProfile, StudentProfile } from "@/types";

const adminSectionSchema = z.enum(["overview", "people", "courses", "attendance"]);
export type AdminSection = z.infer<typeof adminSectionSchema>;

const adminSearchSchema = z.object({
  section: adminSectionSchema.catch("overview").default("overview"),
});

export const Route = createFileRoute("/admin/dashboard")({
  validateSearch: adminSearchSchema,
  component: AdminDashboard,
});

interface NewCourseDraft {
  code: string;
  title: string;
  creditUnit: number;
}

type AccountToDelete =
  | { id: string; name: string; role: "student" }
  | { id: string; name: string; role: "lecturer" };

function AdminDashboard() {
  const { user } = useRoleGuard("admin");
  const { section: activeSection } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [lecturers, setLecturers] = useState<LecturerProfile[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Multi-step Course Creation State
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const [targetFaculty, setTargetFaculty] = useState("");
  const [customFaculty, setCustomFaculty] = useState("");
  const [isCustomFaculty, setIsCustomFaculty] = useState(false);
  const [targetDepartment, setTargetDepartment] = useState("");
  const [customDepartment, setCustomDepartment] = useState("");
  const [isCustomDept, setIsCustomDept] = useState(false);
  const [targetLevel, setTargetLevel] = useState("");
  const [targetSemester, setTargetSemester] = useState("");
  const academic = useAcademicOptions(targetFaculty);
  const [courseRows, setCourseRows] = useState<NewCourseDraft[]>([
    { code: "", title: "", creditUnit: 3 },
  ]);
  const [submittingCourses, setSubmittingCourses] = useState(false);

  // Course Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [semesterFilter, setSemesterFilter] = useState<string>("ALL");

  // Deletion Dialog States
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<string | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<AccountToDelete | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadAllAdminData();
  }, [user]);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [lecturerData, studentData, courseData] = await Promise.all([
        adminService.getLecturers(),
        adminService.getStudents(),
        CourseService.getAllCoursesLive(),
      ]);
      setLecturers(lecturerData);
      setStudents(studentData);
      setCourses(courseData);
    } catch {
      toast.error("Failed to load administration data");
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
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdating(null);
    }
  };

  // Course Rows Helpers
  const addCourseRow = () => {
    setCourseRows((prev) => [...prev, { code: "", title: "", creditUnit: 3 }]);
  };

  const removeCourseRow = (index: number) => {
    if (courseRows.length === 1) return;
    setCourseRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCourseRow = (index: number, field: keyof NewCourseDraft, value: string | number) => {
    setCourseRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const activeFaculty = isCustomFaculty ? customFaculty.trim() : targetFaculty;
  const activeDepartment = isCustomDept ? customDepartment.trim() : targetDepartment;

  const validateStep1 = () => {
    if (isCustomFaculty && !customFaculty.trim()) {
      toast.error("Please enter the custom faculty name.");
      return false;
    }
    if (isCustomDept && !customDepartment.trim()) {
      toast.error("Please enter the custom department name.");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const validRows = courseRows.filter((r) => r.code.trim() && r.title.trim());
    if (validRows.length === 0) {
      toast.error("Please fill in at least one valid course code and title.");
      return false;
    }
    return true;
  };

  const handleCreateCourses = async () => {
    const validRows = courseRows
      .filter((r) => r.code.trim() && r.title.trim())
      .map((r) => ({
        code: r.code.trim().toUpperCase(),
        title: r.title.trim(),
        creditUnit: Number(r.creditUnit) || 3,
        faculty: activeFaculty,
        department: activeDepartment,
        level: targetLevel,
        semester: targetSemester,
      }));

    if (validRows.length === 0) {
      toast.error("No valid courses to save.");
      return;
    }

    setSubmittingCourses(true);
    try {
      const created = await CourseService.createCourses(validRows);
      toast.success(`Successfully added ${created.length} course${created.length === 1 ? "" : "s"}!`);
      // Reset form
      setCourseRows([{ code: "", title: "", creditUnit: 3 }]);
      setFormStep(1);
      // Reload live courses
      const freshCourses = await CourseService.getAllCoursesLive();
      setCourses(freshCourses);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create courses.");
    } finally {
      setSubmittingCourses(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsDeleting(true);
    try {
      await CourseService.deleteCourse(courseToDelete.id);
      toast.success(`Course ${courseToDelete.code} removed successfully.`);
      setCourses((prev) => prev.filter((c) => c.id !== courseToDelete.id));
      setCourseToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete course.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!deptToDelete) return;
    setIsDeleting(true);
    try {
      await CourseService.deleteCoursesByDepartment(deptToDelete);
      toast.success(`All courses in ${deptToDelete} deleted.`);
      setCourses((prev) => prev.filter((c) => c.department !== deptToDelete));
      setDeptToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete department courses.");
    } finally {
      setIsDeleting(false);
    }
  };

  const closeAccountDeletion = () => {
    setAccountToDelete(null);
    setDeleteConfirmation("");
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete || deleteConfirmation !== "DELETE") return;
    setIsDeleting(true);
    try {
      await adminService.deleteAccount(accountToDelete.id);
      if (accountToDelete.role === "student") {
        setStudents((current) => current.filter((student) => student.id !== accountToDelete.id));
      } else {
        setLecturers((current) =>
          current.filter((lecturer) => lecturer.id !== accountToDelete.id),
        );
      }
      toast.success(`${accountToDelete.name}'s account was permanently deleted.`);
      closeAccountDeletion();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete account.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  // Filtered Courses & Metadata
  const allFacultiesInDb = academic.faculties.map((item) => item.name);

  const allDepartmentsInDb = academic.allDepartments.map((item) => item.name);

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.alternateCodes ?? []).some((code) => code.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDept = deptFilter === "ALL" || c.department === deptFilter;
    const matchesLevel = levelFilter === "ALL" || c.level === levelFilter;
    const matchesSemester = semesterFilter === "ALL" || c.semester === semesterFilter;
    return matchesSearch && matchesDept && matchesLevel && matchesSemester;
  });

  const pendingLecturers = lecturers.filter((l) => l.approvalStatus === "pending");
  const enrolledStudents = students.filter((student) => student.courseIds.length > 0);
  const faceReadyStudents = students.filter((student) => student.faceEnrolled);
  const guardianReadyStudents = students.filter((student) => student.guardianEmail);
  const sectionItems = [
    { id: "overview" as const, label: "Overview", hint: "At a glance" },
    { id: "people" as const, label: "People", hint: "Students and lecturers" },
    { id: "courses" as const, label: "Courses", hint: "Catalogue and departments" },
    { id: "attendance" as const, label: "Attendance", hint: "Sessions and reports" },
  ];

  const setActiveSection = (section: AdminSection) => {
    void navigate({ search: { section } });
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? sectionItems.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + sectionItems.length) %
            sectionItems.length;
    const next = sectionItems[nextIndex];
    setActiveSection(next.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <AppShell role="admin" title="Admin Dashboard">
      <PageHeader
        title="Admin Dashboard"
        description="Oversee lecturer approvals, student readiness, and manage academic courses & departments."
      />

      <nav aria-label="Admin dashboard sections" className="sticky top-[57px] z-20 -mx-4 border-y border-border/80 bg-background/95 px-4 py-2 backdrop-blur md:top-[65px] md:mx-0 md:rounded-xl md:border">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="tablist">
          {sectionItems.map((section, index) => (
            <button
              key={section.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`admin-tab-${section.id}`}
              aria-selected={activeSection === section.id}
              aria-controls={`admin-panel-${section.id}`}
              tabIndex={activeSection === section.id ? 0 : -1}
              onClick={() => setActiveSection(section.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`min-h-12 rounded-lg px-2 py-2 text-left transition-colors sm:px-3 ${
                activeSection === section.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="block text-xs font-semibold">{section.label}</span>
              <span className={`hidden text-[10px] sm:block ${activeSection === section.id ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                {section.hint}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <div
        id={`admin-panel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`admin-tab-${activeSection}`}
        tabIndex={0}
        className="space-y-6 outline-none md:space-y-8"
      >
        {/* Metric Cards */}
        {activeSection === "overview" && <div id="admin-summary" className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <MetricCard label="Total Students" value={students.length} />
          <MetricCard label="Total Lecturers" value={lecturers.length} />
          <MetricCard label="Pending Approvals" value={pendingLecturers.length} />
          <MetricCard label="Total Departments" value={allDepartmentsInDb.length} />
        </div>}

        {activeSection === "overview" && <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3"><CardTitle className="text-base">Needs attention</CardTitle><CardDescription>Items that may need an administrator&apos;s action.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
            <button type="button" onClick={() => setActiveSection("people")} className="rounded-lg border border-border bg-background p-3 text-left hover:border-primary"><span className="block font-semibold">{pendingLecturers.length} lecturer approvals</span><span className="text-xs text-muted-foreground">Review people access</span></button>
            <button type="button" onClick={() => setActiveSection("courses")} className="rounded-lg border border-border bg-background p-3 text-left hover:border-primary"><span className="block font-semibold">{courses.length} courses in catalogue</span><span className="text-xs text-muted-foreground">Manage departments and courses</span></button>
            <button type="button" onClick={() => setActiveSection("people")} className="rounded-lg border border-border bg-background p-3 text-left hover:border-primary"><span className="block font-semibold">{students.length - faceReadyStudents.length} students need setup</span><span className="text-xs text-muted-foreground">Check biometric readiness</span></button>
          </CardContent>
        </Card>}

        {/* Pending Lecturer Approvals */}
        {(activeSection === "people") && <Card id="admin-approvals" className={pendingLecturers.length > 0 ? "border-amber-500/50 bg-amber-500/5" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Pending Lecturer Approvals ({pendingLecturers.length})
            </CardTitle>
            <CardDescription>Review and authorize new academic staff profiles.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading records...
              </p>
            ) : pendingLecturers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending approvals at this time.</p>
            ) : (
              <div className="grid gap-4">
                {pendingLecturers.map((lecturer) => (
                  <div
                    key={lecturer.id}
                    className="flex flex-col items-stretch gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <h3 className="font-semibold text-foreground">{lecturer.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {lecturer.email} · Staff ID: {lecturer.staffId || "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lecturer.faculty} · {lecturer.department}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
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
                          <X className="mr-1.5 h-4 w-4" />
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
                          <Check className="mr-1.5 h-4 w-4" />
                        )}
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>}

        {/* Course Creation Form (Multi-Step Form) */}
        {activeSection === "courses" && <Card id="admin-courses" className="border border-border shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ListPlus className="h-5 w-5 text-primary" />
                  Add New Courses & Curriculum
                </CardTitle>
                <CardDescription>
                  Define academic departments, levels, and add verified course units step by step.
                </CardDescription>
              </div>
              <div className="grid w-full grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-[11px] font-semibold sm:w-auto sm:gap-1.5 sm:text-xs">
                <span
                  className={`rounded px-2.5 py-1 transition-colors ${
                    formStep === 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  } flex min-h-10 min-w-0 items-center justify-center text-center leading-tight sm:px-2.5 sm:py-1`}
                >
                  <span><span className="block sm:inline">1. </span>Academic Target</span>
                </span>
                <span
                  className={`rounded px-2.5 py-1 transition-colors ${
                    formStep === 2 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  } flex min-h-10 min-w-0 items-center justify-center text-center leading-tight sm:px-2.5 sm:py-1`}
                >
                  <span><span className="block sm:inline">2. </span>Course Details</span>
                </span>
                <span
                  className={`rounded px-2.5 py-1 transition-colors ${
                    formStep === 3 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  } flex min-h-10 min-w-0 items-center justify-center text-center leading-tight sm:px-2.5 sm:py-1`}
                >
                  <span><span className="block sm:inline">3. </span>Confirmation</span>
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Academic Hierarchy */}
            {formStep === 1 && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="faculty-select">Faculty</Label>
                      <button
                        type="button"
                        onClick={() => setIsCustomFaculty((prev) => !prev)}
                        className="text-xs font-medium text-primary underline underline-offset-2"
                      >
                        {isCustomFaculty ? "← Choose existing" : "+ Add custom faculty"}
                      </button>
                    </div>

                    {isCustomFaculty ? (
                      <Input
                        id="custom-faculty-input"
                        placeholder="e.g. Faculty of Environmental Sciences / Inter-Faculty Studies"
                        value={customFaculty}
                        onChange={(e) => setCustomFaculty(e.target.value)}
                        required
                      />
                    ) : (
                      <Select value={targetFaculty} onValueChange={(value) => { setTargetFaculty(value); setTargetDepartment(""); }}>
                        <SelectTrigger id="faculty-select">
                          <SelectValue placeholder="Select faculty" />
                        </SelectTrigger>
                        <SelectContent>
                          {allFacultiesInDb.map((fac) => (
                            <SelectItem key={fac} value={fac}>
                              {fac}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="dept-select">Department</Label>
                      <button
                        type="button"
                        onClick={() => setIsCustomDept((prev) => !prev)}
                        className="text-xs font-medium text-primary underline underline-offset-2"
                      >
                        {isCustomDept ? "← Choose existing" : "+ Add custom department"}
                      </button>
                    </div>

                    {isCustomDept ? (
                      <Input
                        placeholder="e.g. Biomedical Engineering"
                        value={customDepartment}
                        onChange={(e) => setCustomDepartment(e.target.value)}
                        required
                      />
                    ) : (
                      <Select value={targetDepartment} onValueChange={setTargetDepartment}>
                        <SelectTrigger id="dept-select">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {academic.departments.map((item) => (
                            <SelectItem key={item.id} value={item.name}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="level-select">Academic Level</Label>
                    <Select value={targetLevel} onValueChange={setTargetLevel}>
                      <SelectTrigger id="level-select">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {academic.levels.map((lvl) => (
                          <SelectItem key={lvl} value={lvl}>
                            {lvl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="semester-select">Semester</Label>
                    <Select value={targetSemester} onValueChange={setTargetSemester}>
                      <SelectTrigger id="semester-select">
                        <SelectValue placeholder="Select semester" />
                      </SelectTrigger>
                      <SelectContent>
                        {academic.semesters.map((sem) => (
                          <SelectItem key={sem} value={sem}>
                            {sem}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      if (validateStep1()) setFormStep(2);
                    }}
                  >
                    Next: Enter Courses
                    <ChevronRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Course Entries */}
            {formStep === 2 && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  Adding courses for:{" "}
                  <strong className="text-foreground">{activeFaculty}</strong> ·{" "}
                  <strong className="text-foreground">{activeDepartment}</strong> ·{" "}
                  <strong className="text-foreground">{targetLevel}</strong> ·{" "}
                  <strong className="text-foreground">{targetSemester}</strong>
                </div>

                <div className="space-y-3">
                  {courseRows.map((row, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 items-end gap-3 rounded-xl border border-border p-3.5 bg-card/80"
                    >
                      <div className="col-span-12 sm:col-span-3 space-y-1">
                        <Label className="text-xs">Course Code</Label>
                        <Input
                          placeholder="e.g. EEE 401"
                          inputMode="text"
                          autoCapitalize="characters"
                          value={row.code}
                          onChange={(e) => updateCourseRow(index, "code", e.target.value)}
                          className="uppercase font-mono text-xs"
                        />
                      </div>

                      <div className="col-span-12 sm:col-span-6 space-y-1">
                        <Label className="text-xs">Course Title</Label>
                        <Input
                          placeholder="e.g. Digital Signal Processing"
                          type="text"
                          value={row.title}
                          onChange={(e) => updateCourseRow(index, "title", e.target.value)}
                          className="text-xs"
                        />
                      </div>

                      <div className="col-span-8 sm:col-span-2 space-y-1">
                        <Label className="text-xs">Units</Label>
                        <Input
                          type="number"
                          min={1}
                          max={6}
                          value={row.creditUnit}
                          onChange={(e) =>
                            updateCourseRow(index, "creditUnit", parseInt(e.target.value, 10) || 3)
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCourseRow(index)}
                          disabled={courseRows.length === 1}
                          className="text-muted-foreground hover:text-destructive h-9 w-9"
                          title="Remove row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCourseRow}
                    className="text-xs"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Another Course Row
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setFormStep(1)}
                      className="text-xs"
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (validateStep2()) setFormStep(3);
                      }}
                      className="text-xs"
                    >
                      Next: Review & Save
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review & Submit */}
            {formStep === 3 && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                <div className="rounded-xl border border-border/80 bg-muted/40 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">Summary of New Courses</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                    <div>
                      Faculty: <strong className="text-foreground">{activeFaculty}</strong>
                    </div>
                    <div>
                      Department: <strong className="text-foreground">{activeDepartment}</strong>
                    </div>
                    <div>
                      Level: <strong className="text-foreground">{targetLevel}</strong>
                    </div>
                    <div>
                      Semester: <strong className="text-foreground">{targetSemester}</strong>
                    </div>
                  </div>

                  <div className="divide-y divide-border border-t border-border pt-2 mt-2">
                    {courseRows
                      .filter((r) => r.code.trim() && r.title.trim())
                      .map((r, i) => (
                        <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-2 text-xs">
                          <span className="min-w-0 font-mono font-bold text-foreground">
                            {r.code.toUpperCase()}
                          </span>
                          <span className="min-w-0 break-words font-medium text-muted-foreground">{r.title}</span>
                          <span className="whitespace-nowrap rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                            {r.creditUnit} Units
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setFormStep(2)}
                    disabled={submittingCourses}
                    className="w-full text-xs sm:w-auto"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Modify Entries
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateCourses}
                    disabled={submittingCourses}
                    className="w-full text-xs font-semibold shadow-sm sm:w-auto"
                  >
                    {submittingCourses ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 h-4 w-4" />
                    )}
                    Commit & Save Courses to Database
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>}

        {/* Live Course Inventory & Management Table */}
        {activeSection === "courses" && <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Course Inventory & Department Management ({filteredCourses.length})
                </CardTitle>
                <CardDescription>
                  Search, filter, edit, or delete existing courses across departments.
                </CardDescription>
              </div>

              {deptFilter !== "ALL" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeptToDelete(deptFilter)}
                  className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete All in "{deptFilter}"
                </Button>
              )}
            </div>

            {/* Filter Bar */}
            <div className="grid gap-2.5 pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search code or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-h-11 pl-9 text-xs"
                />
              </div>

              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="min-h-11 text-xs">
                  <SelectValue placeholder="Department filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  {allDepartmentsInDb.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="min-h-11 text-xs">
                  <SelectValue placeholder="Level filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Levels</SelectItem>
                  {academic.levels.map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {lvl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                <SelectTrigger className="min-h-11 text-xs">
                  <SelectValue placeholder="Semester filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Semesters</SelectItem>
                  {academic.semesters.map((sem) => (
                    <SelectItem key={sem} value={sem}>
                      {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading live courses...
              </p>
            ) : filteredCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No courses found matching the selected filters.
              </p>
            ) : (
              <div className="max-h-[30rem] overflow-y-auto divide-y divide-border rounded-xl border border-border">
                {filteredCourses.map((c) => (
                  <div
                    key={c.id}
                      className="flex flex-col items-stretch gap-3 p-3.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">
                          {c.code}
                        </span>
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                          {c.creditUnit} Units
                        </span>
                        <span className="text-xs text-muted-foreground">· {c.level}</span>
                      </div>
                      <p className="text-xs text-foreground font-medium truncate max-w-md">
                        {c.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.department} · {c.semester}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCourseToDelete(c)}
                      className="min-h-11 w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-8 sm:min-h-0 sm:w-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>}

        {/* Lecturer Oversight */}
        {activeSection === "people" && <>
        <Card id="admin-lecturers" className="scroll-mt-28">
          <CardHeader>
            <CardTitle>Lecturer Oversight</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading lecturers...
              </p>
            ) : lecturers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lecturers registered yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {lecturers.map((lecturer) => (
                  <div
                    key={lecturer.id}
                    className="flex flex-col items-stretch gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
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
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
                          className="min-h-11 sm:min-h-0"
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
                          className="min-h-11 sm:min-h-0"
                        >
                          Suspend
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={updating === lecturer.id}
                        onClick={() =>
                          setAccountToDelete({
                            id: lecturer.id,
                            name: lecturer.name,
                            role: "lecturer",
                          })
                        }
                        className="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive sm:min-h-0"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Oversight */}
        <Card id="admin-students" className="scroll-mt-28">
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
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">Course Enrolled</p>
                    <p className="text-lg font-bold text-foreground">
                      {enrolledStudents.length}/{students.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">Face Enrolled</p>
                    <p className="text-lg font-bold text-foreground">
                      {faceReadyStudents.length}/{students.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">Guardian Info Set</p>
                    <p className="text-lg font-bold text-foreground">
                      {guardianReadyStudents.length}/{students.length}
                    </p>
                  </div>
                </div>

                <div className="max-h-[28rem] overflow-y-auto divide-y divide-border rounded-xl border border-border">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="flex flex-col items-stretch gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
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
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <StatusBadge tone={student.faceEnrolled ? "success" : "warning"}>
                          {student.faceEnrolled ? "Face ready" : "No face"}
                        </StatusBadge>
                        <StatusBadge tone={student.courseIds.length > 0 ? "success" : "warning"}>
                          {student.courseIds.length > 0 ? "Courses set" : "No courses"}
                        </StatusBadge>
                        <StatusBadge tone={student.guardianEmail ? "success" : "warning"}>
                          {student.guardianEmail ? "Guardian email" : "No guardian email"}
                        </StatusBadge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setAccountToDelete({
                              id: student.id,
                              name: student.name,
                              role: "student",
                            })
                          }
                          className="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive sm:min-h-0"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </>}

        {activeSection === "attendance" && <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
            <CardDescription>Monitor live sessions, review session history, and prepare reports.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/40 p-4"><p className="font-semibold">Active sessions</p><p className="mt-1 text-sm text-muted-foreground">Open a lecturer session to monitor attendance in real time.</p></div>
            <div className="rounded-xl border border-border bg-muted/40 p-4"><p className="font-semibold">Session history</p><p className="mt-1 text-sm text-muted-foreground">Review completed attendance sessions by course and date.</p></div>
            <div className="rounded-xl border border-border bg-muted/40 p-4"><p className="font-semibold">Reports</p><p className="mt-1 text-sm text-muted-foreground">Export attendance summaries once reporting is enabled.</p></div>
          </CardContent>
        </Card>}
      </div>

      {/* Delete Single Course Dialog */}
      <AlertDialog open={Boolean(courseToDelete)} onOpenChange={() => setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong>
                {courseToDelete?.code} — {courseToDelete?.title}
              </strong>
              ? This will remove it from future student and lecturer course selections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCourse}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Course"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Courses in Department Dialog */}
      <AlertDialog open={Boolean(deptToDelete)} onOpenChange={() => setDeptToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Courses in Department?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all courses in department{" "}
              <strong>"{deptToDelete}"</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDepartment}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete All Department Courses"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(accountToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) closeAccountDeletion();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {accountToDelete?.role} account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{accountToDelete?.name}</strong>&apos;s login and
              profile. Student biometric and attendance data will also be removed. The same email
              and face can then be enrolled again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-account-confirmation">
              Type <strong>DELETE</strong> to confirm
            </Label>
            <Input
              id="delete-account-confirmation"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              autoComplete="off"
              disabled={isDeleting}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteAccount();
              }}
              disabled={isDeleting || deleteConfirmation !== "DELETE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting account..." : "Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
