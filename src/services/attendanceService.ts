import { getSupabase } from "@/lib/supabase";
import { reportOperationalError } from "@/lib/operationalError";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { AttendanceRecord, AttendanceSession, SessionStatus } from "@/types";
import { emailService } from "./emailService";
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
const MIN_GEOFENCE_RADIUS_METERS = 100;

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

interface CourseStudentRosterRow {
  student_id: string;
  student_name: string;
  reg_number: string | null;
  email: string;
  guardian_name: string | null;
  guardian_email: string | null;
}

let sessions: AttendanceSession[] = [];
const liveFeed: Record<string, LiveCheckIn[]> = {};
const EMPTY_FEED: LiveCheckIn[] = [];

let stateEpoch = 0;
let sessionsHydrationId = 0;
const feedHydrationIds = new Map<string, number>();
let sessionsChannel: RealtimeChannel | null = null;
let sessionChannelSubscribers = 0;
const feedChannels = new Map<string, { channel: RealtimeChannel; subscribers: number }>();

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
    status: r.status,
  }));
}

/** Load all attendance sessions from Supabase into the store with 30-min auto-close. */
export async function hydrateSessions(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const epoch = stateEpoch;
  const hydrationId = ++sessionsHydrationId;
  const { error: expiryRpcError } = await supabase.rpc("expire_attendance_sessions");
  if (expiryRpcError) {
    reportOperationalError("attendance", "expire stale sessions", expiryRpcError, {
      severity: "warning",
    });
  }
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load attendance sessions: ${error.message}`);
  if (epoch !== stateEpoch || hydrationId !== sessionsHydrationId) return;

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

  emit();
}

/** Load the verification feed (attendance records) for a session. */
export async function hydrateFeed(sessionId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const epoch = stateEpoch;
  const hydrationId = (feedHydrationIds.get(sessionId) ?? 0) + 1;
  feedHydrationIds.set(sessionId, hydrationId);
  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load the live attendance feed: ${error.message}`);
  if (!data || epoch !== stateEpoch || feedHydrationIds.get(sessionId) !== hydrationId) return;
  liveFeed[sessionId] = toFeed(data as RecordRow[]);
  emit();
}

function reportRealtimeStatus(area: string, status: string, error?: Error) {
  if (status !== "CHANNEL_ERROR" && status !== "TIMED_OUT") return;
  reportOperationalError(area, `realtime ${status.toLowerCase()}`, error ?? new Error(status));
}

function watchSessions(): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  sessionChannelSubscribers += 1;

  if (!sessionsChannel) {
    sessionsChannel = supabase
      .channel("attendance:sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_sessions" },
        () => {
          void hydrateSessions().catch((error) =>
            reportOperationalError("attendance", "refresh sessions after realtime event", error),
          );
        },
      )
      .subscribe((status, error) => reportRealtimeStatus("attendance sessions", status, error));
  }

  return () => {
    sessionChannelSubscribers = Math.max(0, sessionChannelSubscribers - 1);
    if (sessionChannelSubscribers === 0 && sessionsChannel) {
      const channel = sessionsChannel;
      sessionsChannel = null;
      void supabase.removeChannel(channel).catch((error) =>
        reportOperationalError("attendance", "remove sessions realtime channel", error, {
          severity: "warning",
        }),
      );
    }
  };
}

