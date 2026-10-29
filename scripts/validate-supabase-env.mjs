import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const environmentPath = resolve(process.cwd(), ".env");
if (!existsSync(environmentPath)) {
  console.error("Supabase environment check failed: ignored .env file not found.");
  process.exit(1);
}

const values = {};
for (const rawLine of readFileSync(environmentPath, "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const separator = line.indexOf("=");
  if (separator <= 0) continue;
  values[line.slice(0, separator).trim()] = line
    .slice(separator + 1)
    .trim()
    .replace(/^(['"])(.*)\1$/, "$2");
}

const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
];
const missing = required.filter(
  (key) => !values[key] || /^(your-|replace|change-me)/i.test(values[key]),
);
if (missing.length > 0) {
  console.error(`Supabase environment check failed. Missing: ${missing.join(", ")}`);
  process.exit(1);
}

const publicUrl = new URL(values.VITE_SUPABASE_URL);
const serverUrl = new URL(values.SUPABASE_URL);
if (publicUrl.origin !== serverUrl.origin || !publicUrl.hostname.endsWith(".supabase.co")) {
  console.error(
    "Supabase environment check failed: browser and server URLs must use the same Supabase project.",
  );
  process.exit(1);
}
if (!values.SUPABASE_ACCESS_TOKEN.startsWith("sbp_")) {
  console.error("Supabase environment check failed: SUPABASE_ACCESS_TOKEN has an invalid format.");
  process.exit(1);
}
if (values.VITE_SUPABASE_ANON_KEY.length < 20 || values.SUPABASE_SERVICE_ROLE_KEY.length < 20) {
  console.error("Supabase environment check failed: an API key is invalid or incomplete.");
  process.exit(1);
}

console.log(
  "Supabase environment check passed: browser, server, and CLI credentials are configured.",
);
