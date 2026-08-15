import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useRoleGuard } from "@/hooks/useAuth";
import { useCourses } from "@/hooks/useCourses";

export const Route = createFileRoute("/lecturer/courses")({
  head: () => ({
    meta: [
      { title: "Assigned Courses — Smart Campus Presence" },
      {
        name: "description",
        content: "Courses assigned to you for attendance session creation and monitoring.",
      },
      { property: "og:title", content: "Assigned Courses — Smart Campus Presence" },
      { property: "og:description", content: "Your assigned teaching courses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LecturerCourses,
});

function LecturerCourses() {
  const { user } = useRoleGuard("lecturer");
  const { courses, loading } = useCourses();
  if (!user) return null;
  const mine = courses.filter((c) => user.courseIds.includes(c.id));

  return (
    <AppShell role="lecturer" title="Courses">
      <PageHeader title="Assigned courses" description="Courses you can create sessions for." />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your courses…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {mine.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-6">
                <p className="text-base font-semibold text-foreground">{c.code}</p>
                <p className="text-sm text-muted-foreground">{c.title}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {c.creditUnit} credit units · {c.department}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
