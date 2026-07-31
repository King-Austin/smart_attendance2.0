import { ACTIVE_SESSION, PAST_SESSIONS, generateRoster } from "@/data/mockData";
import type { AttendanceSession } from "@/types";
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
    await delay(1200);
    const id = `SES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
    const session: AttendanceSession = {
      id,
      courseId: input.courseId,
      topic: input.topic,
      lecturerName: input.lecturerName,
      startTime: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      radius: input.radius,
      status: "active",
      anchor: input.anchor,
      note: input.note,
      enrolledCount: 62,
      date: new Date().toISOString().slice(0, 10),
    };
    store.sessions = store.sessions.map((s) =>
      s.status === "active" ? { ...s, status: "ended" as const } : s,
    );
    store.sessions = [session, ...store.sessions];
    seedFeed(session);
    emit();
    return session;
  },

  async endSession(id: string) {
    await delay(700);
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

  /** Records attendance only after the (simulated) server verifies face + geofence. */
  async recordAttendance(sessionId: string, payload: { faceScore: number; distance: number }) {
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
