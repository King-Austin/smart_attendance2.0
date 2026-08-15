import { getSupabase } from "@/lib/supabase";
import type { Course } from "@/types";

interface CourseRow {
  id: string;
  code: string;
  title: string;
  credit_unit: number;
  department: string | null;
  level: string | null;
  semester: string | null;
  lecturer: string | null;
}

function mapCourse(row: CourseRow): Course {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    creditUnit: row.credit_unit,
    department: row.department ?? "",
    level: row.level ?? "",
    semester: row.semester ?? "First Semester",
    lecturer: row.lecturer ?? "",
  };
}

let cache: Course[] | null = null;
let loadPromise: Promise<Course[]> | null = null;

/**
 * Fetch the full course catalogue from Supabase. Results are cached in memory
 * for the lifetime of the tab because the catalogue is static reference data.
 */
export async function loadCourses(): Promise<Course[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Live Supabase is required to load the course catalogue.");
  if (cache) return cache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("code", { ascending: true });
    if (error) {
      loadPromise = null;
      throw new Error("The course catalogue could not be loaded. Please try again.");
    }
    cache = (data ?? []).map((r) => mapCourse(r as CourseRow));
    return cache;
  })();

  try {
    return await loadPromise;
  } catch {
    loadPromise = null;
    throw new Error("The course catalogue could not be loaded. Please try again.");
  }
}

export function getCourses(): Course[] {
  return cache ?? [];
}

export function courseById(id: string): Course | undefined {
  return cache?.find((c) => c.id === id);
}

export function resetCourses(): void {
  cache = null;
  loadPromise = null;
}

/** Persist the list of course ids a student is enrolled in. */
export async function updateStudentCourses(studentId: string, courseIds: string[]): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Live Supabase is required to update your courses.");
  const { error } = await supabase
    .from("profiles")
    .update({ course_ids: courseIds })
    .eq("id", studentId);
  if (error) throw new Error("Your courses could not be saved. Please try again.");
}
