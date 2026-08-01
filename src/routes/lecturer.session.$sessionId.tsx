import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, Search, Square } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { courseById } from "@/data/mockData";
import { attendanceService } from "@/services/attendanceService";
import { useRoleGuard } from "@/hooks/useAuth";

export const Route = createFileRoute("/lecturer/session/$sessionId")({
  head: () => ({
    meta: [
      { title: "Live Session Monitor — Smart Campus Presence" },
      {
        name: "description",
        content:
          "Watch verified check-ins arrive in real time and end the attendance window when the lecture closes.",
      },
      { property: "og:title", content: "Live Session Monitor — Smart Campus Presence" },
      {
        property: "og:description",
        content: "Real-time verified attendance feed for an active geofenced session.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveSession,
});

function LiveSession() {
  const { user } = useRoleGuard("lecturer");
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState("");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => attendanceService.subscribe(() => setTick((t) => t + 1)), []);

  const session = attendanceService.getSession(sessionId);
  const isActive = session?.status === "active";

  useEffect(() => {
    if (!isActive) return;
    const feedTimer = setInterval(() => attendanceService.pushCheckIn(sessionId), 6000);
    const clock = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      clearInterval(feedTimer);
      clearInterval(clock);
    };
  }, [isActive, sessionId]);

  const feed = attendanceService.getFeed(sessionId);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return feed;
    return feed.filter(
      (f) => f.name.toLowerCase().includes(q) || f.regNumber.toLowerCase().includes(q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, query, tick]);

  if (!user) return null;

  if (!session) {
    return (
      <AppShell role="lecturer" title="Session">
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

  const verified = feed.filter((f) => f.status === "verified").length;
  const failed = feed.filter((f) => f.status === "failed").length;
  const rate = Math.round((verified / session.enrolledCount) * 100);
  const duration = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  const endSession = async () => {
    await attendanceService.endSession(session.id);
    toast.success("Session ended. No further check-ins will be accepted.");
  };

  return (
    <AppShell role="lecturer" title="Live Session">
      <PageHeader
        title={`${courseById(session.courseId)?.code} — ${session.topic}`}
        description={`Session ${session.id} · started ${session.startTime} · radius ${session.radius} m`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isActive ? (
              <StatusBadge tone="success" pulse>
                Live · {duration}
              </StatusBadge>
            ) : (
              <StatusBadge>Ended {session.endTime ?? ""}</StatusBadge>
            )}
            <Button
              variant="outline"
              onClick={() =>
                navigate({
                  to: "/lecturer/ledger/$sessionId",
                  params: { sessionId: session.id },
                })
              }
            >
              Ledger
            </Button>
            {isActive && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Square className="mr-2 h-4 w-4" />
                    End session
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>End this attendance session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Students who have not checked in will be marked absent. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it open</AlertDialogCancel>
                    <AlertDialogAction onClick={endSession}>End session</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Verified" value={verified} />
        <MetricCard label="Failed attempts" value={failed} />
        <MetricCard label="Enrolled" value={session.enrolledCount} />
        <MetricCard label="Attendance rate" value={`${rate}%`} />
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Verification feed</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  className="w-56 pl-9"
                  placeholder="Search name or reg. number"
                  aria-label="Search check-ins"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => toast.info("Export is a prototype stub in this build.")}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No check-ins yet"
                description="Verified students appear here as the server confirms liveness, face match and geofence."
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {filtered.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{entry.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{entry.regNumber}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {entry.distance} m · ±{entry.gpsAccuracy} m · score{" "}
                    {entry.faceScore.toFixed(2)}
                  </p>
                  <p className="text-xs font-medium text-foreground">{entry.verifiedAt}</p>
                  <StatusBadge tone={entry.status === "verified" ? "success" : "danger"}>
                    {entry.status === "verified" ? "Verified" : "Failed"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
