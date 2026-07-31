import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardCheck,
  MapPin,
  Radio,
  ScanFace,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Campus Presence — Face and Location Attendance" },
      {
        name: "description",
        content:
          "A university attendance platform that verifies student identity with facial recognition and confirms presence with GPS geofencing.",
      },
      { property: "og:title", content: "Smart Campus Presence" },
      {
        property: "og:description",
        content:
          "Secure attendance through facial verification and GPS geofencing for tertiary institutions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: ScanFace,
    title: "Facial identity verification",
    body: "Students capture a live image at check-in. Matching is performed by the biometric service, not in the browser.",
  },
  {
    icon: MapPin,
    title: "GPS geofence enforcement",
    body: "Each session is anchored to the lecturer's location with a radius between 50 and 100 metres.",
  },
  {
    icon: Radio,
    title: "Real-time lecturer monitoring",
    body: "Lecturers watch verified check-ins arrive with face scores, distance and timestamps.",
  },
];

const STEPS = [
  "Lecturer creates an attendance session.",
  "Student opens the active session.",
  "Student completes GPS and face verification.",
  "Attendance is securely recorded.",
];

const TRUST = [
  "Server-side verification of every check-in",
  "Secure identity matching against enrolled records",
  "Controlled attendance radius per session",
  "Real-time attendance records for lecturers",
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-primary p-2 text-primary-foreground">
              <ScanFace className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-foreground">Smart Campus Presence</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/overview">System Overview</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">
              Smart Campus Presence
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              Secure Attendance Through Face and Location Verification
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              Smart Campus Presence combines facial recognition with GPS geofencing to reduce proxy
              attendance in universities and other tertiary institutions. Verification is completed
              on the server before any attendance record is written.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/login" search={{ role: "student" }}>
                  Student Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login" search={{ role: "lecturer" }}>
                  Lecturer Sign In
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/register/student">Create an Account</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Core features</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-border/80">
                <CardContent className="p-6">
                  <span className="inline-flex rounded-lg bg-primary/8 p-2 text-primary">
                    <f.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">How it works</h2>
            <ol className="mt-6 grid gap-4 md:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step} className="rounded-xl border border-border bg-background p-5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="mt-3 text-sm text-foreground">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Designed for academic integrity
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                The platform reduces opportunities for proxy attendance by requiring both identity
                and location evidence. It does not claim perfect accuracy: GPS readings vary indoors
                and basic face matching is not equivalent to advanced liveness detection.
              </p>
            </div>
            <ul className="space-y-3">
              {TRUST.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border bg-card">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-12 md:flex-row md:items-center md:justify-between md:px-8">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-6 w-6 text-primary" aria-hidden />
              <p className="text-sm text-foreground">
                Prototype for a master&apos;s research project. Biometric and GPS responses are
                simulated.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/overview">Read the system overview</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground">
          Smart Campus Presence — Facial Recognition and GPS-Based Attendance System
        </p>
      </footer>
    </div>
  );
}
