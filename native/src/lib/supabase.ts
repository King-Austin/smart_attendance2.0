import "react-native-url-polyfill/auto";
import { createClient, processLock, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";
import { secureStorage } from "./secureStorage";
let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseKey || config.supabaseUrl.includes("your-"))
    return null;
  client ??= createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      storage: secureStorage,
      storageKey: "scp.native.session",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  });
  return client;
}
