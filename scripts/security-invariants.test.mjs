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
  assert.match(flow, /if \(!aiReady \|\| !runtimeRef\.current\)/);
  assert.match(flow, /Retry face scanner/);
});

test("admin course inserts include required IDs and reject invalid batches", async () => {
  const source = await read("src/services/courseService.ts");
  assert.match(source, /function newCourseId\(code: string\)/);
  assert.match(source, /id: newCourseId\(code\)/);
  assert.match(source, /Duplicate course code/);
  assert.match(
    source,
    /Course code, title, (?:faculty, )?department, level, and semester are required/,
  );
  assert.match(source, /creditUnit < 1 \|\| creditUnit > 6/);
});

test("student enrollment requires guardian details in UI, service, and database", async () => {
  const registration = await read("src/routes/register.student.tsx");
  const auth = await read("src/services/authService.ts");
  const sql = await read("supabase/migrations/0020_require_student_guardian.sql");
  assert.match(registration, /Guardian name, phone number, and email are required/);
  assert.match(auth, /Guardian name, phone number, and email are required to register a student/);
  assert.match(sql, /trg_require_student_guardian_details/);
  assert.match(sql, /NEW\.face_enrolled[\s\S]*cardinality/);
});

test("guardian emails use authenticated server dispatch and server-only Resend credentials", async () => {
  const endpoint = await read("src/routes/api/email/guardian.ts");
  const resend = await read("src/lib/resendClient.ts");
  const migration = await read("supabase/migrations/0021_guardian_email_events.sql");
  assert.match(endpoint, /authorization/);
  assert.match(endpoint, /auth\.getUser\(token\)/);
  assert.match(endpoint, /caller\.role === "admin"/);
  assert.doesNotMatch(resend, /VITE_RESEND_API_KEY/);
  assert.match(migration, /REVOKE ALL ON public\.guardian_email_events FROM anon, authenticated/);
});

test("UNIZIK Computer Science seed is idempotent and preserves aliases", async () => {
  const sql = await read("supabase/migrations/0022_seed_nau_computer_science_courses.sql");
  const ids = [...sql.matchAll(/\('nau-csc-[^']+','(?:CSC|NAU-CSC)[^']*'/g)];
  assert.equal(ids.length, 38); // 19 in conflict preflight + 19 in seed values
  assert.match(sql, /'CSC100','Computer Appreciation',2,'100 Level'/);
  assert.match(sql, /'CSC252','Data Structure',2,'200 Level',ARRAY\['CSC301'\],true/);
  assert.match(sql, /ON CONFLICT \(id\) DO UPDATE/);
  assert.match(sql, /nau-csc-2025-2026-second-semester/);
});

test("Supabase credentials stay in ignored environment files", async () => {
  const mcpConfig = await read(".mcp.json");
  const mcpLauncher = await read("scripts/run-supabase-mcp.cjs");
  const gitignore = await read(".gitignore");

  assert.doesNotMatch(mcpConfig, /sbp_[A-Za-z0-9]+/);
  assert.match(mcpConfig, /scripts\/run-supabase-mcp\.cjs/);
  assert.match(mcpLauncher, /resolve\(process\.cwd\(\), "\.env"\)/);
  assert.match(mcpLauncher, /process\.env\.SUPABASE_ACCESS_TOKEN/);
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
});
