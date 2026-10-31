import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, MapPin, Radio, ScanFace, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, getRoleDashboardPath } from "@/hooks/useAuth";
import { ThemeSelector } from "@/components/layout/ThemeSelector";

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
    title: "Confirm the right student",
    body: "Match each check-in against the student's enrolled facial record.",
  },
  {
    icon: MapPin,
    title: "Verify classroom presence",
    body: "Require students to be inside the lecturer's session geofence before attendance is recorded.",
  },
  {
    icon: Radio,
    title: "Review attendance as it happens",
    body: "Give lecturers a live roster while students keep a clear history of their records.",
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
      <header className="border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-primary p-2 text-primary-foreground">
              <ScanFace className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-foreground">Smart Campus Presence</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSelector />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/overview">Overview</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        <section className="overflow-hidden border-b border-border bg-card">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1.1fr_0.9fr] md:px-8 md:py-20">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                <Smartphone className="h-4 w-4" aria-hidden /> Built for Android and the web
              </div>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-foreground md:text-6xl">
                Attendance that verifies the person and the place
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground md:text-lg">
                Confirm student identity with face matching and classroom presence with GPS geofencing.
              </p>
              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="shadow-md shadow-primary/15">
                  <a
                    href={ANDROID_APK_DOWNLOAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    download="smart-attendance.apk"
                  >
                    <Download className="mr-2 h-4 w-4" aria-hidden />
                    Download Android App
                  </a>
                </Button>
                <Link
                  to="/login"
                  search={{ role: "student" }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Sign in on the web <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>

            <figure className="relative mx-auto w-full max-w-sm md:justify-self-end">
              <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-primary/8" aria-hidden />
              <div className="overflow-hidden rounded-[2rem] border border-border bg-background p-2 shadow-[0_24px_70px_-30px_oklch(0.46_0.21_262/0.45)]">
                <img
                  src="/smart-attendance-overview.png"
                  alt="Smart Campus Presence system overview displayed in the Android app"
                  width={1080}
                  height={2460}
                  fetchPriority="high"
                  className="aspect-[9/16] w-full rounded-[1.5rem] object-cover object-top"
                />
              </div>
              <figcaption className="mt-3 text-center text-xs text-muted-foreground">
                The live Android application on a connected device
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-20">
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-balance text-foreground">
            Two checks before one attendance record
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Identity and location checks work together so lecturers can focus on the class, not the register.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-5">
            {FEATURES.map((feature, index) => (
              <article
                key={feature.title}
                className={`rounded-2xl border border-border p-6 ${
                  index === 0
                    ? "bg-primary text-primary-foreground md:col-span-3"
                    : index === 1
                      ? "bg-secondary md:col-span-2"
                      : "bg-card md:col-span-5 md:grid md:grid-cols-[auto_1fr] md:items-center md:gap-5"
                }`}
              >
                <span
                  className={`inline-flex rounded-xl p-2 ${index === 0 ? "bg-white/15" : "bg-primary/10 text-primary"}`}
                >
                  <feature.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className={`mt-4 text-lg font-semibold ${index === 2 ? "md:mt-0" : ""}`}>
                    {feature.title}
                  </h3>
                  <p className={`mt-2 max-w-xl text-sm leading-relaxed ${index === 0 ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {feature.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-20">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">From session to record</h2>
            <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step} className="bg-card p-5">
                  <span className="font-mono text-sm font-semibold tabular-nums text-primary">
                    0{index + 1}
                  </span>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-foreground">{step}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex flex-col items-start justify-between gap-5 border-t border-border pt-8 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-xl font-semibold text-foreground">Already part of your institution?</h3>
                <p className="mt-1 text-sm text-muted-foreground">Open the appropriate portal to manage or record attendance.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link to="/login" search={{ role: "student" }}>Student sign in</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/login" search={{ role: "lecturer" }}>Lecturer sign in</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground">
          Smart Campus Presence. Campus attendance management system.
        </p>
      </footer>
    </div>
  );
}
