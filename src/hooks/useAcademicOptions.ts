import { useEffect, useMemo, useState } from "react";
import { academicService } from "@/services/academicService";
import { CourseService } from "@/services/courseService";

export function useAcademicOptions(facultyName?: string) {
  const [faculties, setFaculties] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; facultyId: string }[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [semesters, setSemesters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      CourseService.getFaculties(),
      CourseService.getAllDepartments(),
      academicService.getLevelsAndSemesters(),
    ]).then(([facultyRows, departmentRows, options]) => {
      if (cancelled) return;
      setFaculties(facultyRows);
      setDepartments(departmentRows);
      setLevels(options.levels.filter((level) => level !== "500 Level"));
      setSemesters(options.semesters);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Academic options could not be loaded.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const selectedFaculty = faculties.find((faculty) => faculty.name === facultyName);
  const filteredDepartments = useMemo(
    () => selectedFaculty ? departments.filter((department) => department.facultyId === selectedFaculty.id) : [],
    [departments, selectedFaculty?.id],
  );

  return { faculties, departments: filteredDepartments, allDepartments: departments, levels, semesters, loading, error };
}
