import { getSupabase } from "@/lib/supabase";
import type { AdminProfile, LecturerProfile, Role, StudentProfile, UserProfile } from "@/types";

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
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  staff_id: string | null;
  course_ids: string[] | null;
  approval_status: "pending" | "approved" | "rejected";
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
      guardianName: row.guardian_name ?? undefined,
      guardianPhone: row.guardian_phone ?? undefined,
      guardianEmail: row.guardian_email ?? undefined,
      faceEnrolled: row.face_enrolled ?? false,
      faceVector: parseFaceVector(row.face_vector) ?? undefined,
    } as StudentProfile;
  }
  if (row.role === "admin") {
    return {
      ...base,
      role: "admin" as const,
    } as AdminProfile;
  }
  return {
    ...base,
    role: "lecturer" as const,
    staffId: row.staff_id ?? "",
    approvalStatus: row.approval_status ?? "approved",
  } as LecturerProfile;
}

function requireClient(): NonNullable<ReturnType<typeof getSupabase>> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase is not configured. Set the project URL and anon key first.");
  }
  return supabase;
}

async function fetchProfile(supabase: NonNullable<ReturnType<typeof getSupabase>>, userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error || !data) throw new Error("Your account profile could not be loaded.");
  const row = data as ProfileRow;

  // Role is flexible: trust the JWT claim when present, else the DB column.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const jwtRole = user?.app_metadata?.role as Role | undefined;
  const role: Role = jwtRole === "student" || jwtRole === "lecturer" || jwtRole === "admin" ? jwtRole : row.role;

  return mapProfile({ ...row, role });
}

async function fetchCurrentProfile(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
): Promise<UserProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Your session has expired. Sign in again.");
  return fetchProfile(supabase, user.id);
}

/**
 * Authentication backed by Supabase Auth. Identity (role, reg number, staff id)
 * is always served from the profile table — never chosen on the client.
 */
export const authService = {
  async signIn({ email, password }: Credentials): Promise<UserProfile> {
    const supabase = requireClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes("network")) {
        throw new Error("Network error. Could not reach the authentication server.");
      }
      throw new Error("Invalid credentials. Please check your email and password.");
    }
    return fetchCurrentProfile(supabase);
  },

  async registerStudent(data: Partial<StudentProfile>, password: string): Promise<StudentProfile> {
    const supabase = requireClient();
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email ?? "",
      password,
      options: {
        data: {
          full_name: data.name,
          role: "student",
        },
      },
    });
    if (error) throw new Error(error.message);

    const profile = await waitForProfile(supabase);
    const uid = (profile as ProfileRow).id;
    const updateData = {
      name: data.name ?? (profile as ProfileRow).name,
      reg_number: data.regNumber ?? (profile as ProfileRow).reg_number,
      faculty: data.faculty ?? (profile as ProfileRow).faculty,
      department: data.department ?? (profile as ProfileRow).department,
      level: data.level ?? (profile as ProfileRow).level,
      semester: data.semester ?? (profile as ProfileRow).semester,
      academic_session: data.academicSession ?? (profile as ProfileRow).academic_session,
      phone: data.phone ?? (profile as ProfileRow).phone,
      guardian_name: data.guardianName ?? (profile as ProfileRow).guardian_name,
      guardian_phone: data.guardianPhone ?? (profile as ProfileRow).guardian_phone,
      guardian_email: data.guardianEmail ?? (profile as ProfileRow).guardian_email,
      course_ids: data.courseIds ?? (profile as ProfileRow).course_ids ?? [],
      face_vector: encodeFaceVector(
        data.faceVector ?? parseFaceVector((profile as ProfileRow).face_vector),
      ),
      face_enrolled: true,
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", uid);
    if (updateError) {
      throw new Error(
        `Your profile could not be saved (${updateError.message}). Registration was not completed — please try again.`,
      );
    }
    const updatedVector = data.faceVector ?? parseFaceVector((profile as ProfileRow).face_vector);
    return mapProfile({
      ...(profile as ProfileRow),
      ...updateData,
      face_vector: updatedVector,
    }) as StudentProfile;
  },

  async registerLecturer(
    data: Partial<LecturerProfile>,
    password: string,
  ): Promise<LecturerProfile> {
    const supabase = requireClient();
    const { error } = await supabase.auth.signUp({
      email: data.email ?? "",
      password,
      options: { data: { full_name: data.name, role: "lecturer", staff_id: data.staffId } },
    });
    if (error) throw new Error(error.message);
    // Profile is created by the trigger; client waits for it to appear, then
    // fills in the lecturer-specific fields (role comes from the trigger).
    const profile = await waitForProfile(supabase);
    const uid = (profile as ProfileRow).id;
    await supabase
      .from("profiles")
      .update({
        name: data.name ?? (profile as ProfileRow).name,
        staff_id: data.staffId ?? (profile as ProfileRow).staff_id,
        faculty: data.faculty ?? (profile as ProfileRow).faculty,
        department: data.department ?? (profile as ProfileRow).department,
      })
      .eq("id", uid);
    return mapProfile(await waitForProfile(supabase)) as LecturerProfile;
  },

  /** Update a student's editable profile fields and return the refreshed profile. */
  async updateStudentProfile(
    userId: string,
    data: Partial<
      Pick<
        StudentProfile,
        "name" | "phone" | "faculty" | "department" | "level" | "semester" | "academicSession"
      >
    >,
  ): Promise<StudentProfile> {
    const supabase = requireClient();
    const updateData: Partial<ProfileRow> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.faculty !== undefined) updateData.faculty = data.faculty;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.level !== undefined) updateData.level = data.level;
    if (data.semester !== undefined) updateData.semester = data.semester;
    if (data.academicSession !== undefined) updateData.academic_session = data.academicSession;
    const { error } = await supabase.from("profiles").update(updateData).eq("id", userId);
    if (error) throw new Error("Your profile could not be saved. Please try again.");
    return fetchProfile(supabase, userId) as Promise<StudentProfile>;
  },

  /** Save (or update) the student's enrolled face vector. */
  async enrollFace(userId: string, vector: number[] | undefined): Promise<StudentProfile> {
    const supabase = requireClient();
    const { error } = await supabase
      .from("profiles")
      .update({ face_vector: encodeFaceVector(vector), face_enrolled: true })
      .eq("id", userId);
    if (error) throw new Error("Your face could not be saved. Please try again.");
    return fetchProfile(supabase, userId) as Promise<StudentProfile>;
  },

  async currentUser(): Promise<UserProfile | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return fetchProfile(supabase, user.id);
  },

  async signOut(): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
  },
};

async function waitForProfile(supabase: NonNullable<ReturnType<typeof getSupabase>>) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Registration failed. Please try again.");

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (!error && data) return data;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("Registration succeeded but your profile could not be created.");
}
