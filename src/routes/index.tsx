import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, MapPin, Radio, ScanFace, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth, getRoleDashboardPath } from "@/hooks/useAuth";

export const ANDROID_APK_DOWNLOAD_URL =
  "https://jtezcxkjjrrzqakrfukf.supabase.co/storage/v1/object/public/app-releases/smart-attendance.apk";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Campus Presence — Attendance Platform" },
      {
        name: "description",
        content: "Fast, secure attendance management with facial verification and GPS geofencing.",
      },
      { property: "og:title", content: "Smart Campus Presence" },
      {
        property: "og:description",
        content: "Fast, secure attendance management with facial verification and GPS geofencing.",
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
    title: "Facial Verification",
    body: "Quick and secure identity verification during class check-in.",
  },
  {
    icon: MapPin,
    title: "Classroom Geofencing",
    body: "Automatic location validation to ensure presence in class sessions.",
  },
  {
    icon: Radio,
    title: "Live Attendance Tracking",
    body: "Instant session updates and real-time attendance rosters.",
  },
];

const STEPS = [
  "Lecturer starts the attendance session",
  "Students check in within the classroom",
  "Instant verification confirms attendance",
  "Attendance records are updated in real time",
];

function Landing() {
  const { user, hydrated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && user) {
      navigate({ to: getRoleDashboardPath(user.role), replace: true });
    }
  }, [user, hydrated, navigate]);

  // While checking auth status or while redirecting logged-in user, do not render landing
  if (!hydrated || user) {
    return null;
  }

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
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <a href={ANDROID_APK_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" download="smart-attendance.apk">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download App (.APK)
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/overview">Overview</Link>
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
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Smartphone className="h-3.5 w-3.5" /> Android Mobile App Available
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              Effortless Attendance Verification for Higher Education
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              Seamlessly record and manage attendance with fast facial verification, Bluetooth beacon detection, and automated classroom location checks.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="shadow-md">
                <a href={ANDROID_APK_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" download="smart-attendance.apk">
                  <Download className="mr-2 h-4 w-4" />
                  Download Android App (.APK)
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login" search={{ role: "student" }}>
                  Student Web Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/login" search={{ role: "lecturer" }}>
                  Lecturer Portal
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Key Capabilities
          </h2>
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

        {/* Dedicated Mobile App Banner */}
        <section className="border-y border-border bg-card/60">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-8">
            <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-card p-6 md:flex-row md:items-center md:p-8">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <Smartphone className="h-4 w-4" /> Native Mobile Experience
                </div>
                <h3 className="mt-2 text-xl font-semibold text-foreground md:text-2xl">
                  Get the Smart Attendance Android App
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Install the native APK directly on your Android phone for instant camera face scans, fast GNSS satellite geofencing, and automated check-in notifications.
                </p>
              </div>
              <Button asChild size="lg" className="shrink-0">
                <a href={ANDROID_APK_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" download="smart-attendance.apk">
                  <Download className="mr-2 h-4 w-4" />
                  Download APK (v2.0)
                </a>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">How It Works</h2>
            <ol className="mt-6 grid gap-4 md:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step} className="rounded-xl border border-border bg-background p-5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="mt-3 text-sm font-medium text-foreground">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground">
          Smart Campus Presence — Campus Attendance Management System
        </p>
      </footer>
    </div>
  );
}
