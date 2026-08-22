import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Preferences } from "@capacitor/preferences";
import { authService } from "@/services/authService";
import { pushService } from "@/services/mobile/pushService";
import { getSupabase } from "@/lib/supabase";
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

async function saveStoredUser(profile: UserProfile | null): Promise<void> {
  try {
    if (profile) {
      await Preferences.set({ key: USER_STORAGE_KEY, value: JSON.stringify(profile) });
    } else {
      await Preferences.remove({ key: USER_STORAGE_KEY });
    }
  } catch {}
  if (typeof window !== "undefined") {
    try {
      if (profile) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
      } else {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch {}
  }
}

async function loadStoredUser(): Promise<UserProfile | null> {
  try {
    const { value } = await Preferences.get({ key: USER_STORAGE_KEY });
    if (value) return JSON.parse(value);
  } catch {}
  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem(USER_STORAGE_KEY);
      if (local) return JSON.parse(local);
    } catch {}
  }
  return null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // 1. Instant hydration from cached storage (0ms delay)
    (async () => {
      const cached = await loadStoredUser();
      if (!cancelled && cached) {
        setUser(cached);
        setHydrated(true);
      }

      // 2. Background verification against Supabase session
      try {
        const live = await authService.currentUser();
        if (!cancelled) {
          if (live) {
            setUser(live);
            await saveStoredUser(live);
          } else if (!cached) {
            setUser(null);
            await saveStoredUser(null);
          }
        }
      } catch {
        // If offline or network issue, preserve the cached session
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    })();

    // 3. Keep in sync with Supabase auth lifecycle (e.g. token refreshes, sign in, sign out)
    const supabase = getSupabase();
    let authListenerSubscription: { unsubscribe: () => void } | null = null;
    if (supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (cancelled) return;
        if (event === "SIGNED_OUT" || !session) {
          if (event === "SIGNED_OUT") {
            setUser(null);
            await saveStoredUser(null);
          }
        } else if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          try {
            const live = await authService.currentUser();
            if (!cancelled && live) {
              setUser(live);
              await saveStoredUser(live);
            }
          } catch {}
        }
      });
      authListenerSubscription = subscription;
    }

    return () => {
      cancelled = true;
      if (authListenerSubscription) {
        authListenerSubscription.unsubscribe();
      }
    };
  }, []);

  const signIn = useCallback((next: UserProfile) => {
    setUser(next);
    void saveStoredUser(next);
  }, []);

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const current = await authService.currentUser();
      if (current) {
        setUser(current);
        void saveStoredUser(current);
      }
      return current;
    } catch {
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    const previous = user;
    setUser(null);
    void saveStoredUser(null);
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
    user: user && user.role === role ? (user as RoleProfile<R>) : null,
    hydrated,
  };
}
