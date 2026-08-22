import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Filter, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
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
import { StatusBadge, attendanceTone } from "@/components/ui/status-badge";
import { courseById as liveCourseById } from "@/services/courseService";
import { format12Hour } from "@/services/attendanceService";
import { useRoleGuard } from "@/hooks/useAuth";
import { useStudentAttendance } from "@/hooks/useStudentAttendance";
import { useSessions } from "@/hooks/useSessions";
import { useCourses } from "@/hooks/useCourses";

export const Route = createFileRoute("/student/history")({
  head: () => ({
    meta: [
      { title: "Attendance History — Smart Campus Presence" },
      {
        name: "description",
        content:
          "Filter and review your verified, missed and failed attendance records by course and date.",
      },
      { property: "og:title", content: "Attendance History — Smart Campus Presence" },
      { property: "og:description", content: "Your full attendance record history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useRoleGuard("student");
  const [course, setCourse] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const sessions = useSessions();
  const active = sessions.find((s) => s.status === "active") ?? null;
  const { records, summaries, loading } = useStudentAttendance(
    user?.id ?? "",
    user?.courseIds ?? [],
    active?.id ?? null,
  );
  const { courses } = useCourses();

  const held = summaries.reduce((s, c) => s + c.held, 0);
  const attended = summaries.reduce((s, c) => s + c.attended, 0);
  const overall = held ? Math.round((attended / held) * 100) : 0;

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (course !== "all" && r.courseId !== course) return false;
        if (status !== "all" && r.status !== status) return false;
        if (from && r.date < from) return false;
        if (to && r.date > to) return false;
        return true;
      }),
    [records, course, status, from, to],
  );

  if (!user) return null;

  return (
    <AppShell role="student" title="History">
      {/* Header Banner */}
      <Card className="overflow-hidden border-border/60 bg-gradient-to-r from-card via-card to-primary/5 rounded-2xl shadow-sm">
        <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Attendance Ledger
            </h1>
            <p className="text-xs font-medium text-muted-foreground">
              {attended} of {held} sessions attended ({overall}%)
            </p>
          </div>
          <span className="inline-flex items-center gap-1 self-start rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:self-auto">
            {filtered.length} {filtered.length === 1 ? "Record" : "Records"}
          </span>
        </CardContent>
      </Card>

      {/* Filter Card */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase text-muted-foreground">
              Course
            </Label>
            <Select value={course} onValueChange={setCourse}>
              <SelectTrigger className="h-9 rounded-xl text-xs" aria-label="Filter by course">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase text-muted-foreground">
              Status
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 rounded-xl text-xs" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="from"
              className="text-[11px] font-semibold uppercase text-muted-foreground"
            >
              From
            </Label>
            <Input
              id="from"
              type="date"
              className="h-9 rounded-xl text-xs"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="to"
              className="text-[11px] font-semibold uppercase text-muted-foreground"
            >
              To
            </Label>
            <Input
              id="to"
              type="date"
              className="h-9 rounded-xl text-xs"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Desktop Table View */}
      <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:block">
        {loading ? (
          <p className="p-6 text-xs text-muted-foreground">Loading records…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">
            No matching attendance records found.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left text-[11px] font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Face score</th>
                <th className="px-4 py-3">Distance</th>
                <th className="px-4 py-3">Verified at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-muted/10">
                  <td className="px-4 py-3 font-medium text-foreground">{r.date}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {liveCourseById(r.courseId)?.code ?? r.courseId}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                    {r.topic || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      tone={attendanceTone(r.status)}
                      className="capitalize px-2 py-0.5 text-[11px]"
                    >
                      {r.status}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.faceScore ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.distance !== null ? `${r.distance}m` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {format12Hour(r.verifiedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Card List View */}
      <div className="space-y-2 md:hidden">
        {loading ? (
          <p className="p-4 text-xs text-muted-foreground">Loading records…</p>
        ) : filtered.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/70 bg-transparent">
            <CardContent className="p-6 text-center text-xs text-muted-foreground">
              No matching records.
            </CardContent>
          </Card>
        ) : (
          filtered.map((r) => (
            <Card
              key={r.id}
              className="rounded-xl border-border/60 shadow-sm transition-colors hover:bg-muted/10"
            >
              <CardContent className="space-y-1.5 p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    {liveCourseById(r.courseId)?.code ?? r.courseId}
                  </span>
                  <StatusBadge
                    tone={attendanceTone(r.status)}
                    className="capitalize px-2 py-0.5 text-[11px]"
                  >
                    {r.status}
                  </StatusBadge>
                </div>
                {r.topic && <p className="truncate text-muted-foreground">{r.topic}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {r.date} {r.verifiedAt ? `· ${format12Hour(r.verifiedAt)}` : ""}
                  </span>
                  {r.distance !== null && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {r.distance}m
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
