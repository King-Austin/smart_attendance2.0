import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COURSES, SESSION_PRESENT, courseById } from "@/data/mockData";
import { attendanceService } from "@/services/attendanceService";
import { useRoleGuard } from "@/hooks/useAuth";

export const Route = createFileRoute("/lecturer/sessions")({
  head: () => ({
    meta: [
      { title: "Session History — Smart Campus Presence" },
      {
        name: "description",
        content: "Review every attendance session you have held, with verified counts per course.",
      },
      { property: "og:title", content: "Session History — Smart Campus Presence" },
      {
        property: "og:description",
        content: "Filter past attendance sessions and open their verification ledgers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LecturerSessions,
});

function LecturerSessions() {
  const { user } = useRoleGuard("lecturer");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  if (!user) return null;

  const sessions = attendanceService
    .getSessions()
    .filter((s) => (courseFilter === "all" ? true : s.courseId === courseFilter))
    .filter((s) => (statusFilter === "all" ? true : s.status === statusFilter));

  return (
    <AppShell role="lecturer" title="Sessions">
      <PageHeader
        title="Session history"
        description="Every session you created, with the number of server-verified check-ins."
        actions={
          <Button asChild>
            <Link to="/lecturer/create-session">Create session</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap gap-3 p-5">
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="w-56" aria-label="Filter by course">
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions match these filters"
          description="Adjust the course or status filter to see more results."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {sessions.map((session) => {
                const present =
                  session.status === "active"
                    ? attendanceService.getFeed(session.id).filter((f) => f.status === "verified")
                        .length
                    : (SESSION_PRESENT[session.id] ?? 0);
                return (
                  <li key={session.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {courseById(session.courseId)?.code} — {session.topic}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.date} · {session.startTime}
                        {session.endTime ? `–${session.endTime}` : ""} · {session.radius} m radius
                      </p>
                    </div>
                    <StatusBadge tone={session.status === "active" ? "success" : "neutral"}>
                      {session.status === "active" ? "Live" : "Ended"}
                    </StatusBadge>
                    <p className="text-xs text-muted-foreground">
                      {present}/{session.enrolledCount} verified
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/lecturer/ledger/$sessionId" params={{ sessionId: session.id }}>
                        Ledger
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
