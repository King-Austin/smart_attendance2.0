import { getSupabase } from "@/lib/supabase";
import type { UserProfile, LecturerProfile } from "@/types";

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

    return (data || []).map((row) => ({
      id: row.id,
      role: "lecturer",
      name: row.name,
      staffId: row.staff_id ?? "",
      email: row.email,
      faculty: row.faculty ?? "",
      department: row.department ?? "",
      courseIds: row.course_ids ?? [],
      approvalStatus: row.approval_status ?? "approved",
    }));
  },

  /**
   * Updates the approval status of a lecturer.
   */
  async updateLecturerApproval(lecturerId: string, status: "approved" | "rejected" | "pending"): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { error } = await supabase
      .from("profiles")
      .update({ approval_status: status })
      .eq("id", lecturerId);

    if (error) throw new Error("Could not update approval status.");
  }
};
