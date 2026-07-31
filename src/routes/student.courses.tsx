import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, ProgressBar } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { COURSE_SUMMARY, courseById } from "@/data/mockData";
import { useRoleGuard } from "@/hooks/useAuth";

export const Route = createFileRoute("/student/courses")({
  head: () => ({
    meta: [
      { title: "My Courses — Smart Campus Presence" },
      {
        name: "description",
        content: "Registered courses with sessions held, sessions attended and attendance percentage.",
      },
      { property: "og:title", content: "My Courses — Smart Campus Presence" },
      { property: "og:description", content: "Your registered courses and attendance rates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentCourses,
});

function StudentCourses() {
  const { user } = useRoleGuard("student");
  if (!user) return null;

  return (
    <AppShell role="student" title="Courses">
      <PageHeader title="My courses" description="Attendance performance per registered course." />
      <div className="grid gap-4 md:grid-cols-2">
        {COURSE_SUMMARY.map((s) => {
          const course = courseById(s.courseId);
          const pct = Math.round((s.attended / s.held) * 100);
          return (
            <Card key={s.courseId}>
              <CardContent className="space-y-3 p-6">
                <div>
                  <p className="text-base font-semibold text-foreground">{course?.code}</p>
                  <p className="text-sm text-muted-foreground">{course?.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{course?.lecturer}</p>
                </div>
                <ProgressBar value={pct} label={`${course?.code} attendance`} />
                <p className="text-sm text-muted-foreground">
                  {s.attended} of {s.held} sessions attended · {pct}%
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/student/history">View History</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
