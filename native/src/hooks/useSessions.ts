import { useEffect, useSyncExternalStore } from "react";
import { attendanceService, hydrateSessions, hydrateFeed } from "@/services/attendanceService";
import type { AttendanceSession, LiveCheckIn } from "@/services/attendanceService";
import { reportOperationalError } from "@/lib/operationalError";

/**
 * Hydrates the attendance session store from Supabase on mount and subscribes
 * to store changes so components re-render when sessions or feeds update.
 */
export function useSessions(): AttendanceSession[] {
  useEffect(() => {
    void hydrateSessions().catch((error) =>
      reportOperationalError("attendance", "hydrate sessions", error),
    );
    return attendanceService.watchSessions();
  }, []);

  return useSyncExternalStore(
    attendanceService.subscribe,
    attendanceService.getSessions,
    attendanceService.getSessions,
  );
}

/** Hydrates and subscribes to the live verification feed for one session. */
export function useSessionFeed(sessionId: string): LiveCheckIn[] {
  useEffect(() => {
    void hydrateFeed(sessionId).catch((error) =>
      reportOperationalError("attendance", "hydrate session feed", error, {
        context: { sessionId },
      }),
    );
    return attendanceService.watchFeed(sessionId);
  }, [sessionId]);

  return useSyncExternalStore(
    attendanceService.subscribe,
    () => attendanceService.getFeed(sessionId),
    () => attendanceService.getFeed(sessionId),
  );
}
