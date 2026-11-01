import { useCallback, useEffect, useRef, useState } from "react";
export function useResource<T>(loader: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(loader);
  loadRef.current = loader;
  const run = useRef(0);
  const alive = useRef(true);
  const reload = useCallback(async () => {
    const id = ++run.current;
    setLoading(true);
    setError(null);
    try {
      const value = await loadRef.current();
      if (alive.current && id === run.current) setData(value);
    } catch (err) {
      if (alive.current && id === run.current)
        setError(err instanceof Error ? err.message : "Could not load data.");
    } finally {
      if (alive.current && id === run.current) setLoading(false);
    }
  }, []);
  const invalidate = useCallback(() => {
    ++run.current;
  }, []);
  useEffect(() => {
    alive.current = true;
    setData(null);
    void reload();
    return () => {
      alive.current = false;
      invalidate();
    };
  }, [key, reload, invalidate]);
  return { data, loading, error, reload };
}
