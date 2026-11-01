import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const routes = [
  "index",
  "overview",
  "login",
  "register/student",
  "register/lecturer",
  "admin/auth",
  "admin/dashboard",
  "student/dashboard",
  "student/courses",
  "student/attendance/[sessionId]",
  "student/history",
  "student/profile",
  "lecturer/dashboard",
  "lecturer/courses",
  "lecturer/create-session",
  "lecturer/sessions",
  "lecturer/session/[sessionId]",
  "lecturer/ledger/[sessionId]",
  "lecturer/profile",
];
test("every existing user-facing page has a native route", async () => {
  for (const route of routes) {
    const content = await readFile(resolve(root, "app", route + ".tsx"), "utf8");
    assert.ok(content.length > 30, `${route} must map to a screen`);
  }
  assert.equal(routes.length, 19);
});
test("native location and liveness policies retain the reviewed web rules", async () => {
  for (const file of ["locationPolicy.ts", "livenessStateMachine.ts"]) {
    const [native, web] = await Promise.all([
      readFile(resolve(root, "src/services", file), "utf8"),
      readFile(resolve(root, "../src/services", file), "utf8"),
    ]);
    assert.equal(native, web, `${file} drifted from the reviewed policy`);
  }
});
test("no browser camera, WebView replacement or Capacitor imports in native screens", async () => {
  for (const name of await readdir(resolve(root, "src/screens"))) {
    const content = await readFile(resolve(root, "src/screens", name), "utf8");
    assert.doesNotMatch(
      content,
      /@capacitor|<WebView|document\.|navigator\.|localStorage|window\./,
    );
  }
});
test("native push data is scoped to the authenticated account", async () => {
  const sql = await readFile(resolve(root, "backend/migrations/0028_native_push.sql"), "utf8");
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /USING \(user_id=auth.uid\(\)\) WITH CHECK \(user_id=auth.uid\(\)\)/);
});
