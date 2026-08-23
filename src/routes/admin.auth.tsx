import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, Loader2, Lock, ScanFace, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authService } from "@/services/authService";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin/auth")({
  head: () => ({
    meta: [
      { title: "Admin Portal — Smart Campus Presence" },
      {
        name: "description",
        content: "Institutional administrator sign-in and account initialization portal.",
      },
      { property: "og:title", content: "Admin Portal — Smart Campus Presence" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminAuthPage,
});

const DEFAULT_ADMIN_KEY = "CAMPUS_ADMIN_2026";

function AdminAuthPage() {
  const navigate = useNavigate();
  const { signIn, user, hydrated } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Registration form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasscode, setRegPasscode] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    if (!hydrated || !user) return;
    if (user.role === "admin") {
      navigate({ to: "/admin/dashboard", replace: true });
    }
  }, [user, hydrated, navigate]);

  if (hydrated && user?.role === "admin") {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const authUser = await authService.signIn({
        email: loginEmail.trim(),
        password: loginPassword,
        role: "admin",
      });
      if (authUser.role !== "admin") {
        throw new Error("This account does not have administrator privileges.");
      }
      signIn(authUser);
      toast.success(`Welcome back, ${authUser.name}`);
      navigate({ to: "/admin/dashboard", replace: true });
    } catch (err) {
      const description =
        err instanceof Error
          ? err.message
          : "Invalid admin credentials. Please verify your email and password.";
      toast.error("Sign-in failed", { description });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const expectedKey =
      (import.meta.env.VITE_ADMIN_REGISTRATION_KEY as string | undefined) ?? DEFAULT_ADMIN_KEY;

    if (regPasscode.trim() !== expectedKey) {
      toast.error("Access Denied", {
        description: "Invalid Admin Security Passcode. Contact the institutional system administrator.",
      });
      return;
    }

    if (regPassword.length < 6) {
      toast.error("Weak Password", {
        description: "Admin password must be at least 6 characters.",
      });
      return;
    }

    setRegLoading(true);
    try {
      const newAdmin = await authService.registerAdmin({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
      });
      signIn(newAdmin);
      toast.success("Administrator account initialized successfully!");
      navigate({ to: "/admin/dashboard", replace: true });
    } catch (err) {
      const description =
        err instanceof Error
          ? err.message
          : "Failed to initialize administrator account. Please try again.";
      toast.error("Registration failed", { description });
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand Link */}
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="rounded-lg bg-primary p-2 text-primary-foreground">
            <ScanFace className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-foreground">Smart Campus Presence</span>
        </Link>

        {/* Card Container */}
        <Card className="border border-border/80 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">System Administration</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Institutional portal for attendance oversight, course catalog, and lecturer approvals.
            </p>

            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as "login" | "register")}
              className="mt-5 w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Admin Sign In</TabsTrigger>
                <TabsTrigger value="register">Create Admin</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              {tab === "login" && (
                <form onSubmit={handleLogin} className="mt-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-email">Administrator Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@university.edu"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="admin-pass">Password</Label>
                    <div className="relative">
                      <Input
                        id="admin-pass"
                        type={showLoginPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((s) => !s)}
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label={showLoginPassword ? "Hide password" : "Show password"}
                      >
                        {showLoginPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loginLoading}>
                    {loginLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="mr-2 h-4 w-4" />
                    )}
                    Access Admin Dashboard
                  </Button>
                </form>
              )}

              {/* Registration Tab */}
              {tab === "register" && (
                <form onSubmit={handleRegister} className="mt-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name">Full Name</Label>
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder="Dr. Admin Name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email">Official Admin Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="admin@university.edu"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-pass">New Password</Label>
                    <div className="relative">
                      <Input
                        id="reg-pass"
                        type={showRegPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="••••••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword((s) => !s)}
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label={showRegPassword ? "Hide password" : "Show password"}
                      >
                        {showRegPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="reg-passcode" className="flex items-center gap-1">
                        <KeyRound className="h-3.5 w-3.5 text-primary" />
                        Security Passcode
                      </Label>
                      <span className="text-[11px] text-muted-foreground">Required for setup</span>
                    </div>
                    <Input
                      id="reg-passcode"
                      type="password"
                      placeholder="Enter setup passcode"
                      value={regPasscode}
                      onChange={(e) => setRegPasscode(e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={regLoading}>
                    {regLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Initialize Administrator
                  </Button>
                </form>
              )}
            </Tabs>

            <div className="mt-6 pt-4 border-t border-border/60 text-center">
              <Link
                to="/login"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
              >
                ← Return to Student & Lecturer Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
