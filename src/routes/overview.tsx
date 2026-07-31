import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "System Overview — Smart Campus Presence" },
      {
        name: "description",
        content:
          "Problem statement, objectives, architecture, verification workflow and limitations of the Smart Campus Presence attendance system.",
      },
      { property: "og:title", content: "System Overview — Smart Campus Presence" },
      {
        property: "og:description",
        content: "Academic overview of the Smart Campus Presence attendance research prototype.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OverviewPage,
});

const ARCH = `Student or Lecturer Web Prototype
             |
        Authentication
             |
     Biometric API Service
             |
       Supabase Database`;

const FLOW = `Authenticate Student
        |
Validate Active Session
        |
Acquire GPS Reading
        |
Capture Facial Image
        |
Server Verifies Face
        |
Server Checks Geofence
        |
Record Attendance`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function OverviewPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-12 md:px-8">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">Back to home</Link>
          </Button>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
            System Overview
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Smart Campus Presence — Facial Recognition and GPS-Based Attendance System.
          </p>
        </div>

        <Section title="Problem statement">
          Manual and card-based attendance methods in tertiary institutions are vulnerable to proxy
          attendance, where a student records attendance on behalf of an absent colleague. Existing
          digital methods often verify a device rather than a person, or a network rather than a
          location.
        </Section>

        <Section title="Proposed solution">
          A two-factor attendance platform that verifies identity through facial recognition and
          presence through GPS geofencing. Attendance is recorded only after the server confirms
          both checks against a lecturer-created session.
        </Section>

        <Section title="System objectives">
          <ul className="list-disc space-y-1 pl-5">
            <li>Reduce proxy attendance in lecture sessions.</li>
            <li>Verify student identity against an enrolled facial record.</li>
            <li>Confirm student presence within a defined geofence of 50 to 100 metres.</li>
            <li>Provide lecturers with real-time and historical attendance records.</li>
            <li>Give students transparent visibility of their attendance performance.</li>
          </ul>
        </Section>

        <Section title="High-level architecture">
          <Card>
            <CardContent className="p-4">
              <pre className="overflow-x-auto text-xs leading-relaxed text-foreground">{ARCH}</pre>
            </CardContent>
          </Card>
        </Section>

        <Section title="Verification workflow">
          <Card>
            <CardContent className="p-4">
              <pre className="overflow-x-auto text-xs leading-relaxed text-foreground">{FLOW}</pre>
            </CardContent>
          </Card>
        </Section>

        <Section title="Security considerations">
          <ul className="list-disc space-y-1 pl-5">
            <li>Facial embeddings are never exposed to the client.</li>
            <li>The client captures an image but does not decide the match result.</li>
            <li>The client reports GPS data but does not decide the geofence result.</li>
            <li>Identity is taken from the authenticated session, never selected by the user.</li>
            <li>Captured images are temporary and are not persisted in the browser.</li>
          </ul>
        </Section>

        <Section title="Research limitations">
          <ul className="list-disc space-y-1 pl-5">
            <li>GPS accuracy degrades indoors and in dense building clusters.</li>
            <li>Basic facial matching is not equivalent to advanced liveness detection.</li>
            <li>Network access is required for server-side verification.</li>
            <li>This prototype uses simulated biometric and GPS responses.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
