import { useResource } from "./useResource";
import { loadCourses } from "@/services/courseService";
import { useAuth } from "./useAuth";
export function useCourses() {
  const { user } = useAuth();
  const resource = useResource(loadCourses, `courses:${user?.id ?? "public"}`);
  return { courses: resource.data ?? [], ...resource };
}
