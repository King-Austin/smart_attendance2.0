const LIVE_SUPABASE_URL = "https://jtezcxkjjrrzqakrfukf.supabase.co";
const LIVE_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZXpjeGtqanJyenFha3JmdWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMDUzNjYsImV4cCI6MjA3NTc4MTM2Nn0.uJs56vN9vSV2hlAcf196bb5d9TqYl1VeYAZRAa9HZAI";
const LIVE_BIOMETRIC_API_URL = "https://insightface.pharmaloop.org";

export const config = {
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    LIVE_SUPABASE_URL,
  supabaseKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    LIVE_SUPABASE_ANON_KEY,
  apiBase:
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    LIVE_BIOMETRIC_API_URL,
  biometricBase:
    process.env.EXPO_PUBLIC_BIOMETRIC_API_URL ||
    LIVE_BIOMETRIC_API_URL,
  easProjectId:
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    "",
};

export function requireHttps(value: string, label: string): string {
  if (!value || value.includes("your-") || !/^https:\/\//.test(value))
    throw new Error(`${label} must be configured with a real HTTPS URL.`);
  return value.replace(/\/+$/, "");
}

export function apiUrl(path: string) {
  return `${requireHttps(config.apiBase, "API server")}${path}`;
}