function watchFeed(sessionId: string): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const existing = feedChannels.get(sessionId);
  if (existing) {
    existing.subscribers += 1;
  } else {
    const channel = supabase
      .channel(`attendance:feed:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_records",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          void hydrateFeed(sessionId).catch((error) =>
            reportOperationalError("attendance", "refresh feed after realtime event", error, {
              context: { sessionId },
            }),
          );
        },
      )
      .subscribe((status, error) => reportRealtimeStatus("attendance feed", status, error));
    feedChannels.set(sessionId, { channel, subscribers: 1 });
  }

  return () => {
    const entry = feedChannels.get(sessionId);
    if (!entry) return;
    entry.subscribers -= 1;
    if (entry.subscribers <= 0) {
      feedChannels.delete(sessionId);
      void supabase.removeChannel(entry.channel).catch((error) =>
        reportOperationalError("attendance", "remove feed realtime channel", error, {
          severity: "warning",
          context: { sessionId },
        }),
      );
    }
  };
}

export const attendanceService = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  watchSessions,
  watchFeed,
  getSessions: () => sessions,
  getSession: (id: string) => sessions.find((item) => item.id === id),
  getActiveSession: () => sessions.find((s) => s.status === "active"),
  getFeed: (id: string) => liveFeed[id] ?? EMPTY_FEED,

  /** Remove all user-scoped snapshots during sign-out or account changes. */
  reset() {
    stateEpoch += 1;
    sessionsHydrationId += 1;
    sessions = [];
    for (const sessionId of Object.keys(liveFeed)) {
      delete liveFeed[sessionId];
    }
    feedHydrationIds.clear();
    emit();
  },

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
    if (input.radius < MIN_GEOFENCE_RADIUS_METERS) {
      throw new Error(`Session radius must be at least ${MIN_GEOFENCE_RADIUS_METERS} metres.`);
    }

    // Session creation is intentionally server-authoritative. The RPC verifies
    // lecturer approval/course assignment and atomically replaces only an active
    // session for this course; unrelated courses remain live.
    const { data, error } = await supabase.rpc("create_attendance_session", {
      p_course_id: input.courseId,
      p_topic: input.topic,
      p_radius: input.radius,
      p_anchor_lat: input.anchor.lat,
      p_anchor_lng: input.anchor.lng,
      p_anchor_accuracy: input.anchor.accuracy,
      p_note: input.note ?? null,
      p_enrolled_count: input.enrolledCount,
    });

    if (error) {
      const missingRpc =
        error.code === "42883" ||
        error.message.toLowerCase().includes("could not find the function") ||
        error.message.toLowerCase().includes("does not exist");
      throw new Error(
        missingRpc
          ? "Secure session creation is unavailable. Apply the latest database migrations before retrying."
          : error.message || "Could not create the session. Try again.",
      );
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("The server returned an invalid attendance session.");
    }

    const session = mapSession(data as unknown as SessionRow);
    sessions = sessions
      .map((existing) =>
        existing.courseId === session.courseId &&
        existing.status === "active" &&
        existing.id !== session.id
          ? { ...existing, status: "ended" as const, endTime: session.startTime }
          : existing,
      )
      .filter((existing) => existing.id !== session.id);
    sessionsHydrationId += 1;
    sessions = [session, ...sessions];
    emit();
    return session;
  },

  async endSession(id: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Live Supabase is required to end a session.");
    const { data, error } = await supabase.rpc("end_attendance_session", {
      p_session_id: id,
    });
    if (error)
      throw new Error(error.message || "The session could not be ended. Please try again.");
    const endTime =
      data && typeof data === "object" && "endTime" in data && typeof data.endTime === "string"
        ? data.endTime
        : new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    sessions = sessions.map((s) => (s.id === id ? { ...s, status: "ended" as const, endTime } : s));
    sessionsHydrationId += 1;
    emit();

    // Trigger consecutive absence check asynchronously
    const session = sessions.find((s) => s.id === id);
    if (session) {
      checkConsecutiveAbsences(session.courseId).catch((err) =>
        reportOperationalError("attendance", "check consecutive absences", err, {
          severity: "warning",
          context: { courseId: session.courseId },
        }),
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
    sessionsHydrationId += 1;
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
      const res = data as {
        success?: boolean;
        error?: string;
        recordedAt?: string;
        distance?: number;
      } | null;
      if (res?.success === false) {
        throw new Error(res.error || "Attendance verification rejected by server.");
      }
      const recordedAt =
        res?.recordedAt ??
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

      void hydrateFeed(sessionId).catch((refreshError) =>
        reportOperationalError("attendance", "refresh feed after check-in", refreshError, {
          severity: "warning",
          context: { sessionId },
        }),
      );
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

    throw new Error(
      "Secure attendance recording is unavailable. Apply the latest database migrations before retrying.",
    );
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
        liveFeed[sId] = liveFeed[sId].map((item) =>
          item.id === recordId
            ? {
                ...item,
                status: updates.status ?? item.status,
                verifiedAt: updates.verifiedAt ?? item.verifiedAt,
              }
            : item,
        );
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
      ...liveFeed[sessionId].filter((f) => f.studentId !== student.id),
    ];
    emit();
  },

  /** Fetch all students enrolled in a particular course for manual roster selection. */
  async getEnrolledStudents(
    courseId: string,
  ): Promise<{ id: string; name: string; regNumber: string; email: string }[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("get_course_student_roster", {
      p_course_id: courseId,
    });
    if (error) {
      reportOperationalError("attendance", "load course student roster", error, {
        severity: "warning",
        context: { courseId },
      });
      return [];
    }
    return (
      (data as CourseStudentRosterRow[] | null)?.map((d) => ({
        id: d.student_id,
        name: d.student_name,
        regNumber: d.reg_number ?? "",
        email: d.email,
      })) ?? []
    );
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
  const { data, error } = await supabase.rpc("get_course_student_roster", {
    p_course_id: courseId,
  });
  if (error) return 0;
  return data?.length ?? 0;
}

/** Check for N consecutive absences and notify guardian if necessary. */
async function checkConsecutiveAbsences(courseId: string) {
  const result = await emailService.sendGuardianEmail("consecutive_absence", courseId);
  if (!result.success && (result.failedCount ?? 0) > 0) {
    reportOperationalError("guardian email", "send consecutive absence notices", new Error(result.error ?? "Guardian notice delivery failed"), { severity: "warning", context: { courseId, failedCount: result.failedCount ?? 0 } });
  }
}
