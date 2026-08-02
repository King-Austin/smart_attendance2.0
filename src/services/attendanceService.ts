import { ACTIVE_SESSION, PAST_SESSIONS, generateRoster } from "@/data/mockData";
import { getSupabase } from "@/lib/supabase";
import type { AttendanceSession, SessionStatus } from "@/types";
import { delay } from "./demoScenarios";

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

interface Store {
  sessions: AttendanceSession[];
  liveFeed: Record<string, LiveCheckIn[]>;
}

const store: Store = {
  sessions: [ACTIVE_SESSION, ...PAST_SESSIONS],
  liveFeed: {},
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function seedFeed(session: AttendanceSession) {
  if (store.liveFeed[session.id]) return;
  const roster = generateRoster(session.enrolledCount);
  store.liveFeed[session.id] = roster.slice(0, 18).map((s, i) => ({
    id: `${session.id}-seed-${i}`,
    name: s.name,
    regNumber: s.regNumber,
    verifiedAt: `09:${(3 + i).toString().padStart(2, "0")}`,
    faceScore: Number((0.86 + ((i * 11) % 12) / 100).toFixed(2)),
    distance: 6 + ((i * 13) % 60),
    gpsAccuracy: 4 + ((i * 3) % 10),
    status: i === 5 ? "failed" : "verified",
  }));
}

seedFeed(ACTIVE_SESSION);

interface SessionRow {
  id: string;
  course_id: string;
  topic: string;
  lecturer_name: string;
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

function mapSession(row: SessionRow): AttendanceSession {
  return {
    id: row.id,
    courseId: row.course_id,
    topic: row.topic,
    lecturerName: row.lecturer_name,
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

/** Load sessions from Supabase into the local store (live mode only). */
export async function hydrateSessions(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return;
  if (data) {
    store.sessions = data.map((r) => mapSession(r as SessionRow));
    emit();
  }
}

/** Load the live feed (attendance records) for a session from Supabase. */
export async function hydrateFeed(sessionId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase
    .from("attendance_records")
    .select("student_name, reg_number, verified_at, face_score, distance, gps_accuracy, status")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error || !data) return;
  store.liveFeed[sessionId] = data.map((r, i) => ({
    id: `${sessionId}-db-${i}`,
    name: r.student_name,
    regNumber: r.reg_number ?? "",
    verifiedAt: r.verified_at ?? "",
    faceScore: r.face_score ?? 0,
    distance: r.distance ?? 0,
    gpsAccuracy: r.gps_accuracy ?? 0,
    status: (r.status === "failed" ? "failed" : "verified") as "verified" | "failed",
  }));
  emit();
}

export const attendanceService = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSessions: () => store.sessions,
  getSession: (id: string) => store.sessions.find((s) => s.id === id),
  getActiveSession: () => store.sessions.find((s) => s.status === "active"),
  getFeed: (id: string) => store.liveFeed[id] ?? [],

  async createSession(input: {
    courseId: string;
    topic: string;
    radius: number;
    note?: string;
    anchor: { lat: number; lng: number; accuracy: number };
    lecturerName: string;
  }): Promise<AttendanceSession> {
    const supabase = getSupabase();
    const id = `SES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
    const now = new Date();
    const session: AttendanceSession = {
      id,
      courseId: input.courseId,
      topic: input.topic,
      lecturerName: input.lecturerName,
      startTime: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      radius: input.radius,
      status: "active",
      anchor: input.anchor,
      note: input.note,
      enrolledCount: 62,
      date: now.toISOString().slice(0, 10),
    };

    if (supabase) {
      const { error } = await supabase.from("attendance_sessions").insert({
        id,
        course_id: input.courseId,
        topic: input.topic,
        lecturer_name: input.lecturerName,
        lecturer_id: await currentUserId(),
        start_time: session.startTime,
        radius: input.radius,
        status: "active",
        anchor_lat: input.anchor.lat,
        anchor_lng: input.anchor.lng,
        anchor_accuracy: input.anchor.accuracy,
        note: input.note ?? null,
        enrolled_count: 62,
        date: session.date,
      });
      if (error) throw new Error("Could not create the session. Try again.");
    }

    await delay(supabase ? 0 : 1200);
    store.sessions = store.sessions.map((s) =>
      s.status === "active" ? { ...s, status: "ended" as const } : s,
    );
    store.sessions = [session, ...store.sessions];
    if (!supabase) seedFeed(session);
    emit();
    return session;
  },

  async endSession(id: string) {
    const supabase = getSupabase();
    if (supabase) {
      const endTime = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const { error } = await supabase
        .from("attendance_sessions")
        .update({ status: "ended", end_time: endTime })
        .eq("id", id);
      if (error) return;
    }
    await delay(supabase ? 0 : 700);
    store.sessions = store.sessions.map((s) =>
      s.id === id
        ? {
            ...s,
            status: "ended" as const,
            endTime: new Date().toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          }
        : s,
    );
    emit();
  },

  pushCheckIn(sessionId: string) {
    const session = store.sessions.find((s) => s.id === sessionId);
    if (!session || session.status !== "active") return;
    const existing = store.liveFeed[sessionId] ?? [];
    if (existing.length >= session.enrolledCount) return;
    const roster = generateRoster(session.enrolledCount);
    const next = roster[existing.length];
    const i = existing.length;
    store.liveFeed[sessionId] = [
      {
        id: `${sessionId}-live-${i}`,
        name: next.name,
        regNumber: next.regNumber,
        verifiedAt: new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        faceScore: Number((0.85 + ((i * 7) % 14) / 100).toFixed(2)),
        distance: 5 + ((i * 19) % 62),
        gpsAccuracy: 4 + ((i * 5) % 11),
        status: i % 11 === 0 ? "failed" : "verified",
      },
      ...existing,
    ];
    emit();
  },

  /** Records attendance after the server verifies face + geofence. */
  async recordAttendance(sessionId: string, payload: { faceScore: number; distance: number }) {
    const supabase = getSupabase();
    if (supabase) {
      const session = store.sessions.find((s) => s.id === sessionId);
      if (!session || session.status !== "active") {
        throw new Error("This session is no longer accepting check-ins.");
      }
      const uid = await currentUserId();
      const recordedAt = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      let studentName = "";
      let regNumber = "";
      if (uid) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, reg_number")
          .eq("id", uid)
          .single();
        studentName = profile?.name ?? "";
        regNumber = profile?.reg_number ?? "";
      }
      const { error } = await supabase.from("attendance_records").insert({
        session_id: sessionId,
        course_id: session.courseId,
        student_id: uid,
        student_name: studentName,
        reg_number: regNumber,
        date: session.date,
        topic: session.topic,
        status: "verified",
        face_score: payload.faceScore,
        distance: payload.distance,
        verified_at: recordedAt,
      });
      if (error) throw new Error("Attendance could not be recorded. Try again.");
      return { recordedAt, ...payload };
    }

    await delay(900);
    const session = store.sessions.find((s) => s.id === sessionId);
    if (!session || session.status !== "active") {
      throw new Error("This session is no longer accepting check-ins.");
    }
    return {
      recordedAt: new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      ...payload,
    };
  },
};
