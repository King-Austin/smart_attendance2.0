# Smart Campus Presence Scope

## Product Promise

Students verify attendance with precise GPS and face checks while lecturers get a live, auditable attendance ledger. Parents/guardians can view their child's attendance reports, and limited proxy attendance can support cases where a student does not have their phone.

## Release Target

The first release is an MVP for one department. It is not yet a whole-school deployment.

The attendance record is legally binding for both lecturers and students, so every verification path must be auditable, explainable, and resistant to casual abuse.

## Target Platforms

Android is the release platform for now.

iOS is explicitly out of scope for the MVP, but the architecture should not block a later iOS build.

Web remains useful for development, admin, lecturer dashboards, and deployment through Vercel, but Android is the primary student attendance surface.

## Deployment Architecture

The production deployment target is:

- Vercel for the TanStack Start frontend and server routes.
- Supabase for Auth, Postgres, RLS, storage where needed, realtime feeds, and pgvector duplicate-face search.
- External biometric API for face enrollment and face verification.
- Capacitor for the Android wrapper.

Do not reintroduce BLE/Bluetooth proximity verification for the MVP.

## Core Actors

- Student: registers, enrolls in courses, enrolls face, marks attendance, views personal attendance history, and may initiate an approved proxy attendance flow for another student only under strict rules.
- Lecturer: self-enrolls/creates lecturer account, manages assigned/shared courses and sessions, creates attendance sessions for approved assigned courses, configures geofence radius, monitors live attendance, exports reports, and owns session-level attendance accountability.
- Admin: oversees department-level data, users, approvals, courses, and reports.
- Parent/guardian: receives their child's attendance reports by email. Guardians do not log in to the MVP.

## MVP Verification Policy

Required proof for normal attendance is GPS + face verification.

GPS must be precise location, not approximate/coarse location. If the device only grants approximate location, attendance verification must fail with a retry/settings instruction.

Face verification must include liveness detection and biometric face matching. Liveness should be optimized to reduce lag and avoid frustrating students during live lectures.

Attendance is identity-bound, not device-bound. A student may use another student's phone only by signing into their own student account and completing live face verification against their own enrolled face. The device itself must not be treated as the identity proof.

The system must reject attempts where the live captured face does not match the signed-in student's enrolled face vector.

Bluetooth/BLE is not part of the verification model.

Offline attendance can wait. The MVP should prefer reliable online verification over queueing questionable attendance attempts.

## Location Policy

Each lecturer session must have a configurable geofence radius.

The minimum allowed radius is 100 meters. The UI and validation must prevent lecturers from creating a session radius below 100 meters.

If GPS accuracy is poor, unavailable, or outside the geofence, the student must retry. No automatic fallback should mark attendance as present.

Recommended GPS behavior:

- Request fine/precise location permission.
- Use high-accuracy GPS acquisition.
- Take multiple samples and keep the best fix.
- Reject readings whose reported accuracy is worse than the configured threshold.
- Record GPS latitude, longitude, accuracy, distance from anchor, and timestamp for the audit ledger.

## Face and Liveness Policy

Students must enroll their face before they can mark attendance.

Face enrollment should check for duplicate faces so one face cannot be registered under multiple student accounts.

Face re-enrollment must also run the duplicate-face check, excluding only the same student's current profile. A student must not be able to overwrite their enrollment with another already-enrolled student's face.

Attendance face verification must compare the captured face against the student's enrolled face data through the external biometric API.

The liveness flow should be fast enough for lecture conditions. Avoid heavy animations, unnecessary camera restarts, long model initialization loops, or repeated prompts that make check-in feel slow.

The MVP should store the least possible biometric data. One face image may be stored as the user's avatar. Aside from that avatar and the enrolled face embedding/vector needed for matching, do not store additional face images by default.

Attendance check-in captures should be transient: capture, compress, send to the biometric API, receive the verification result, then discard the capture unless a future approved audit feature explicitly requires retention.

In development, keep the current configured model: `VITE_BIOMETRIC_API_URL` points to the external biometric API, and the app sends compressed 512px JPEG captures for enrollment/verification. For production, use the same shape but host the biometric API as close as practical to Nigerian users to reduce round-trip latency. The goal is not to move full recognition into the client for MVP; it is to minimize upload size, avoid repeated captures, and keep the biometric service geographically/network-close.

Face embeddings/vectors and any stored avatar image must be treated as sensitive biometric data.

Low-latency mobile scanning guidance:

