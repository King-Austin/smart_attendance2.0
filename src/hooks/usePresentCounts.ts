import { useEffect, useState } from "react";
import { attendanceService } from "@/services/attendanceService";

/** Fetches verified present counts for a set of sessions, keyed by session id. */
export function usePresentCounts(sessionIds: string[]): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = sessionIds.join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, number> = {};
      for (const id of sessionIds) {
        const active = attendanceService.getFeed(id).filter((f) => f.status === "verified").length;
        next[id] = active > 0 ? active : await attendanceService.getPresentCount(id);
      }
      if (!cancelled) setCounts(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return counts;
}
