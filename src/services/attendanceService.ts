import { getSupabase } from "@/lib/supabase";
import type { AttendanceRecord, AttendanceSession, SessionStatus } from "@/types";
import { notificationService } from "./notificationService";
export type { AttendanceSession };

export interface LiveCheckIn {
  id: string;
  name: string;
  regNumber: string;
  verifiedAt: string;
  faceScore: number;
  distance: number;
  gpsAccuracy: number;
  status: "verified" | "failed";
}

export interface LedgerRow {
  id: string;
  name: string;
  regNumber: string;
  status: "verified" | "failed";
  faceScore: number | null;
  distance: number | null;
  gpsAccuracy: number | null;
  verifiedAt: string | null;
}

interface SessionRow {
  id: string;
  course_id: string;
  topic: string;
  lecturer_name: string;
  lecturer_id: string;
  start_time: string;
  end_time: string | null;
  radius: number;
  status: SessionStatus;
  anchor_lat: number;
  anchor_lng: number;
  anchor_accuracy: number;
  note: string | null;
  enrolled_count: number;
  date: string;
}

interface RecordRow {
  id: string;
  session_id: string;
  course_id: string;
  student_id: string;
  student_name: string;
  reg_number: string | null;
  date: string;
  topic: string | null;
  status: "verified" | "missed" | "failed";
  face_score: number | null;
  distance: number | null;
  gps_accuracy: number | null;
  verified_at: string | null;
}

let sessions: AttendanceSession[] = [];
const liveFeed: Record<string, LiveCheckIn[]> = {};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function mapSession(row: SessionRow): AttendanceSession {
  return {
    id: row.id,
    courseId: row.course_id,
    topic: row.topic,
    lecturerName: row.lecturer_name,
    lecturerId: row.lecturer_id,
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    radius: row.radius,
    status: row.status,
    anchor: { lat: row.anchor_lat, lng: row.anchor_lng, accuracy: row.anchor_accuracy },
    note: row.note ?? undefined,
    enrolledCount: row.enrolled_count,
    date: row.date,
  };
}

async function currentUserId(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function toFeed(rows: RecordRow[]): LiveCheckIn[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.student_name,
    regNumber: r.reg_number ?? "",
    verifiedAt: r.verified_at ?? "",
    faceScore: r.face_score ?? 0,
    distance: r.distance ?? 0,
    gpsAccuracy: r.gps_accuracy ?? 0,
    status: (r.status === "failed" ? "failed" : "verified") as "verified" | "failed",
  }));
}

/** Load all attendance sessions from Supabase into the store. */
export async function hydrateSessions(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return;
  sessions = (data ?? []).map((r) => mapSession(r as SessionRow));
  emit();
}

/** Load the verification feed (attendance records) for a session. */
export async function hydrateFeed(sessionId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error || !data) return;
  liveFeed[sessionId] = toFeed(data as RecordRow[]);
  emit();
}

