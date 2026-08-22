import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  Percent,
  Search,
  Trash2,
  Users,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge, attendanceTone } from "@/components/ui/status-badge";
import { StudentAvatar } from "@/components/ui/student-avatar";
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
import { attendanceService, format12Hour } from "@/services/attendanceService";
import type { LedgerRow } from "@/services/attendanceService";
import { courseById as liveCourseById } from "@/services/courseService";
import { exportService } from "@/services/exportService";
import { useRoleGuard } from "@/hooks/useAuth";
import { useSessions } from "@/hooks/useSessions";
import { useCourses } from "@/hooks/useCourses";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileSpreadsheet, FileText } from "lucide-react";

export const Route = createFileRoute("/lecturer/ledger/$sessionId")({
  head: () => ({
    meta: [
      { title: "Attendance Ledger — Smart Campus Presence" },
      {
        name: "description",
        content:
          "Full verification ledger for a session, including face match scores and distance from the anchor.",
      },
      { property: "og:title", content: "Attendance Ledger — Smart Campus Presence" },
      {
        property: "og:description",
        content: "Per-student verification evidence for one attendance session.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Ledger,
});

type SortOption = "latest" | "alphabetical" | "status";

function Ledger() {
  const { user } = useRoleGuard("lecturer");
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [present, setPresent] = useState(0);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  useCourses();
  useSessions();

  // Manual Add Student Dialog
  const [addOpen, setAddOpen] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState<
    { id: string; name: string; regNumber: string; email: string }[]
  >([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [addingLoading, setAddingLoading] = useState(false);

  // Deletion States
  const [deleteSessionOpen, setDeleteSessionOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingRecord, setDeletingRecord] = useState(false);

  const fetchLedger = async () => {
    const ledger = await attendanceService.getLedger(sessionId);
    setRows(ledger.rows);
    setPresent(ledger.present);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ledger = await attendanceService.getLedger(sessionId);
      if (!cancelled) {
        setRows(ledger.rows);
        setPresent(ledger.present);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const session = attendanceService.getSession(sessionId);

  // Load enrolled students
  useEffect(() => {
    if (!session?.courseId) return;
    void attendanceService.getEnrolledStudents(session.courseId).then(setEnrolledStudents);
  }, [session?.courseId]);

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = rows.filter((r) => {
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.regNumber.toLowerCase().includes(q);
    });

    result = [...result].sort((a, b) => {
      if (sortBy === "alphabetical") return a.name.localeCompare(b.name);
      if (sortBy === "status") {
        if (a.status !== b.status) return a.status === "verified" ? -1 : 1;
        return a.name.localeCompare(b.name);
      }
      return (b.verifiedAt || "").localeCompare(a.verifiedAt || "") || a.name.localeCompare(b.name);
    });

    return result;
  }, [rows, query, sortBy]);

  if (!user) return null;

  if (!session) {
    return (
      <AppShell role="lecturer" title="Ledger">
        <EmptyState
          title="Session not found"
          description="This session may have been removed or deleted."
          action={
            <Button asChild>
              <Link to="/lecturer/sessions">Back to sessions</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const absent = Math.max(0, session.enrolledCount - present);
  const rate = session.enrolledCount ? Math.round((present / session.enrolledCount) * 100) : 0;

  const handleExportCSV = () => {
    const course = liveCourseById(session.courseId);
    const exportItems = rows.map((r) => ({
      studentName: r.name,
      regNumber: r.regNumber,
      department: "Electrical & Electronic Engineering",
      level: "500L",
      status: r.status,
      verifiedAt: r.verifiedAt,
    }));
    exportService.exportToCSV(session, course, exportItems);
    toast.success("Attendance sheet (.CSV) downloaded.");
  };

  const handleExportPDF = () => {
    const course = liveCourseById(session.courseId);
    const exportItems = rows.map((r) => ({
      studentName: r.name,
      regNumber: r.regNumber,
      department: "Electrical & Electronic Engineering",
      level: "500L",
      status: r.status,
      verifiedAt: r.verifiedAt,
    }));
    exportService.exportToPDF(session, course, exportItems, {
      totalEnrolled: session.enrolledCount,
      totalPresent: present,
      totalAbsent: absent,
      turnoutRate: rate,
    });
    toast.success("Official attendance report generated.");
  };

  const handleDeleteSession = async () => {
    setDeletingSession(true);
    try {
      await attendanceService.deleteSession(session.id);
      toast.success("Attendance session deleted");
      setDeleteSessionOpen(false);
      navigate({ to: "/lecturer/sessions", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete session.");
    } finally {
      setDeletingSession(false);
    }
  };

  const handleConfirmDeleteRecord = async () => {
    if (!recordToDelete) return;
    setDeletingRecord(true);
    try {
      await attendanceService.deleteRecord(recordToDelete.id);
      toast.success(`Removed attendance record for ${recordToDelete.name}`);
      setRecordToDelete(null);
      await fetchLedger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove attendance record.");
    } finally {
      setDeletingRecord(false);
    }
  };

  const handleManualAdd = async () => {
    if (!selectedStudentId) {
      toast.error("Please select a student");
      return;
    }
    const student = enrolledStudents.find((s) => s.id === selectedStudentId);
    if (!student) return;

    setAddingLoading(true);
    try {
      await attendanceService.manualRecord(
        session.id,
        {
          id: student.id,
          name: student.name,
          regNumber: student.regNumber,
          courseId: session.courseId,
          topic: session.topic,
        },
        "verified",
      );
      toast.success(`Recorded verified attendance for ${student.name}`);
      setAddOpen(false);
      setSelectedStudentId("");
      await fetchLedger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record attendance.");
    } finally {
      setAddingLoading(false);
    }
  };

  return (
    <AppShell role="lecturer" title="Ledger">
      {/* Header Banner */}
      <Card className="overflow-hidden border-border/60 bg-gradient-to-r from-card via-card to-primary/5 rounded-2xl shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {liveCourseById(session.courseId)?.code ?? session.courseId}
              </span>
              <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                {session.topic}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {session.date} · {format12Hour(session.startTime)}
                {session.endTime ? ` – ${format12Hour(session.endTime)}` : ""}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {session.radius}m
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="h-8 rounded-xl px-3 text-xs font-semibold shadow-sm"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Manual Add
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl px-3 text-xs font-medium shadow-2xs"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl text-xs">
                <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer gap-2 py-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Export as CSV (Excel)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer gap-2 py-2">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>Download Official PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteSessionOpen(true)}
              className="h-8 rounded-xl px-2.5 text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
              title="Delete session"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Row with Icons and Distinct Color Accents */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Verified"
          value={present}
          icon={CheckCircle2}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          iconBgClassName="bg-emerald-500/10"
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />
        <MetricCard
          label="Absent"
          value={absent}
          icon={XCircle}
          iconClassName="text-rose-600 dark:text-rose-400"
          iconBgClassName="bg-rose-500/10"
          valueClassName="text-rose-600 dark:text-rose-400"
        />
        <MetricCard
          label="Enrolled"
          value={session.enrolledCount}
          icon={Users}
          iconClassName="text-blue-600 dark:text-blue-400"
          iconBgClassName="bg-blue-500/10"
          valueClassName="text-foreground"
        />
        <MetricCard
          label="Turnout"
          value={`${rate}%`}
          icon={Percent}
          iconClassName="text-violet-600 dark:text-violet-400"
          iconBgClassName="bg-violet-500/10"
          valueClassName="text-violet-600 dark:text-violet-400"
        />
      </div>

      {/* Student Roster Verification List */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Class Roster ({filteredAndSorted.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 w-44 rounded-xl pl-8 text-xs sm:w-52"
                placeholder="Search student..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-8 w-36 rounded-xl text-xs" aria-label="Sort attendance">
                <ArrowUpDown className="mr-1.5 h-3 w-3 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredAndSorted.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/70 bg-transparent">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">No records found</p>
              <p className="mt-1">Add students manually or check your search filters.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredAndSorted.map((row) => (
              <Card
                key={row.id || row.regNumber}
                className="rounded-xl border-border/60 shadow-sm transition-colors hover:bg-muted/10"
              >
                <CardContent className="flex items-center justify-between gap-3 p-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <StudentAvatar name={row.name} size="sm" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-semibold text-foreground">{row.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {row.regNumber || "No Reg No"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {row.verifiedAt && (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {format12Hour(row.verifiedAt)}
                      </span>
                    )}

                    <StatusBadge
                      tone={attendanceTone(row.status)}
                      className="capitalize px-2.5 py-0.5 text-[11px]"
                    >
                      {row.status}
                    </StatusBadge>

                    {row.id && (
                      <button
                        type="button"
                        onClick={() => setRecordToDelete({ id: row.id!, name: row.name })}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                        title={`Delete attendance for ${row.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Manual Add Student Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manual Student Check-In</DialogTitle>
            <DialogDescription>
              Mark attendance for an enrolled student who could not use their mobile device.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue placeholder="Choose an enrolled student..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {enrolledStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name} ({s.regNumber || s.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleManualAdd}
              disabled={addingLoading || !selectedStudentId}
              className="rounded-xl text-xs"
            >
              {addingLoading ? "Saving..." : "Record Verified Attendance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Entire Session Confirmation Dialog */}
      <AlertDialog open={deleteSessionOpen} onOpenChange={setDeleteSessionOpen}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Delete Attendance Session?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will permanently delete this session and all student check-in records associated
              with it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row items-center justify-end gap-2 pt-2">
            <AlertDialogCancel className="rounded-xl text-xs mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              disabled={deletingSession}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold"
            >
              {deletingSession ? "Deleting..." : "Delete Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Individual Student Record Confirmation Dialog */}
      <AlertDialog
        open={!!recordToDelete}
        onOpenChange={(open) => !open && setRecordToDelete(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Remove Attendance Record?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Remove verified attendance for{" "}
              <strong className="text-foreground">{recordToDelete?.name}</strong> from this session?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row items-center justify-end gap-2 pt-2">
            <AlertDialogCancel className="rounded-xl text-xs mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteRecord}
              disabled={deletingRecord}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold"
            >
              {deletingRecord ? "Removing..." : "Remove Record"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
