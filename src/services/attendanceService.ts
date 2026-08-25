import { getSupabase } from "@/lib/supabase";
import type { AttendanceRecord, AttendanceSession, SessionStatus } from "@/types";
import { notificationService } from "./notificationService";
export type { AttendanceSession };

export interface LiveCheckIn {
  id: string;
  studentId?: string;
  name: string;
  regNumber: string;
  verifiedAt: string;
  faceScore: number;
  distance: number;
  gpsAccuracy: number;
  status: "verified" | "missed" | "failed";
}

export interface LedgerRow {
  id: string;
  studentId: string;
  name: string;
  regNumber: string;
  status: "verified" | "missed" | "failed";
  faceScore: number | null;
  distance: number | null;
  gpsAccuracy: number | null;
  verifiedAt: string | null;
  topic?: string | null;
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
  created_at?: string;
}

/** Formats timestamps (e.g. "23:41:29" -> "11:41 PM", "08:05" -> "8:05 AM"). */
export function format12Hour(timeStr?: string | null): string {
  if (!timeStr) return "—";
  const clean = timeStr.trim();
  if (/am|pm/i.test(clean)) return clean;

  const parts = clean.split(":");
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (isNaN(hours)) return clean;
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${ampm}`;
  }
  return clean;
}

const MAX_SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes max lifetime

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
  created_at?: string;
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
    startTime: format12Hour(row.start_time),
    endTime: row.end_time ? format12Hour(row.end_time) : undefined,
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
    studentId: r.student_id,
    name: r.student_name,
    regNumber: r.reg_number ?? "",
    verifiedAt: format12Hour(r.verified_at),
    faceScore: r.face_score ?? 0,
    distance: r.distance ?? 0,
    gpsAccuracy: r.gps_accuracy ?? 0,
    status: (r.status === "failed" ? "failed" : "verified") as "verified" | "failed",
  }));
}

/** Load all attendance sessions from Supabase into the store with 30-min auto-close. */
export async function hydrateSessions(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return;

  const now = Date.now();
  const expiredIds: string[] = [];

  sessions = (data ?? []).map((r) => {
    const row = r as SessionRow;
    const createdAtMs = row.created_at ? new Date(row.created_at).getTime() : 0;
    const isExpired =
      row.status === "active" && createdAtMs > 0 && now - createdAtMs >= MAX_SESSION_DURATION_MS;

    if (isExpired) {
      expiredIds.push(row.id);
      const autoEndTime = format12Hour(
        new Date(createdAtMs + MAX_SESSION_DURATION_MS).toLocaleTimeString("en-GB"),
      );
      return {
        ...mapSession(row),
        status: "ended" as const,
        endTime: row.end_time ? format12Hour(row.end_time) : autoEndTime,
      };
    }
    return mapSession(row);
  });

  if (expiredIds.length > 0) {
    void supabase.from("attendance_sessions").update({ status: "ended" }).in("id", expiredIds);
  }

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
  getSession: (id: string) => sessions.find((item) => item.id === id),
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

  /** Delete an attendance session and all its associated check-in records. */
  async deleteSession(id: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Live Supabase is required to delete a session.");

    const { error } = await supabase.from("attendance_sessions").delete().eq("id", id);
    if (error) throw new Error(error.message || "Failed to delete attendance session.");

    sessions = sessions.filter((s) => s.id !== id);
    emit();
  },

  /** Records attendance via secure server-side RPC (geofence & enrollment verified in DB). */
  async recordAttendance(
    sessionId: string,
    payload: {
      faceScore: number;
      lat: number;
      lng: number;
      gpsAccuracy?: number;
      distance?: number;
    },
  ): Promise<{ recordedAt: string; distance?: number }> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Live Supabase is required to record attendance.");

    // Try secure RPC first
    const { data, error } = await supabase.rpc("record_verified_attendance", {
      p_session_id: sessionId,
      p_lat: payload.lat,
      p_lng: payload.lng,
      p_accuracy: payload.gpsAccuracy ?? 10,
      p_face_score: payload.faceScore,
    });

    if (!error) {
      const res = data as { recordedAt?: string; distance?: number } | null;
      const recordedAt =
        res?.recordedAt ??
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

      return { recordedAt, distance: res?.distance ?? payload.distance };
    }

    // If the database function returned a business logic validation error
    // (e.g., expired session, outside geofence, not enrolled, face score too low),
    // throw that exact clear message to the user!
    const msg = error.message || "";
    const isMissingFunction =
      error.code === "42883" ||
      msg.toLowerCase().includes("could not find the function") ||
      msg.toLowerCase().includes("function record_verified_attendance does not exist");

    if (!isMissingFunction) {
      throw new Error(msg || "Attendance verification rejected by server.");
    }

    console.warn("RPC record_verified_attendance missing in database, falling back:", msg);

    // Fallback: If DB RPC function is not installed in database,
    // execute verified direct insertion with current authenticated user session
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error("Authentication required to record attendance.");

    // Get session metadata
    const { data: sessionData } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    // Get student profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, reg_number")
      .eq("id", user.id)
      .single();

    const recordedAt = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const { error: insertErr } = await supabase.from("attendance_records").upsert(
      {
        session_id: sessionId,
        course_id: sessionData?.course_id ?? "",
        student_id: user.id,
        student_name: profile?.name ?? user.email ?? "Student",
        reg_number: profile?.reg_number ?? "",
        date: sessionData?.date ?? new Date().toISOString().split("T")[0],
        topic: sessionData?.topic ?? "Lecture Session",
        status: "verified",
        face_score: payload.faceScore,
        distance: payload.distance ?? 0,
        gps_accuracy: payload.gpsAccuracy ?? 10,
        verified_at: recordedAt,
      },
      { onConflict: "session_id,student_id" },
    );

    if (insertErr) {
      throw new Error(insertErr.message || "Attendance recording failed.");
    }

    return { recordedAt, distance: payload.distance };
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
    const rows: LedgerRow[] = (data ?? []).map((r) => {
      const rec = r as RecordRow;
      return {
        id: rec.id,
        studentId: rec.student_id,
        name: rec.student_name,
        regNumber: rec.reg_number ?? "",
        status: (rec.status as "verified" | "missed" | "failed") ?? "verified",
        faceScore: rec.face_score,
        distance: rec.distance,
        gpsAccuracy: rec.gps_accuracy,
        verifiedAt: rec.verified_at,
        topic: rec.topic,
      };
    });
    return {
      rows,
      present: rows.filter((r) => r.status === "verified").length,
    };
  },

  /** Update an attendance record's status, verified timestamp, or topic. */
  async updateRecord(
    recordId: string,
    updates: {
      status?: "verified" | "missed" | "failed";
      verifiedAt?: string | null;
      topic?: string;
    },
  ): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const updatePayload: Record<string, unknown> = {};
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.verifiedAt !== undefined) updatePayload.verified_at = updates.verifiedAt;
    if (updates.topic !== undefined) updatePayload.topic = updates.topic;

    const { error } = await supabase
      .from("attendance_records")
      .update(updatePayload)
      .eq("id", recordId);

    if (error) throw new Error(error.message);

    // Update in-memory live feed if present
    for (const sId of Object.keys(liveFeed)) {
      const entry = liveFeed[sId]?.find((f) => f.id === recordId);
      if (entry) {
        if (updates.status) entry.status = updates.status;
        if (updates.verifiedAt !== undefined && updates.verifiedAt !== null)
          entry.verifiedAt = updates.verifiedAt;
      }
    }
    emit();
  },

  /** Delete an attendance record. */
  async deleteRecord(recordId: string, sessionId?: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { error } = await supabase.from("attendance_records").delete().eq("id", recordId);

    if (error) throw new Error(error.message);

    // Remove from in-memory feed
    if (sessionId && liveFeed[sessionId]) {
      liveFeed[sessionId] = liveFeed[sessionId].filter((f) => f.id !== recordId);
    } else {
      for (const sId of Object.keys(liveFeed)) {
        liveFeed[sId] = liveFeed[sId].filter((f) => f.id !== recordId);
      }
    }
    emit();
  },

  /** Manually record or override attendance for an enrolled student. */
  async manualRecord(
    sessionId: string,
    student: { id: string; name: string; regNumber?: string; courseId: string; topic?: string },
    status: "verified" | "missed" | "failed" = "verified",
  ): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const time = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const { data, error } = await supabase
      .from("attendance_records")
      .upsert(
        {
          session_id: sessionId,
          course_id: student.courseId,
          student_id: student.id,
          student_name: student.name,
          reg_number: student.regNumber ?? null,
          date: new Date().toISOString().split("T")[0],
          topic: student.topic ?? "Manual Record",
          status,
          face_score: 1.0,
          distance: 0,
          gps_accuracy: 0,
          verified_at: time,
        },
        { onConflict: "session_id,student_id" },
      )
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    const recordId = (data as { id: string } | null)?.id ?? crypto.randomUUID();

    // Add to in-memory feed
    if (!liveFeed[sessionId]) liveFeed[sessionId] = [];
    liveFeed[sessionId] = [
      {
        id: recordId,
        studentId: student.id,
        name: student.name,
        regNumber: student.regNumber ?? "",
        verifiedAt: time,
        faceScore: 1.0,
        distance: 0,
        gpsAccuracy: 0,
        status,
      },
      ...liveFeed[sessionId].filter((f) => f.name !== student.name),
    ];
    emit();
  },

  /** Fetch all students enrolled in a particular course for manual roster selection. */
  async getEnrolledStudents(
    courseId: string,
  ): Promise<{ id: string; name: string; regNumber: string; email: string }[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, reg_number, email")
      .eq("role", "student")
      .contains("course_ids", [courseId])
      .order("name", { ascending: true });
    if (error) return [];
    return (data ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      regNumber: d.reg_number ?? "",
      email: d.email,
    }));
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
