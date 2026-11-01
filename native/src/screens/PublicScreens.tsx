import { useState } from "react";
import { View, Pressable, Linking } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScanFace, MapPin, ShieldCheck, Radio, BookOpen, ArrowRight } from "lucide-react-native";
import { Shell } from "@/components/Shell";
import { Badge, Button, Card, Field, Heading, Label, Notice, Select } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { getSupabase } from "@/lib/supabase";
import { config } from "@/lib/config";
export function LandingScreen() {
  const { user } = useAuth();
  return (
    <Shell
      title="Attendance you can trust."
      subtitle="Live sessions. Verified presence. Clear records."
      publicPage
    >
      <LinearGradient
        colors={["#173fbc", "#0b1c4d"]}
        style={{ borderRadius: 28, padding: 26, gap: 18 }}
      >
        <View className="self-start rounded-full bg-white/15 px-3 py-2">
          <TextWhite small>SMART CAMPUS PRESENCE</TextWhite>
        </View>
        <TextWhite>Be present.{`\n`}Be verified.</TextWhite>
        <TextWhite small>
          A secure classroom check-in that brings live face verification and venue location
          together.
        </TextWhite>
        <Button
          variant="secondary"
          onPress={() => router.push(user ? `/${user.role}/dashboard` : "/login")}
        >
          {user ? "Open your dashboard" : "Sign in to your campus"}
        </Button>
      </LinearGradient>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button variant="secondary" onPress={() => router.push("/register/student")}>
            Student registration
          </Button>
        </View>
        <View className="flex-1">
          <Button variant="secondary" onPress={() => router.push("/register/lecturer")}>
            Lecturer registration
          </Button>
        </View>
      </View>
      <Label className="mt-3 text-xl font-bold">Three layers of confidence</Label>
      {[
        {
          title: "Your identity",
          text: "Live face challenges and your enrolled face template.",
          Icon: ScanFace,
        },
        {
          title: "Your location",
          text: "A fresh location reading checked against the session venue.",
          Icon: MapPin,
        },
        {
          title: "Your record",
          text: "A live attendance ledger for students, lecturers and administrators.",
          Icon: ShieldCheck,
        },
      ].map(({ title, text, Icon }) => (
        <Feature key={title} title={title} text={text} Icon={Icon} />
      ))}
      <Card className="gap-4">
        <Heading>From session to record</Heading>
        {[
          "Lecturer opens a live session",
          "Student verifies location and face",
          "Server validates and records attendance",
        ].map((text, i) => (
          <View key={text} className="flex-row gap-3">
            <Badge tone="primary">0{i + 1}</Badge>
            <Label className="flex-1 text-sm leading-5">{text}</Label>
          </View>
        ))}
      </Card>
      <Button variant="ghost" onPress={() => router.push("/overview")}>
        Explore the system
      </Button>
      <Button variant="ghost" onPress={() => router.push("/admin/auth")}>
        Administration
      </Button>
    </Shell>
  );
}
function TextWhite({ children, small = false }: { children: React.ReactNode; small?: boolean }) {
  return (
    <Label
      className={
        small ? "text-sm leading-6 text-white/80" : "text-4xl font-bold leading-[44px] text-white"
      }
    >
      {children}
    </Label>
  );
}
function Feature({ title, text, Icon }: { title: string; text: string; Icon: typeof ScanFace }) {
  const { palette } = useTheme();
  return (
    <Card className="flex-row items-start gap-4">
      <View className="rounded-2xl bg-primary/10 p-3">
        <Icon size={22} color={palette.primary} />
      </View>
      <View className="flex-1 gap-2">
        <Label className="text-base font-semibold">{title}</Label>
        <Label muted className="text-sm leading-5">
          {text}
        </Label>
      </View>
    </Card>
  );
}
export function OverviewScreen() {
  return (
    <Shell
      publicPage
      back
      title="A smarter presence system"
      subtitle="How Smart Campus Presence works"
    >
      {[
        {
          title: "Problem statement",
          text: "Manual attendance takes teaching time, produces incomplete records and makes proxy attendance difficult to detect.",
        },
        {
          title: "Proposed solution",
          text: "Combine live lecture sessions, venue geofencing, facial verification and a shared institutional attendance ledger.",
        },
        {
          title: "System objectives",
          text: "Reduce manual administration, improve record visibility, and give students and lecturers immediate feedback on check-in.",
        },
        {
          title: "High-level architecture",
          text: "Native mobile app → Supabase authentication and realtime data → protected attendance RPCs. Face enrollment and comparison use the configured biometric server.",
        },
        {
          title: "Verification workflow",
          text: "Sign in, choose the active lecture, verify a fresh venue location, complete the face challenge, then let the server validate and record attendance.",
        },
        {
          title: "Security considerations",
          text: "Role permissions and attendance acceptance remain server-side. The app protects session credentials and does not contain privileged server keys.",
        },
        {
          title: "Research limitations",
          text: "Indoor location has uncertainty. Camera performance depends on the device and lighting. A challenge-based face scan is not certified presentation-attack detection.",
        },
      ].map((section) => (
        <Card key={section.title} className="gap-3">
          <Label className="text-lg font-semibold">{section.title}</Label>
          <Label muted className="text-sm leading-6">
            {section.text}
          </Label>
        </Card>
      ))}
    </Shell>
  );
}
export function LoginScreen({ admin = false }: { admin?: boolean }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "lecturer" | "admin">(admin ? "admin" : "student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [setup, setSetup] = useState(false);
  const [name, setName] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (setup && password.length < 12)
        throw new Error("Use at least 12 characters for the administrator password.");
      if (!email.trim() || !password) throw new Error("Enter your email address and password.");
      const profile = setup
        ? await authService.registerAdmin({ name, email: email.trim(), password, setupCode })
        : await authService.signIn({ email: email.trim(), password, role });
      if (profile.role !== role) {
        await authService.signOut();
        throw new Error(
          `This account is registered as ${profile.role}. Choose the correct portal.`,
        );
      }
      signIn(profile);
      router.replace(`/${profile.role}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setError(null);
    try {
      if (!email.trim()) throw new Error("Enter your email address first.");
      const sb = getSupabase();
      if (!sb) throw new Error("The authentication server is not configured.");
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${config.apiBase}/login`,
      });
      if (error) throw error;
      setMessage(
        "If your account exists, a password-reset email has been requested. Complete it using the hosted account flow.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    }
  };
  return (
    <Shell
      publicPage
      back
      title={admin ? "System administration" : "Welcome back"}
      subtitle={admin ? "Manage your campus securely." : "Sign in to your institutional account."}
    >
      <Card className="gap-5">
        <View className="flex-row gap-2">
          {(admin ? ["admin"] : ["student", "lecturer"]).map((value) => (
            <View className="flex-1" key={value}>
              <Button
                small
                variant={role === value ? "primary" : "secondary"}
                onPress={() => setRole(value as typeof role)}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </Button>
            </View>
          ))}
        </View>
        {setup && (
          <>
            <Field label="Administrator name" value={name} onChangeText={setName} />
            <Field
              label="Institution setup code"
              value={setupCode}
              onChangeText={setSetupCode}
              secureTextEntry
            />
          </>
        )}
        <Field
          label="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={setup ? "new-password" : "current-password"}
        />
        {error && <Notice danger text={error} />}
        {message && <Notice text={message} />}
        <Button busy={busy} onPress={() => void submit()}>
          {setup ? "Initialize administrator account" : "Sign in"}
        </Button>
        <Button variant="ghost" onPress={() => void reset()}>
          Forgot password?
        </Button>
      </Card>
      {admin ? (
        <>
          <Notice text="Administrator privileges must be provisioned and validated by the backend. Creating an account does not grant client-side privileges." />
          <Button variant="secondary" onPress={() => setSetup(!setup)}>
            {setup ? "Return to administrator login" : "Initialize an administrator account"}
          </Button>
        </>
      ) : (
        <>
          <Label muted className="text-center text-sm">
            New to your campus?
          </Label>
          <Button
            variant="secondary"
            onPress={() =>
              router.push(role === "lecturer" ? "/register/lecturer" : "/register/student")
            }
          >
            Create your account
          </Button>
          <Button variant="ghost" onPress={() => router.push("/admin/auth")}>
            Administrator portal
          </Button>
        </>
      )}
    </Shell>
  );
}
