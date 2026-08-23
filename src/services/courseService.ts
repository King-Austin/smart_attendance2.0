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

export const CourseService = {
  async getAllCoursesLive(): Promise<Course[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("code", { ascending: true });
    if (error) throw new Error(error.message);
    const fresh = (data as CourseRow[] | null)?.map(mapCourse) ?? [];
    cache = fresh;
    return fresh;
  },

  async getCoursesByLevel(department: string, level: string): Promise<Course[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data } = await supabase
      .from("courses")
      .select("*")
      .eq("department", department)
      .eq("level", level);
    return (data as CourseRow[] | null)?.map(mapCourse) ?? [];
  },

  async createCourse(course: Omit<Course, "id">): Promise<Course> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Database client not available");

    const row = {
      code: course.code.trim().toUpperCase(),
      title: course.title.trim(),
      credit_unit: course.creditUnit,
      department: course.department.trim(),
      level: course.level.trim(),
      semester: course.semester.trim(),
    };

    const { data, error } = await supabase
      .from("courses")
      .insert(row)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    resetCourses();
    return mapCourse(data as CourseRow);
  },

  async createCourses(courses: Omit<Course, "id">[]): Promise<Course[]> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Database client not available");

    const rows = courses.map((c) => ({
      code: c.code.trim().toUpperCase(),
      title: c.title.trim(),
      credit_unit: c.creditUnit,
      department: c.department.trim(),
      level: c.level.trim(),
      semester: c.semester.trim(),
    }));

    const { data, error } = await supabase
      .from("courses")
      .insert(rows)
      .select("*");

    if (error) throw new Error(error.message);
    resetCourses();
    return (data as CourseRow[]).map(mapCourse);
  },

  async deleteCourse(id: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Database client not available");

    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) throw new Error(error.message);
    resetCourses();
  },

  async deleteCoursesByDepartment(department: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Database client not available");

    const { error } = await supabase.from("courses").delete().eq("department", department);
    if (error) throw new Error(error.message);
    resetCourses();
  },

  async uploadCourses(
    courses: Omit<Course, "id">[],
  ): Promise<{ count: number; error: Error | null }> {
    try {
      const created = await CourseService.createCourses(courses);
      return { count: created.length, error: null };
    } catch (err) {
      return { count: 0, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },
};

/** Persist the list of course ids a user is enrolled in or assigned to teach. */
export async function updateUserCourses(userId: string, courseIds: string[]): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Live Supabase is required to update courses.");
  const { error } = await supabase
    .from("profiles")
    .update({ course_ids: courseIds })
    .eq("id", userId);
  if (error) throw new Error("Your courses could not be saved. Please try again.");
}
