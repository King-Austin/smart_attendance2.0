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
  enterPreview(role: Role): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapProfile(row: Record<string, unknown>): AppProfile {
  return {
    id: String(row.id ?? ''),
    role: (row.role as Role) ?? 'student',
    name: String(row.name ?? 'UNIZIK User'),
    email: String(row.email ?? ''),
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

const previewProfiles: Record<Role, AppProfile> = {
  student: { id: 'preview-student', role: 'student', name: 'King Austin', email: 'student@unizik.edu.ng', faculty: 'Engineering', department: 'Electrical and Electronic Engineering', level: '500 Level', semester: 'First Semester', regNumber: '2021/123456', faceEnrolled: true, courseIds: ['eee501', 'eee509', 'eee510'] },
  lecturer: { id: 'preview-lecturer', role: 'lecturer', name: 'Dr. Adaeze Nwosu', email: 'lecturer@unizik.edu.ng', faculty: 'Engineering', department: 'Electrical and Electronic Engineering', staffId: 'NAU/ENG/0142', approvalStatus: 'approved', courseIds: ['eee509', 'eee510'] },
  admin: { id: 'preview-admin', role: 'admin', name: 'Faculty Administrator', email: 'admin@unizik.edu.ng', faculty: 'Engineering', department: 'Faculty Office', approvalStatus: 'approved', courseIds: [] },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(Boolean(supabase));
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) throw new Error('Your UNIZIK profile could not be loaded.');
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
      if (supabase) await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
    },
    enterPreview(role) {
      if (__DEV__) setProfile(previewProfiles[role]);
    },
  }), [loading, loadProfile, profile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
