import { getSupabase } from "@/lib/supabase";

export const academicService = {
  async getLevelsAndSemesters() {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Database client not available");
    const { data, error } = await supabase.from("courses").select("level,semester");
    if (error) throw new Error(error.message);
    return {
      levels: Array.from(new Set((data ?? []).map((row) => row.level).filter(Boolean))) as string[],
      semesters: Array.from(new Set((data ?? []).map((row) => row.semester).filter(Boolean))) as string[],
    };
  },
};
