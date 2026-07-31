import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useRoleGuard } from "@/hooks/useAuth";

export const Route = createFileRoute("/lecturer/profile")({
  head: () => ({
    meta: [
      { title: "Lecturer Profile — Smart Campus Presence" },
      { name: "description", content: "Your staff details and department information." },
      { property: "og:title", content: "Lecturer Profile — Smart Campus Presence" },
      { property: "og:description", content: "Staff profile details." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LecturerProfilePage,
});

function LecturerProfilePage() {
  const { user } = useRoleGuard("lecturer");
  if (!user) return null;

  const rows = [
    ["Full name", user.name],
    ["Staff ID", user.staffId],
    ["Email", user.email],
    ["Faculty", user.faculty],
    ["Department", user.department],
  ];

  return (
    <AppShell role="lecturer" title="Profile">
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
        </CardContent>
      </Card>
    </AppShell>
  );
}
