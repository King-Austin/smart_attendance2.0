import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("attendance writes fail closed through secure RPCs", async () => {
  const source = await read("src/services/attendanceService.ts");
  const createSession = section(source, "async createSession(", "async endSession(");
  const recordAttendance = section(
    source,
    "async recordAttendance(",
    "/** Real verification ledger",
  );

  assert.match(createSession, /\.rpc\("create_attendance_session"/);
  assert.doesNotMatch(createSession, /\.from\("attendance_sessions"\)\s*\.insert/);
  assert.match(recordAttendance, /\.rpc\("record_verified_attendance"/);
  assert.doesNotMatch(recordAttendance, /\.from\("attendance_records"\)/);
  assert.match(recordAttendance, /Secure attendance recording is unavailable/);
});

test("attendance migration scopes sessions and rejects weak verification inputs", async () => {
  const sql = await read("supabase/migrations/0014_harden_attendance_verification.sql");

  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS[\s\S]*WHERE status = 'active'/);
  assert.match(sql, /WHERE course_id = p_course_id\s+AND status = 'active'/);
  assert.match(sql, /DROP POLICY IF EXISTS "Lecturers can update their own sessions"/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.end_attendance_session/);
  assert.match(sql, /p_anchor_accuracy[\s\S]*> 25/);
  assert.match(sql, /p_face_score[\s\S]*< 0\.60/);
  assert.match(sql, /p_accuracy[\s\S]*> 25/);
  assert.match(sql, /calculate_haversine_distance/);
  assert.match(sql, /DROP POLICY IF EXISTS "Students can insert their own records"/);
  assert.match(sql, /DROP POLICY IF EXISTS "Students can update their own records"/);
  assert.doesNotMatch(sql, /CREATE POLICY "Students can (?:insert|update)/);
});

test("precise GPS policy cannot be loosened by environment defaults", async () => {
  const source = await read("src/services/locationService.ts");
  const exampleEnvironment = await read(".env.example");

  assert.match(source, /Math\.min\(configured, 25\)/);
  assert.match(source, /maximumAge: 0/g);
  assert.match(source, /precise_location_required/);
  assert.match(exampleEnvironment, /VITE_MAX_GPS_ACCURACY_THRESHOLD=25/);
  assert.match(exampleEnvironment, /VITE_MAX_ANCHOR_ACCURACY=25/);
});

test("auth and attendance state are cleared across identity boundaries", async () => {
  const source = await read("src/hooks/useAuth.tsx");

  assert.doesNotMatch(source, /setUser\([^\n]*JSON\.parse/);
  assert.match(source, /clearLegacyStoredUser/);
  assert.match(source, /attendanceService\.reset\(\)/);
  assert.match(source, /verifiedUserIdRef/);
});

test("liveness cannot downgrade to the removed optical fallback", async () => {
  const tracker = await read("src/services/googleLivenessTracker.ts");
  const flow = await read("src/components/verification/FaceVerificationFlowModal.tsx");

  assert.doesNotMatch(tracker, /analyzeFrameFallback/);
  assert.match(flow, /if \(!aiReady \|\| !landmarkerRef\.current\)/);
  assert.match(flow, /Retry Secure AI/);
});

test("admin course inserts include required IDs and reject invalid batches", async () => {
  const source = await read("src/services/courseService.ts");
  assert.match(source, /function newCourseId\(code: string\)/);
  assert.match(source, /id: newCourseId\(code\)/);
  assert.match(source, /Duplicate course code/);
  assert.match(source, /Course code, title, department, level, and semester are required/);
  assert.match(source, /creditUnit < 1 \|\| creditUnit > 6/);
});
