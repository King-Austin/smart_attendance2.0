import { getSupabase } from "@/lib/supabase";
import type { LecturerProfile, StudentProfile } from "@/types";

interface ProfileRow {
  id: string;
  role: "student" | "lecturer" | "admin";
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
  approval_status: "pending" | "approved" | "rejected" | null;
  face_enrolled: boolean | null;
}

function mapLecturer(row: ProfileRow): LecturerProfile {
  return {
    id: row.id,
    role: "lecturer",
    name: row.name,
    staffId: row.staff_id ?? "",
    email: row.email,
    faculty: row.faculty ?? "",
    department: row.department ?? "",
    courseIds: row.course_ids ?? [],
    approvalStatus: row.approval_status ?? "approved",
  };
}

function mapStudent(row: ProfileRow): StudentProfile {
  return {
    id: row.id,
    role: "student",
    name: row.name,
    regNumber: row.reg_number ?? "",
    email: row.email,
    faculty: row.faculty ?? "",
    department: row.department ?? "",
    level: row.level ?? "",
    semester: row.semester ?? "",
    academicSession: row.academic_session ?? "",
    phone: row.phone ?? undefined,
    guardianName: row.guardian_name ?? undefined,
    guardianPhone: row.guardian_phone ?? undefined,
    guardianEmail: row.guardian_email ?? undefined,
    courseIds: row.course_ids ?? [],
    faceEnrolled: row.face_enrolled ?? false,
  };
}

export const adminService = {
  /**
   * Fetches all lecturers in the system.
   */
  async getLecturers(): Promise<LecturerProfile[]> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "lecturer")
      .order("created_at", { ascending: false });

    if (error) throw new Error("Could not fetch lecturers.");

    return ((data || []) as ProfileRow[]).map(mapLecturer);
  },

  /**
   * Fetches all students so admins can oversee enrollment, face status, and guardian reporting coverage.
   */
  async getStudents(): Promise<StudentProfile[]> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "student")
      .order("created_at", { ascending: false });

    if (error) throw new Error("Could not fetch students.");

    return ((data || []) as ProfileRow[]).map(mapStudent);
  },

  /**
   * Updates the approval status of a lecturer.
   */
  async updateLecturerApproval(
    lecturerId: string,
    status: "approved" | "rejected" | "pending",
  ): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { error } = await supabase
      .from("profiles")
      .update({ approval_status: status })
      .eq("id", lecturerId);

    if (error) throw new Error("Could not update approval status.");
  },
};