export const attendanceService = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSessions: () => sessions,
  getSession: (id: string) => sessions.find((s) => s.id === id),
  getActiveSession: () => sessions.find((s) => s.status === "active"),
  getFeed: (id: string) => liveFeed[id] ?? [],

  async createSession(input: {
    courseId: string;
    topic: string;
    radius: number;
    note?: string;
    anchor: { lat: number; lng: number; accuracy: number };
    lecturerName: string;
    lecturerId: string;
    enrolledCount: number;
  }): Promise<AttendanceSession> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Live Supabase is required to create a session.");
    const id = `SES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
    const now = new Date();
    const startTime = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const date = now.toISOString().slice(0, 10);

    const { error } = await supabase.from("attendance_sessions").insert({
      id,
      course_id: input.courseId,
      topic: input.topic,
      lecturer_name: input.lecturerName,
      lecturer_id: input.lecturerId,
      start_time: startTime,
      radius: input.radius,
      status: "active",
      anchor_lat: input.anchor.lat,
      anchor_lng: input.anchor.lng,
      anchor_accuracy: input.anchor.accuracy,
      note: input.note ?? null,
      enrolled_count: input.enrolledCount,
      date,
    });
    if (error) throw new Error("Could not create the session. Try again.");

    const session: AttendanceSession = {
      id,
      courseId: input.courseId,
      topic: input.topic,
      lecturerName: input.lecturerName,
      lecturerId: input.lecturerId,
      startTime,
      radius: input.radius,
      status: "active",
      anchor: input.anchor,
      note: input.note,
      enrolledCount: input.enrolledCount,
      date,
    };
    // Opening a new session ends any other active session.
    const { data: activeRows, error: activeError } = await supabase
      .from("attendance_sessions")
      .update({ status: "ended", end_time: startTime })
      .eq("status", "active")
      .neq("id", id)
      .select();
    if (!activeError && activeRows) {
      sessions = sessions.map((s) =>
        s.status === "active" && s.id !== id ? { ...s, status: "ended" as const } : s,
      );
    }
    sessions = [session, ...sessions];
    emit();
    return session;
  },

  async endSession(id: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Live Supabase is required to end a session.");
    const endTime = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const { error } = await supabase
      .from("attendance_sessions")
      .update({ status: "ended", end_time: endTime })
      .eq("id", id);
    if (error) throw new Error("The session could not be ended. Please try again.");
    sessions = sessions.map((s) => (s.id === id ? { ...s, status: "ended" as const, endTime } : s));
    emit();

    // Trigger consecutive absence check asynchronously
    const session = sessions.find((s) => s.id === id);
    if (session) {
      checkConsecutiveAbsences(session.courseId).catch((err) =>
        console.error("Failed to check consecutive absences", err),
      );
    }
  },

  /** Records attendance after the server verifies face + geofence. */
  async recordAttendance(
    sessionId: string,
    payload: { faceScore: number; distance: number; gpsAccuracy?: number },
  ): Promise<{ recordedAt: string }> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Live Supabase is required to record attendance.");
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.status !== "active") {
      throw new Error("This session is no longer accepting check-ins.");
    }
    const uid = await currentUserId();
    if (!uid) throw new Error("Your session has expired. Sign in again.");
    const recordedAt = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, reg_number, course_ids")
      .eq("id", uid)
      .single();
    const courseIds = Array.isArray(profile?.course_ids) ? profile.course_ids : [];
    if (!courseIds.includes(session.courseId)) {
      throw new Error("You are not enrolled in this course.");
    }
    const { error } = await supabase.from("attendance_records").insert({
      session_id: sessionId,
      course_id: session.courseId,
      student_id: uid,
      student_name: profile?.name ?? "",
      reg_number: profile?.reg_number ?? null,
      date: session.date,
      topic: session.topic,
      status: "verified",
      face_score: payload.faceScore,
      distance: payload.distance,
      gps_accuracy: payload.gpsAccuracy ?? null,
      verified_at: recordedAt,
    });
    if (error) throw new Error("Attendance could not be recorded. Try again.");
    return { recordedAt };
  },

  /** Real verification ledger for a session — only records that exist. */
  async getLedger(sessionId: string): Promise<{ rows: LedgerRow[]; present: number }> {
    const supabase = getSupabase();
    if (!supabase) return { rows: [], present: 0 };
    const { data, error } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });
    if (error) return { rows: [], present: 0 };
    const rows = (data ?? []).map((r) => {
      const rec = r as RecordRow;
      return {
        id: rec.id,
        name: rec.student_name,
        regNumber: rec.reg_number ?? "",
        status: rec.status === "failed" ? ("failed" as const) : ("verified" as const),
        faceScore: rec.face_score,
        distance: rec.distance,
        gpsAccuracy: rec.gps_accuracy,
        verifiedAt: rec.verified_at,
      };
    });
    return {
      rows,
      present: rows.filter((r) => r.status === "verified").length,
    };
  },

  /** Number of verified check-ins for a session. */
  async getPresentCount(sessionId: string): Promise<number> {
    const supabase = getSupabase();
    if (!supabase) return 0;
    const { count, error } = await supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("status", "verified");
    if (error) return 0;
    return count ?? 0;
  },

  /** A student's full attendance history, newest first. */
  async getStudentRecords(studentId: string): Promise<AttendanceRecord[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []).map((r) => {
      const rec = r as RecordRow;
      return {
        id: rec.id,
        sessionId: rec.session_id,
        courseId: rec.course_id,
        studentName: rec.student_name,
        regNumber: rec.reg_number ?? "",
        date: rec.date,
        topic: rec.topic ?? "",
        status: rec.status,
        faceScore: rec.face_score,
        distance: rec.distance,
        gpsAccuracy: rec.gps_accuracy,
        verifiedAt: rec.verified_at,
      };
    });
  },

  /** Sessions held per course plus the student's verified count for each. */
  async getCourseSummaries(
    studentId: string,
    courseIds: string[],
  ): Promise<{ courseId: string; held: number; attended: number }[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    if (courseIds.length === 0) return [];

    const { data: sessionRows, error: sessionError } = await supabase
      .from("attendance_sessions")
      .select("course_id, status")
      .in("course_id", courseIds)
      .neq("status", "scheduled");
    const { data: recordRows, error: recordError } = await supabase
      .from("attendance_records")
      .select("course_id, status")
      .eq("student_id", studentId)
      .eq("status", "verified");

    const heldByCourse: Record<string, number> = {};
    const attendedByCourse: Record<string, number> = {};
    if (!sessionError) {
      for (const s of (sessionRows ?? []) as { course_id: string }[]) {
        heldByCourse[s.course_id] = (heldByCourse[s.course_id] ?? 0) + 1;
      }
    }
    if (!recordError) {
      for (const r of (recordRows ?? []) as { course_id: string }[]) {
        attendedByCourse[r.course_id] = (attendedByCourse[r.course_id] ?? 0) + 1;
      }
    }
    return courseIds.map((courseId) => ({
      courseId,
      held: heldByCourse[courseId] ?? 0,
      attended: attendedByCourse[courseId] ?? 0,
    }));
  },
};

/** Estimate enrolled count for a course from student profiles. */
export async function countEnrolled(courseId: string): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "student")
    .contains("course_ids", [courseId]);
  if (error) return 0;
  return count ?? 0;
}

const ABSENCE_SESSION_WINDOW = Number(import.meta.env.VITE_ABSENCE_SESSION_WINDOW ?? 5);

/** Check for N consecutive absences and notify guardian if necessary. */
async function checkConsecutiveAbsences(courseId: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  // 1. Get the last N ended sessions for this course
  const { data: lastSessions, error: sessionsError } = await supabase
    .from("attendance_sessions")
    .select("id")
    .eq("course_id", courseId)
    .eq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(ABSENCE_SESSION_WINDOW);

  if (sessionsError || !lastSessions || lastSessions.length < ABSENCE_SESSION_WINDOW) return;
  const sessionIds = lastSessions.map((s) => s.id);

  // 2. Find all students enrolled in this course with their guardian details
  const { data: students, error: studentsError } = await supabase
    .from("profiles")
    .select("id, name, guardian_name, guardian_email")
    .eq("role", "student")
    .contains("course_ids", [courseId]);

  if (studentsError || !students) return;

  // 3. For each student, check if they have any verified record in the last 5 sessions
  for (const student of students) {
    if (!student.guardian_email) continue;

    const { count, error: recordsError } = await supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("student_id", student.id)
      .eq("status", "verified")
      .in("session_id", sessionIds);

    if (!recordsError && count === 0) {
      // Missing all 5 sessions! Trigger notification
      await notificationService.sendConsecutiveAbsenceNotification(
        student.guardian_email,
        student.guardian_name || "Guardian",
        student.name,
        courseId,
      );
    }
  }
}