- Keep face matching server-side for the MVP because the attendance record is legally binding and the current development model already uses an external biometric API.
- Use on-device scanning only for preflight guidance: face present, single face, lighting, pose/liveness prompts, and best-frame capture.
- Send exactly one compressed best-frame image per enrollment or attendance attempt when possible.
- Prefer a native Android scanner if web-based MediaPipe remains laggy in the Capacitor WebView.
- Candidate scanner stack for MVP hardening: Android CameraX + Google ML Kit Face Detection in FAST mode for face box, eyes, smile/head angle, and liveness prompt guidance; then send the best 512px JPEG to the existing biometric API for final matching.
- Alternative scanner stack if more native performance is needed: MediaPipe Tasks native Android or OpenCV YuNet for fast face detection, still followed by server-side InsightFace matching.
- Avoid uploading video streams. Upload still images only.
- Avoid storing check-in captures unless a later approved audit requirement explicitly demands it.

## Course and Enrollment Model

Students enroll themselves into courses.

Lecturers can also enroll themselves into the system and manage their lecturer profile. Lecturer self-enrollment requires department/admin approval before the lecturer can create legally binding attendance sessions.

More than one lecturer may handle the same course. A course is not owned by a single lecturer. Approved lecturers assigned to the same course should be able to see attendance sessions and ledgers for that course, including sessions created by another assigned lecturer.

Lecturers may create sessions only for courses assigned to their lecturer profile.

Courses are department-scoped in the MVP.

## Attendance Session Flow

Lecturer creates an attendance session for a course.

The session stores:

- Course.
- Lecturer.
- Session status.
- Geofence anchor.
- Configurable radius with a minimum of 100 meters.
- Start and end timestamps.
- Expected/enrolled count.

Student check-in requires:

- Active session.
- Student enrollment in the course.
- Precise GPS within the configured radius.
- Successful liveness check.
- Successful face match.
- Online connection to required services.

Borrowed-phone flow:

- Student A may use Student B's phone.
- Student A must sign into Student A's own account.
- Student A must complete liveness and face verification using Student A's live face.
- The attendance record is stored for Student A only.
- Student B's account, face vector, and attendance record must not be used.

Successful check-ins appear in the lecturer's live session feed.

Failed check-ins should show clear retry reasons, but should not create present attendance records.

## Proxy Attendance

Proxy attendance is needed for cases where a student does not have their phone.

Because attendance is legally binding, proxy attendance must not be a silent bypass of GPS + face verification.

MVP-safe proxy policy:

- A student can initiate a proxy request for another student.
- The proxy action must be clearly labeled as proxy, not normal self-check-in.
- The lecturer must approve or reject the proxy entry during the active session or during review.
- The record must store who initiated it, who it was for, the lecturer decision, timestamps, reason, and audit notes.
- Proxy records should be visually distinct in ledgers and reports.

Do not count proxy attendance as equivalent to normal verified attendance unless the lecturer explicitly approves it.

## Reports

MVP reports must include:

- Session CSV export.
- Student attendance history.
- Course attendance summary.
- Full audit ledger.
- Parent/guardian child reports.

Anomaly list is out of scope for the MVP.

## Parent/Guardian Reports

Parents/guardians receive their child's attendance reports by email only.

Guardians do not have login accounts in the MVP.

Report emails must be scoped to the linked student only and should include only the minimum useful attendance information. Do not expose broad student data through guardian reports.

## Out of Scope for MVP

- BLE/Bluetooth proximity.
- iOS release.
- Offline attendance sync.
- Anomaly detection list.
- Whole-school/multi-department rollout.
- React Native rewrite.
- Attendance without GPS + face, except lecturer-reviewed proxy exceptions.

## Release Readiness Criteria

The MVP is release-ready only when:

- Android build is tested on real devices.
- Supabase migrations replay cleanly from an empty database.
- RLS prevents cross-user and cross-role data leaks.
- Normal attendance cannot be marked without active session, course enrollment, precise GPS, liveness, and face match.
- Lecturer session reports and audit ledger match the database records.
- Guardian report emails expose only the intended student's attendance data.
- Biometric API failures produce clear retry states and do not mark attendance.
- Liveness flow is responsive enough for real lecture use.
- Build, typecheck, and lint pass in CI or a documented release checklist.

## Open Decisions

- What is the exact lecturer approval workflow for proxy attendance?
- What is the production biometric API host and uptime expectation?
- What GPS accuracy threshold should be used in real campus testing?
