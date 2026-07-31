import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { COURSES, COURSE_SUMMARY, STUDENT_RECORDS, courseById } from "@/data/mockData";
import { useRoleGuard } from "@/hooks/useAuth";

export const Route = createFileRoute("/student/history")({
  head: () => ({
    meta: [
      { title: "Attendance History — Smart Campus Presence" },
      {
        name: "description",
        content: "Filter and review your verified, missed and failed attendance records by course and date.",
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

  const held = COURSE_SUMMARY.reduce((s, c) => s + c.held, 0);
  const attended = COURSE_SUMMARY.reduce((s, c) => s + c.attended, 0);

  const records = useMemo(
    () =>
      STUDENT_RECORDS.filter((r) => {
        if (course !== "all" && r.courseId !== course) return false;
        if (status !== "all" && r.status !== status) return false;
        if (from && r.date < from) return false;
        if (to && r.date > to) return false;
        return true;
      }),
    [course, status, from, to],
  );

  if (!user) return null;

  return (
    <AppShell role="student" title="Attendance History">
      <PageHeader
        title="Attendance history"
        description={`Overall attendance: ${Math.round((attended / held) * 100)}% (${attended} of ${held} sessions)`}
      />

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select value={course} onValueChange={setCourse}>
              <SelectTrigger aria-label="Filter by course">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {COURSES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
                <SelectItem value="failed">Failed verification</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
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
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3">{r.date}</td>
                <td className="px-4 py-3">{courseById(r.courseId)?.code}</td>
                <td className="px-4 py-3">{r.topic}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={attendanceTone(r.status)} className="capitalize">
                    {r.status}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3">{r.faceScore ?? "—"}</td>
                <td className="px-4 py-3">{r.distance !== null ? `${r.distance} m` : "—"}</td>
                <td className="px-4 py-3">{r.verifiedAt ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {records.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-2 p-4 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">{courseById(r.courseId)?.code}</p>
                <StatusBadge tone={attendanceTone(r.status)} className="capitalize">
                  {r.status}
                </StatusBadge>
              </div>
              <p className="text-muted-foreground">{r.topic}</p>
              <p className="text-muted-foreground">
                {r.date} · {r.verifiedAt ?? "—"} · score {r.faceScore ?? "—"} ·{" "}
                {r.distance !== null ? `${r.distance} m` : "—"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
