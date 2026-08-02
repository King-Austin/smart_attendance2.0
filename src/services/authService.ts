import { DEMO_LECTURER, DEMO_STUDENT } from "@/data/mockData";
import { getSupabase } from "@/lib/supabase";
import type { LecturerProfile, Role, StudentProfile, UserProfile } from "@/types";
import { delay } from "./demoScenarios";

export interface Credentials {
  email: string;
  password: string;
  role: Role;
}

interface ProfileRow {
  id: string;
  role: Role;
  name: string;
  email: string;
  faculty: string | null;
  department: string | null;
  reg_number: string | null;
  level: string | null;
  semester: string | null;
  academic_session: string | null;
  phone: string | null;
  staff_id: string | null;
  course_ids: string[] | null;
  face_enrolled: boolean | null;
  face_vector: number[] | null;
}

/** pgvector columns round-trip as string literals like "[0.1,0.2,...]"; parse them to arrays. */
function parseFaceVector(value: unknown): number[] | null {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as number[];
    } catch {
      return null;
    }
  }
  return null;
}

/** Encode a JS array as a pgvector literal (e.g. "[0.1,0.2,...]"); null for empty. */
function encodeFaceVector(value: number[] | null | undefined): string | null {
  if (!value || value.length === 0) return null;
  return `[${value.join(",")}]`;
}

function mapProfile(row: ProfileRow): UserProfile {
  const base = {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    faculty: row.faculty ?? "",
    department: row.department ?? "",
    courseIds: row.course_ids ?? [],
  };
  if (row.role === "student") {
    return {
      ...base,
      role: "student" as const,
      regNumber: row.reg_number ?? "",
      level: row.level ?? "",
      semester: row.semester ?? "",
      academicSession: row.academic_session ?? "",
      phone: row.phone ?? undefined,
      faceEnrolled: row.face_enrolled ?? false,
      faceVector: parseFaceVector(row.face_vector) ?? undefined,
    } as StudentProfile;
  }
  return {
    ...base,
    role: "lecturer" as const,
    staffId: row.staff_id ?? "",
  } as LecturerProfile;
}

/**
 * Authentication backed by Supabase Auth when configured; otherwise the
 * simulated implementation. Identity (role, reg number, staff id) is always
 * served from the profile table — never chosen on the client.
 */
export const authService = {
  async signIn({ email, password, role }: Credentials): Promise<UserProfile> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.toLowerCase().includes("network")) {
          throw new Error("Network error. Could not reach the authentication server.");
        }
        throw new Error("Invalid credentials. Please check your email and password.");
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      if (profileError || !profile) {
        throw new Error("Your account profile could not be loaded.");
      }
      return mapProfile(profile as ProfileRow);
    }

    await delay(900);
    if (!email.includes("@")) {
      throw new Error("Enter a valid email address.");
    }
    if (password.length < 6) {
      throw new Error("Invalid credentials. Please check your email and password.");
    }
    if (email.toLowerCase().startsWith("offline")) {
      throw new Error("Network error. Could not reach the authentication server.");
    }
    return role === "student" ? { ...DEMO_STUDENT, email } : { ...DEMO_LECTURER, email };
  },

  async registerStudent(data: Partial<StudentProfile>, password: string): Promise<StudentProfile> {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.auth.signUp({
        email: data.email ?? "",
        password,
        options: {
          data: {
            full_name: data.name,
            role: "student",
            reg_number: data.regNumber,
            faculty: data.faculty,
            department: data.department,
            level: data.level,
            semester: data.semester,
            academic_session: data.academicSession,
            phone: data.phone,
            course_ids: data.courseIds,
            face_vector: encodeFaceVector(data.faceVector),
          },
        },
      });
      if (error) throw new Error(error.message);

      // Profile is created by the trigger; client waits for it to appear, then fills details.
      const profile = await waitForProfile(supabase);
      const uid = (profile as ProfileRow).id;
      await supabase
        .from("profiles")
        .update({
          name: data.name ?? (profile as ProfileRow).name,
          role: "student",
          reg_number: data.regNumber ?? (profile as ProfileRow).reg_number,
          faculty: data.faculty ?? (profile as ProfileRow).faculty,
          department: data.department ?? (profile as ProfileRow).department,
          level: data.level ?? (profile as ProfileRow).level,
          semester: data.semester ?? (profile as ProfileRow).semester,
          academic_session: data.academicSession ?? (profile as ProfileRow).academic_session,
          phone: data.phone ?? (profile as ProfileRow).phone,
          course_ids: data.courseIds ?? (profile as ProfileRow).course_ids ?? [],
          face_vector: encodeFaceVector(
            data.faceVector ?? parseFaceVector((profile as ProfileRow).face_vector),
          ),
          face_enrolled: true,
        })
        .eq("id", uid);
      return mapProfile(profile as ProfileRow) as StudentProfile;
    }

    await delay(1100);
    return { ...DEMO_STUDENT, ...data, role: "student" } as StudentProfile;
  },

  async registerLecturer(
    data: Partial<LecturerProfile>,
    password: string,
  ): Promise<LecturerProfile> {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.auth.signUp({
        email: data.email ?? "",
        password,
        options: { data: { full_name: data.name, role: "lecturer", staff_id: data.staffId } },
      });
      if (error) throw new Error(error.message);
      // Profile is created by the trigger; client waits for it to appear.
      const profile = await waitForProfile(supabase);
      return mapProfile(profile as ProfileRow) as LecturerProfile;
    }

    await delay(1100);
    return { ...DEMO_LECTURER, ...data, role: "lecturer" } as LecturerProfile;
  },
};

async function waitForProfile(
  supabase: ReturnType<typeof getSupabase> extends null
    ? never
    : NonNullable<ReturnType<typeof getSupabase>>,
) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Registration failed. Please try again.");

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (!error && data) return data;
    await delay(400);
  }
  throw new Error("Registration succeeded but your profile could not be created.");
}
