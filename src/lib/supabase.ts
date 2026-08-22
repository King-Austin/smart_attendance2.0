import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";

/**
 * Supabase client wrapper.
 *
 * The app runs live against Supabase when `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_ANON_KEY` point at a real project.
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
      // Persist the session in native Preferences on mobile (Capacitor), which
      // survives WebView storage clears and origin changes. Falls back safely to localStorage.
      storage: {
        getItem: async (key: string): Promise<string | null> => {
          try {
            const { value } = await Preferences.get({ key });
            if (value !== null && value !== undefined) return value;
          } catch {}
          if (typeof window !== "undefined") {
            try {
              return localStorage.getItem(key);
            } catch {}
          }
          return null;
        },
        setItem: async (key: string, value: string): Promise<void> => {
          try {
            await Preferences.set({ key, value });
          } catch {}
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(key, value);
            } catch {}
          }
        },
        removeItem: async (key: string): Promise<void> => {
          try {
            await Preferences.remove({ key });
          } catch {}
          if (typeof window !== "undefined") {
            try {
              localStorage.removeItem(key);
            } catch {}
          }
        },
      },
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
