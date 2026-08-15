import { useEffect, useState } from "react";
import { loadCourses, getCourses } from "@/services/courseService";
import type { Course } from "@/types";

/**
 * Loads the course catalogue from Supabase on mount and re-renders when it
 * arrives. Courses are cached for the tab's lifetime after the first load.
 */
export function useCourses(): { courses: Course[]; loading: boolean; error: string | null } {
  const [courses, setCourses] = useState<Course[]>(() => getCourses());
  const [loading, setLoading] = useState(() => getCourses().length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (getCourses().length > 0) {
      setLoading(false);
      return;
    }
    loadCourses()
      .then((list) => {
        if (!cancelled) {
          setCourses(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Courses could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { courses, loading, error };
}
