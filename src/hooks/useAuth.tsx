import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { pushService } from "@/services/mobile/pushService";
import type { LecturerProfile, Role, StudentProfile, UserProfile } from "@/types";

const STORAGE_KEY = "scp.session";

interface AuthContextValue {
  user: UserProfile | null;
  hydrated: boolean;
  signIn: (user: UserProfile, remember: boolean) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw =
        window.localStorage.getItem(STORAGE_KEY) ?? window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as UserProfile);
    } catch {
      /* ignore malformed session */
    }
    setHydrated(true);
  }, []);

  const signIn = useCallback((next: UserProfile, remember: boolean) => {
    setUser(next);
    const store = remember ? window.localStorage : window.sessionStorage;
    store.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const signOut = useCallback(() => {
    const previous = user;
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    if (previous?.id) {
      // Best-effort: drop the Web Push subscription and Realtime channel.
      void pushService.teardown(previous.id);
    }
  }, [user]);

  const value = useMemo(
    () => ({ user, hydrated, signIn, signOut }),
    [user, hydrated, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

type RoleProfile<R extends Role> = R extends "student" ? StudentProfile : LecturerProfile;

export function useRoleGuard<R extends Role>(role: R) {
  const { user, hydrated } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
    } else if (user.role !== role) {
      navigate({
        to: user.role === "student" ? "/student/dashboard" : "/lecturer/dashboard",
        replace: true,
      });
    }
  }, [user, hydrated, role, navigate]);
  return {
    user: (user && user.role === role ? (user as RoleProfile<R>) : null),
    hydrated,
  };
}
