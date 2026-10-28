import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Preferences } from "@capacitor/preferences";
import { authService } from "@/services/authService";
import { pushService } from "@/services/mobile/pushService";
import { permissionsService } from "@/services/permissionsService";
import { attendanceService } from "@/services/attendanceService";
import { getSupabase } from "@/lib/supabase";
import { reportOperationalError } from "@/lib/operationalError";
import type { LecturerProfile, Role, StudentProfile, UserProfile, AdminProfile } from "@/types";

interface AuthContextValue {
  user: UserProfile | null;
  hydrated: boolean;
  signIn: (user: UserProfile) => void;
  signOut: () => void;
  /** Re-fetch the current user's profile from Supabase and update context. */
  refreshUser: () => Promise<UserProfile | null>;
}

const USER_STORAGE_KEY = "scp.current_user";

export function getRoleDashboardPath(role: Role): string {
  if (role === "student") return "/student/dashboard";
  if (role === "lecturer") return "/lecturer/dashboard";
  if (role === "admin") return "/admin/dashboard";
  return "/";
}

async function clearLegacyStoredUser(): Promise<void> {
  try {
    await Preferences.remove({ key: USER_STORAGE_KEY });
  } catch (error) {
    reportOperationalError("auth", "remove legacy native profile cache", error, {
      severity: "warning",
    });
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch (error) {
      reportOperationalError("auth", "remove legacy browser profile cache", error, {
        severity: "warning",
      });
    }
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const verifiedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let verificationGeneration = 0;

    // Profiles are authorization state and may contain biometric vectors. Never
    // hydrate them from mutable local JSON; Supabase's persisted auth session is
    // restored first and the profile is then fetched authoritatively.
    void clearLegacyStoredUser();

    const verifyCurrentUser = async () => {
      const generation = ++verificationGeneration;
      try {
        const live = await authService.currentUser();
        if (!cancelled && generation === verificationGeneration) {
          if (verifiedUserIdRef.current !== (live?.id ?? null)) {
            attendanceService.reset();
          }
          verifiedUserIdRef.current = live?.id ?? null;
          setUser(live);
        }
      } catch (error) {
        reportOperationalError("auth", "verify current session", error);
        if (!cancelled && generation === verificationGeneration) {
          setUser(null);
          attendanceService.reset();
        }
      } finally {
        if (!cancelled && generation === verificationGeneration) {
          setHydrated(true);
        }
      }
    };

    void verifyCurrentUser();

    // Keep in sync with Supabase auth lifecycle (e.g. token refreshes, sign in, sign out).
    const supabase = getSupabase();
    let authListenerSubscription: { unsubscribe: () => void } | null = null;
    if (supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled) return;
        if (event === "SIGNED_OUT" || !session) {
          verificationGeneration += 1;
          verifiedUserIdRef.current = null;
          setUser(null);
          attendanceService.reset();
          setHydrated(true);
        } else if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED" ||
          event === "INITIAL_SESSION"
        ) {
          // Supabase advises keeping this callback synchronous. Defer profile
          // access so it cannot deadlock the auth lifecycle callback.
          queueMicrotask(() => void verifyCurrentUser());
        }
      });
      authListenerSubscription = subscription;
    }

    const handleOnline = () => void verifyCurrentUser();
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
      }
      if (authListenerSubscription) {
        authListenerSubscription.unsubscribe();
      }
    };
  }, []);

  const signIn = useCallback((next: UserProfile) => {
    attendanceService.reset();
    verifiedUserIdRef.current = next.id;
    setUser(next);
    setHydrated(true);
    // Request all required hardware permissions (Camera, GPS Location, Notifications) seamlessly upon login
    void permissionsService
      .requestAllCorePermissionsOnLogin(next.id)
      .catch((error) =>
        reportOperationalError("permissions", "request core permissions after sign-in", error),
      );
  }, []);

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const current = await authService.currentUser();
      if (current) {
        setUser(current);
      } else {
        setUser(null);
        attendanceService.reset();
      }
      return current;
    } catch (error) {
      reportOperationalError("auth", "refresh profile", error);
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    const previous = user;
    setUser(null);
    verifiedUserIdRef.current = null;
    attendanceService.reset();
    void clearLegacyStoredUser();
    if (previous?.id) {
      // Best-effort: drop the Web Push subscription and Realtime channel.
      void pushService.teardown(previous.id);
    }
    await authService.signOut();
  }, [user]);

  const value = useMemo(
    () => ({ user, hydrated, signIn, refreshUser, signOut }),
    [user, hydrated, signIn, refreshUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

type RoleProfile<R extends Role> = R extends "student"
  ? StudentProfile
  : R extends "lecturer"
    ? LecturerProfile
    : AdminProfile;

export function useRoleGuard<R extends Role>(role: R) {
  const { user, hydrated } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
    } else if (user.role !== role) {
      navigate({ to: getRoleDashboardPath(user.role), replace: true });
    }
  }, [user, hydrated, role, navigate]);
  return {
    user: hydrated && user && user.role === role ? (user as RoleProfile<R>) : null,
    hydrated,
  };
}
