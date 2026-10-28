import { getSupabase } from "@/lib/supabase";
import type { Course } from "@/types";

interface CourseRow {
  id: string;
  code: string;
  title: string;
  credit_unit: number;
  faculty: string | null;
  faculty_id: string | null;
  department_id: string | null;
  department: string | null;
  level: string | null;
  semester: string | null;
  alternate_codes?: string[] | null;
  level_requires_verification?: boolean | null;
}

function mapCourse(row: CourseRow): Course {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    creditUnit: row.credit_unit,
    faculty: row.faculty ?? "",
    facultyId: row.faculty_id ?? undefined,
    departmentId: row.department_id ?? undefined,
    department: row.department ?? "",
    level: row.level ?? "",
    semester: row.semester ?? "First Semester",
    alternateCodes: row.alternate_codes ?? [],
    levelRequiresVerification: row.level_requires_verification ?? false,
  };
}

function newCourseId(code: string): string {
  // The schema requires a text primary key and does not provide a database
  // default. Keep generated IDs independent from course codes so a renamed
  // or repeated code cannot overwrite an existing row.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeCourse(course: Omit<Course, "id">) {
  const code = course.code.trim().toUpperCase();
  const title = course.title.trim();
  const department = course.department.trim();
  const faculty = course.faculty?.trim() ?? "";
  const level = course.level.trim();
  const semester = course.semester.trim();
  const creditUnit = Number(course.creditUnit);

  if (!code || !title || !faculty || !department || !level || !semester) {
    throw new Error("Course code, title, faculty, department, level, and semester are required.");
  }
  if (!Number.isInteger(creditUnit) || creditUnit < 1 || creditUnit > 6) {
    throw new Error("Credit units must be a whole number from 1 to 6.");
  }

  return {
    id: newCourseId(code),
    code,
    title,
    credit_unit: creditUnit,
    faculty,
    department,
    level,
    semester,
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
  async getFaculties(): Promise<{ id: string; name: string }[]> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Database client not available");
    const { data, error } = await supabase.from("faculties").select("id,name").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; name: string }[];
  },
  async createFaculty(name: string): Promise<{ id: string; name: string }> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Database client not available");
    const clean = name.trim();
    if (!clean) throw new Error("Faculty name is required.");
    const { data, error } = await supabase.from("faculties").insert({ name: clean }).select("id,name").single();
    if (error) throw new Error(error.message);
    return data as { id: string; name: string };
  },
  async getDepartmentsByFaculty(facultyId: string): Promise<{ id: string; name: string; facultyId: string }[]> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Database client not available");
    const { data, error } = await supabase.from("departments").select("id,name,faculty_id").eq("faculty_id", facultyId).order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({ id: row.id, name: row.name, facultyId: row.faculty_id }));
  },
  async getAllDepartments(): Promise<{ id: string; name: string; facultyId: string }[]> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Database client not available");
    const { data, error } = await supabase.from("departments").select("id,name,faculty_id").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({ id: row.id, name: row.name, facultyId: row.faculty_id }));
  },
  async createDepartment(facultyId: string, name: string): Promise<{ id: string; name: string; facultyId: string }> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Database client not available");
    const clean = name.trim();
    if (!facultyId || !clean) throw new Error("Select a faculty and enter a department name.");
    const { data, error } = await supabase.from("departments").insert({ faculty_id: facultyId, name: clean }).select("id,name,faculty_id").single();
    if (error) throw new Error(error.message);
    return { id: data.id, name: data.name, facultyId: data.faculty_id };
  },
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

    const row = normalizeCourse(course);

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

    if (courses.length === 0) throw new Error("At least one course is required.");
    const rows = courses.map(normalizeCourse);
    const codes = new Set<string>();
    for (const row of rows) {
      if (codes.has(row.code)) throw new Error(`Duplicate course code: ${row.code}`);
      codes.add(row.code);
    }

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
