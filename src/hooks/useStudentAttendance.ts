import { useEffect, useState } from "react";
import { attendanceService } from "@/services/attendanceService";
import type { AttendanceRecord, CourseAttendanceSummary } from "@/types";

/**
 * Loads a student's live attendance records and per-course summaries from
 * Supabase on mount. Recomputes when the active session ends so dashboards
 * reflect final counts.
 */
export function useStudentAttendance(
  studentId: string,
  courseIds: string[],
  activeSessionId: string | null,
): { records: AttendanceRecord[]; summaries: CourseAttendanceSummary[]; loading: boolean } {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summaries, setSummaries] = useState<CourseAttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const courseKey = courseIds.join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [recs, sums] = await Promise.all([
        attendanceService.getStudentRecords(studentId),
        attendanceService.getCourseSummaries(studentId, courseIds),
      ]);
      if (!cancelled) {
        setRecords(recs);
        setSummaries(sums);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, courseKey, activeSessionId]);

  return { records, summaries, loading };
}
