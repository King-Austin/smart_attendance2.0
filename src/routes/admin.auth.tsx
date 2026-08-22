import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";
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

    // Verify system admin registration passcode
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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-slate-900 border border-slate-800 px-4 py-2.5 shadow-xl transition-colors hover:border-slate-700"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-900/50">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-semibold text-slate-200 text-sm tracking-tight">
              Smart Campus <span className="text-emerald-400">Admin</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            System Administration
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Authorized administrative personnel only. Realtime attendance auditing & management.
          </p>
        </div>

        {/* Card Form */}
        <Card className="border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl">
          <CardContent className="p-6">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as "login" | "register")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 bg-slate-950 border border-slate-800">
                <TabsTrigger
                  value="login"
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs"
                >
                  Admin Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs"
                >
                  Create Admin
                </TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              {tab === "login" && (
                <form onSubmit={handleLogin} className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-email" className="text-slate-300 text-xs">
                      Administrator Email
                    </Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@university.edu"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="admin-pass" className="text-slate-300 text-xs">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="admin-pass"
                        type={showLoginPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-emerald-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((s) => !s)}
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-200"
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

                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-950"
                    disabled={loginLoading}
                  >
                    {loginLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="mr-2 h-4 w-4" />
                    )}
                    Access Dashboard
                  </Button>
                </form>
              )}

              {/* Registration Tab */}
              {tab === "register" && (
                <form onSubmit={handleRegister} className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name" className="text-slate-300 text-xs">
                      Full Name
                    </Label>
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder="Dr. Admin Name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email" className="text-slate-300 text-xs">
                      Official Admin Email
                    </Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="admin@university.edu"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-pass" className="text-slate-300 text-xs">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="reg-pass"
                        type={showRegPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="••••••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-emerald-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword((s) => !s)}
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-200"
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
                      <Label htmlFor="reg-passcode" className="text-slate-300 text-xs flex items-center gap-1">
                        <KeyRound className="h-3 w-3 text-emerald-400" />
                        Security Passcode
                      </Label>
                      <span className="text-[10px] text-slate-500">Required for verification</span>
                    </div>
                    <Input
                      id="reg-passcode"
                      type="password"
                      placeholder="Enter institutional setup passcode"
                      value={regPasscode}
                      onChange={(e) => setRegPasscode(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-emerald-500"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-950"
                    disabled={regLoading}
                  >
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

            <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
              <Link
                to="/login"
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors underline underline-offset-4"
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
