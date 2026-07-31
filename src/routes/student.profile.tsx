import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useRoleGuard } from "@/hooks/useAuth";

export const Route = createFileRoute("/student/profile")({
  head: () => ({
    meta: [
      { title: "Student Profile — Smart Campus Presence" },
      {
        name: "description",
        content: "Your personal details, academic information and facial enrollment status.",
      },
      { property: "og:title", content: "Student Profile — Smart Campus Presence" },
      { property: "og:description", content: "Personal and academic profile details." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentProfilePage,
});

function StudentProfilePage() {
  const { user } = useRoleGuard("student");
  if (!user) return null;

  const rows = [
    ["Full name", user.name],
    ["Registration number", user.regNumber],
    ["Email", user.email],
    ["Faculty", user.faculty],
    ["Department", user.department],
    ["Level", user.level],
    ["Semester", user.semester],
    ["Academic session", user.academicSession],
    ["Phone", user.phone ?? "—"],
  ];

  return (
    <AppShell role="student" title="Profile">
      <PageHeader title="Profile" description="Identity is taken from your authenticated session." />
      <Card>
        <CardContent className="p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Face enrollment:</span>
            <StatusBadge tone={user.faceEnrolled ? "success" : "warning"}>
              {user.faceEnrolled ? "Enrolled" : "Not enrolled"}
            </StatusBadge>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Facial embeddings are stored server-side and are never exposed to this browser.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
