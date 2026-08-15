import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { authService } from "@/services/authService";
import { pushService } from "@/services/mobile/pushService";
import type { LecturerProfile, Role, StudentProfile, UserProfile, AdminProfile } from "@/types";

interface AuthContextValue {
  user: UserProfile | null;
  hydrated: boolean;
  signIn: (user: UserProfile) => void;
  signOut: () => void;
  /** Re-fetch the current user's profile from Supabase and update context. */
  refreshUser: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await authService.currentUser();
        if (!cancelled) setUser(current);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((next: UserProfile) => {
    setUser(next);
  }, []);

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const current = await authService.currentUser();
      if (current) setUser(current);
      return current;
    } catch {
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    const previous = user;
    setUser(null);
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
      let route = "/";
      if (user.role === "student") route = "/student/dashboard";
      else if (user.role === "lecturer") route = "/lecturer/dashboard";
      else if (user.role === "admin") route = "/admin/dashboard";
      
      navigate({ to: route, replace: true });
    }
  }, [user, hydrated, role, navigate]);
  return {
    user: user && user.role === role ? (user as RoleProfile<R>) : null,
    hydrated,
  };
}
