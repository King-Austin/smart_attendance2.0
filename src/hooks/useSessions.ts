import { useEffect, useState } from "react";
import { attendanceService, hydrateSessions, hydrateFeed } from "@/services/attendanceService";
import type { AttendanceSession, LiveCheckIn } from "@/services/attendanceService";

/**
 * Hydrates the attendance session store from Supabase on mount and subscribes
 * to store changes so components re-render when sessions or feeds update.
 */
export function useSessions(): AttendanceSession[] {
  const [, setTick] = useState(0);

  useEffect(() => {
    void hydrateSessions();
    const unsubscribe = attendanceService.subscribe(() => setTick((t) => t + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  return attendanceService.getSessions();
}

/** Hydrates and subscribes to the live verification feed for one session. */
export function useSessionFeed(sessionId: string): LiveCheckIn[] {
  const [, setTick] = useState(0);

  useEffect(() => {
    void hydrateFeed(sessionId);
    const unsubscribe = attendanceService.subscribe(() => setTick((t) => t + 1));
    return () => {
      unsubscribe();
    };
  }, [sessionId]);

  return attendanceService.getFeed(sessionId);
}
