import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SESSION_PRESENT, courseById, generateLedger } from "@/data/mockData";
import { attendanceService } from "@/services/attendanceService";
import { useRoleGuard } from "@/hooks/useAuth";

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

function Ledger() {
  const { user } = useRoleGuard("lecturer");
  const { sessionId } = Route.useParams();
  const [showAnchor, setShowAnchor] = useState(false);

  if (!user) return null;

  const session = attendanceService.getSession(sessionId);
  if (!session) {
    return (
      <AppShell role="lecturer" title="Ledger">
        <EmptyState
          title="Session not found"
          description="This session may have been removed."
          action={
            <Button asChild>
              <Link to="/lecturer/sessions">Back to sessions</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const present =
    session.status === "active"
      ? attendanceService.getFeed(session.id).filter((f) => f.status === "verified").length
      : (SESSION_PRESENT[session.id] ?? 0);
  const rows = generateLedger(session.id, session.enrolledCount, present);
  const absent = session.enrolledCount - present;

  return (
    <AppShell role="lecturer" title="Ledger">
      <PageHeader
        title={`${courseById(session.courseId)?.code} — ${session.topic}`}
        description={`Session ${session.id} · ${session.date} · ${session.startTime}${session.endTime ? `–${session.endTime}` : ""}`}
        actions={
          <Button
            variant="outline"
            onClick={() => toast.info("CSV and PDF export are prototype stubs in this build.")}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV / PDF
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Verified" value={present} />
        <MetricCard label="Absent" value={absent} />
        <MetricCard label="Enrolled" value={session.enrolledCount} />
        <MetricCard
          label="Attendance rate"
          value={`${Math.round((present / session.enrolledCount) * 100)}%`}
        />
      </div>

      <Card>
        <CardContent className="p-5">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setShowAnchor((v) => !v)}
            aria-expanded={showAnchor}
          >
            <span className="text-sm font-semibold text-foreground">
              Session anchor and geofence details
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${showAnchor ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {showAnchor && (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Anchor latitude</dt>
                <dd className="font-mono text-foreground">{session.anchor.lat.toFixed(6)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Anchor longitude</dt>
                <dd className="font-mono text-foreground">{session.anchor.lng.toFixed(6)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Anchor accuracy</dt>
                <dd className="text-foreground">{session.anchor.accuracy} m</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Enforced radius</dt>
                <dd className="text-foreground">{session.radius} m</dd>
              </div>
              {session.note && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Note to students</dt>
                  <dd className="text-foreground">{session.note}</dd>
                </div>
              )}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.regNumber} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{row.regNumber}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {row.status === "verified"
                    ? `${row.distance} m · score ${row.faceScore?.toFixed(2)} · ${row.verifiedAt}`
                    : "No verified check-in recorded"}
                </p>
                <StatusBadge tone={row.status === "verified" ? "success" : "danger"}>
                  {row.status === "verified" ? "Verified" : "Absent"}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </AppShell>
  );
}
