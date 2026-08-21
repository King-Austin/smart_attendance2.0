import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { AppProfile, Role } from '@/types/auth';

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  profile: AppProfile | null;
  configured: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapProfile(row: Record<string, unknown>): AppProfile {
  return {
    id: String(row.id ?? ''),
    role: (row.role as Role) ?? 'student',
    name: String(row.name ?? 'Smart Campus User'),
    email: String(row.email ?? ''),
    facultyId: row.faculty_id ? String(row.faculty_id) : undefined,
    departmentId: row.department_id ? String(row.department_id) : undefined,
    faculty: String(row.faculty ?? ''),
    department: String(row.department ?? ''),
    level: row.level ? String(row.level) : undefined,
    semester: row.semester ? String(row.semester) : undefined,
    regNumber: row.reg_number ? String(row.reg_number) : undefined,
    staffId: row.staff_id ? String(row.staff_id) : undefined,
    approvalStatus: row.approval_status as AppProfile['approvalStatus'],
    faceEnrolled: Boolean(row.face_enrolled),
    courseIds: Array.isArray(row.course_ids) ? (row.course_ids as string[]) : [],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(Boolean(supabase));
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.from('profiles').select('id, role, name, email, faculty_id, department_id, faculty, department, level, semester, reg_number, staff_id, approval_status, face_enrolled, course_ids').eq('id', userId).single();
    if (error) throw new Error('Your Smart Campus profile could not be loaded.');
    setProfile(mapProfile(data as Record<string, unknown>));
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user.id) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user.id) void loadProfile(nextSession.user.id);
      else setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    session,
    profile,
    configured: isSupabaseConfigured,
    async signIn(email, password) {
      if (!supabase) throw new Error('Live Supabase credentials are not configured yet.');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      setSession(data.session);
      await loadProfile(data.user.id);
    },
    async signOut() {
      if (supabase && session?.user.id) await supabase.from('device_push_tokens').delete().eq('user_id', session.user.id);
      if (supabase) await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
    },
    async refreshProfile() {
      if (!session?.user.id) throw new Error('No active session.');
      await loadProfile(session.user.id);
    },
  }), [loading, loadProfile, profile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
