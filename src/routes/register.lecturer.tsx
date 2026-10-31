import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/layout/PageHeader";
import { authService } from "@/services/authService";
import { CourseService } from "@/services/courseService";
import { useAuth } from "@/hooks/useAuth";
import { useRegistrationScan } from "@/hooks/useRegistrationScan";

export const Route = createFileRoute("/register/lecturer")({
  head: () => ({
    meta: [
      { title: "Lecturer Registration — Smart Campus Presence" },
      {
        name: "description",
        content:
          "Register as a lecturer to create geofenced attendance sessions and monitor verified check-ins.",
      },
      { property: "og:title", content: "Lecturer Registration — Smart Campus Presence" },
      {
        property: "og:description",
        content: "Create a lecturer account for Smart Campus Presence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LecturerRegistration,
});

function LecturerRegistration() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [form, setForm] = useState({
    name: "",
    staffId: "",
    email: "",
    password: "",
    confirm: "",
    faculty: "",
    department: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const scan = useRegistrationScan({
    email: form.email,
    staffId: form.staffId,
  });
  const [faculties, setFaculties] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    CourseService.getFaculties()
      .then((items) => {
        if (!cancelled) {
          setFaculties(items);
          if (items.length && !items.some((item) => item.name === form.faculty)) {
            set("faculty", items[0].name);
          }
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Faculties could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const faculty = faculties.find((item) => item.name === form.faculty);
    if (!faculty) return setDepartments([]);
    let cancelled = false;
    CourseService.getDepartmentsByFaculty(faculty.id)
      .then((items) => {
        if (!cancelled) {
          setDepartments(items);
          if (items.length && !items.some((item) => item.name === form.department)) {
            set("department", items[0].name);
          }
        }
      })
      .catch(() => setDepartments([]));
    return () => {
      cancelled = true;
    };
  }, [faculties, form.faculty]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name || !form.staffId || !form.email)
      return setError("Complete all required fields.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setLoading(true);
    const user = await authService.registerLecturer(
      {
        name: form.name,
        staffId: form.staffId,
        email: form.email,
        faculty: form.faculty,
        department: form.department,
      },
      form.password,
    );
    signIn(user);
    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-background px-4 outline-none">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden />
            <h1 className="mt-4 text-xl font-semibold text-foreground">Account created</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your lecturer account has been created and is currently pending approval by the
              administration. You will be able to create attendance sessions once verified.
            </p>
            <Button className="mt-6 w-full" onClick={() => navigate({ to: "/lecturer/dashboard" })}>
              Continue to dashboard
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-background px-4 py-10 outline-none">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">Back to home</Link>
          </Button>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            Lecturer registration
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lecturers do not require facial enrollment.
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="lname">Full name</Label>
                <Input
                  id="lname"
                  name="name"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff">Staff ID</Label>
                <Input
                  id="staff"
                  name="staffId"
                  placeholder="ENG/LECT/087"
                  autoComplete="off"
                  value={form.staffId}
                  onChange={(e) => set("staffId", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lemail">Email address</Label>
                <Input
                  id="lemail"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="lpwd">Password</Label>
                  <Input
                    id="lpwd"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lpwd2">Confirm password</Label>
                  <Input
                    id="lpwd2"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={(e) => set("confirm", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lecturer-faculty">Faculty</Label>
                <Select value={form.faculty} onValueChange={(v) => { set("faculty", v); set("department", ""); }}>
                  <SelectTrigger id="lecturer-faculty" name="faculty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {faculties.map((faculty) => (
                      <SelectItem key={faculty.id} value={faculty.name}>
                        {faculty.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lecturer-department">Department</Label>
                <Select value={form.department} onValueChange={(v) => set("department", v)} disabled={!form.faculty || departments.length === 0}>
                  <SelectTrigger id="lecturer-department" name="department">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.name}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && <ErrorState title="Please review" description={error} />}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
