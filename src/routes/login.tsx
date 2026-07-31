import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, ScanFace } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/layout/PageHeader";
import { authService } from "@/services/authService";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/types";

const searchSchema = z.object({
  role: z.enum(["student", "lecturer"]).optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign In — Smart Campus Presence" },
      {
        name: "description",
        content: "Sign in to Smart Campus Presence as a student or lecturer to manage attendance.",
      },
      { property: "og:title", content: "Sign In — Smart Campus Presence" },
      {
        property: "og:description",
        content: "Secure sign-in for students and lecturers on Smart Campus Presence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [role, setRole] = useState<Role>(search.role ?? "student");
  const [email, setEmail] = useState("chinedu.okafor@university.edu.ng");
  const [password, setPassword] = useState("demo1234");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRole = (next: Role) => {
    setRole(next);
    setEmail(
      next === "student"
        ? "chinedu.okafor@university.edu.ng"
        : "adaeze.nwosu@university.edu.ng",
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await authService.signIn({ email, password, role });
      signIn(user, remember);
      toast.success(`Signed in as ${user.name}`);
      navigate({ to: role === "student" ? "/student/dashboard" : "/lecturer/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="rounded-lg bg-primary p-2 text-primary-foreground">
            <ScanFace className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-foreground">Smart Campus Presence</span>
        </Link>

        <Card>
          <CardContent className="p-6">
            <h1 className="text-xl font-semibold text-foreground">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Select your role and enter your institutional credentials.
            </p>

            <Tabs
              value={role}
              onValueChange={(v) => handleRole(v as Role)}
              className="mt-5"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="student">Student</TabsTrigger>
                <TabsTrigger value="lecturer">Lecturer</TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={remember}
                    onCheckedChange={(v) => setRemember(Boolean(v))}
                  />
                  <Label htmlFor="remember" className="text-sm font-normal">
                    Remember session
                  </Label>
                </div>
                <button
                  type="button"
                  className="text-sm font-medium text-primary underline underline-offset-4"
                  onClick={() =>
                    toast.info("Password reset is not available in this prototype.")
                  }
                >
                  Forgot password?
                </button>
              </div>

              {error && <ErrorState title="Sign-in failed" description={error} />}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>

            <div className="mt-6 space-y-1 text-center text-sm text-muted-foreground">
              <p>
                New student?{" "}
                <Link to="/register/student" className="font-medium text-primary underline underline-offset-4">
                  Create a student account
                </Link>
              </p>
              <p>
                Lecturer?{" "}
                <Link to="/register/lecturer" className="font-medium text-primary underline underline-offset-4">
                  Register as a lecturer
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Prototype credentials are pre-filled. Use a password shorter than 6 characters to see the
          invalid credentials state, or an email starting with &quot;offline&quot; for a network error.
        </p>
      </div>
    </div>
  );
}
