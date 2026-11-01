import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { AppState, ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { getSupabase } from "@/lib/supabase";
import { authService } from "@/services/authService";
import { attendanceService } from "@/services/attendanceService";
import { disablePush } from "@/services/pushService";
import { resetCourses } from "@/services/courseService";
import type { Role, UserProfile } from "@/types";
const Context = createContext<{
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<UserProfile | null>;
  signIn: (user: UserProfile) => void;
  signOut: () => Promise<void>;
}>({
  user: null,
  loading: true,
  error: null,
  refreshUser: async () => null,
  signIn: () => {},
  signOut: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const invalidate = useCallback(() => {
    ++generation.current;
  }, []);
  const refreshUser = useCallback(async () => {
    const run = ++generation.current;
    try {
      const current = await authService.currentUser();
      if (mounted.current && run === generation.current) {
        setUser(current);
        setError(null);
      }
      return current;
    } catch (err) {
      if (mounted.current && run === generation.current) {
        setUser(null);
        setError(err instanceof Error ? err.message : "Session could not be verified.");
      }
      return null;
    } finally {
      if (mounted.current && run === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refreshUser();
    const sb = getSupabase();
    const { data } = sb?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        ++generation.current;
        setUser(null);
        attendanceService.reset();
        resetCourses();
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
        setTimeout(() => void refreshUser(), 0);
    }) ?? { data: null };
    const state = AppState.addEventListener("change", (value) => {
      if (value === "active") {
        sb?.auth.startAutoRefresh();
        void refreshUser();
      } else sb?.auth.stopAutoRefresh();
    });
    return () => {
      mounted.current = false;
      invalidate();
      data?.subscription.unsubscribe();
      state.remove();
      sb?.auth.stopAutoRefresh();
    };
  }, [refreshUser, invalidate]);
  const signIn = (value: UserProfile) => {
    ++generation.current;
    attendanceService.reset();
    resetCourses();
    setUser(value);
    setLoading(false);
    setError(null);
  };
  const signOut = async () => {
    if (user) await disablePush(user.id);
    ++generation.current;
    await authService.signOut();
    attendanceService.reset();
    resetCourses();
    setUser(null);
  };
  return (
    <Context.Provider value={{ user, loading, error, refreshUser, signIn, signOut }}>
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#244dc2" />
      </View>
    );
  if (!user) return <Redirect href="/login" />;
  if (user.role !== role) return <Redirect href={`/${user.role}/dashboard`} />;
  return <>{children}</>;
}
