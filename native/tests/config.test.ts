import assert from "node:assert/strict";
import { test } from "node:test";
import { config, requireHttps, apiUrl } from "../src/lib/config";

test("Supabase configuration is available and valid", () => {
  assert.ok(config.supabaseUrl, "Supabase URL must not be empty");
  assert.ok(config.supabaseUrl.startsWith("https://"), "Supabase URL must use HTTPS");
  assert.ok(!config.supabaseUrl.includes("your-"), "Supabase URL must not contain placeholders");
  assert.ok(config.supabaseKey, "Supabase key must not be empty");
  assert.ok(config.supabaseKey.length > 20, "Supabase key must be non-trivial");
});

test("Biometric base URL is configured with HTTPS", () => {
  assert.ok(config.biometricBase.startsWith("https://"), "Biometric base must use HTTPS");
  assert.equal(requireHttps(config.biometricBase, "Biometric"), config.biometricBase);
});

test("API URL builder produces clean HTTPS endpoints", () => {
  const url = apiUrl("/api/test");
  assert.ok(url.startsWith("https://"), "Built URL must be HTTPS");
  assert.ok(url.endsWith("/api/test"), "Built URL must append path");
});

