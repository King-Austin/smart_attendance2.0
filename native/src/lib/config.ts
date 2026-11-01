export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiBase: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  biometricBase: process.env.EXPO_PUBLIC_BIOMETRIC_API_URL ?? "",
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "",
};
export function requireHttps(value: string, label: string): string {
  if (!value || value.includes("your-") || !/^https:\/\//.test(value))
    throw new Error(`${label} must be configured with a real HTTPS URL.`);
  return value.replace(/\/+$/, "");
}
export function apiUrl(path: string) {
  return `${requireHttps(config.apiBase, "API server")}${path}`;
}
