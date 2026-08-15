import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client wrapper.
 *
 * The app runs live against Supabase when `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_ANON_KEY` point at a real project. When the env vars are
 * missing or still placeholders, the client returns null and services fail
 * closed with a clear error — there is no in-memory demo fallback.
 *
 * Never use the service-role key here; it is server-only.
 */

const PLACEHOLDER_MARKERS = ["your-supabase-project-id", "your-supabase-anon-key"];

export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL ?? "";
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) return false;
  return !PLACEHOLDER_MARKERS.some((m) => url.includes(m) || anon.includes(m));
}

function createBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!isSupabaseConfigured()) return null;
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  return createClient(url, anon, {
    auth: {
      persistSession: true,
      storageKey: "scp.supabase.session",
      detectSessionInUrl: true,
      autoRefreshToken: true,
    },
  });
}

let browserClient: SupabaseClient | null | undefined;

/** Returns the shared browser Supabase client, or null when not configured. */
export function getSupabase(): SupabaseClient | null {
  if (browserClient === undefined) {
    browserClient = createBrowserClient();
  }
  return browserClient;
}
