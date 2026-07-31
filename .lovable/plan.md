# Smart Campus Presence — Full Prototype

Build the complete web prototype from the uploaded master prompt: a mobile-first attendance platform combining facial recognition and GPS geofencing, with student and lecturer experiences, realistic mock data, and simulated success/error states. No real backend — all verification is simulated behind mock service modules so it can later swap to a real API.

## Design system

- Deep university indigo primary, emerald accent for verified, amber warning, red error, soft off-white background, white cards with subtle borders, 14px radius, Inter typography.
- All colors as semantic tokens in `src/styles.css`; no hardcoded color utilities.
- Calm, academic, non-flashy. Strong contrast, visible focus states, labelled controls.

## Screens

Public
- Landing page: hero, three core features, four-step how-it-works, academic trust points.
- Shared login with Student/Lecturer role selector, password visibility toggle, remember session, error and loading states.
- Student registration wizard (4 steps): personal info, academic info, course selection with search, face enrollment with camera mock and simulated outcomes (success, no face, multiple faces, too dark, duplicate, network error).
- Lecturer registration (single form).
- System Overview page: problem, solution, objectives, architecture and verification diagrams, security considerations, honest limitations.

Student
- Dashboard: welcome block, four summary metrics, today's active sessions, per-course attendance breakdown, five recent records.
- Attendance verification flow (priority screen): session summary, three-stage indicator (session validation, location, face), GPS panel with accuracy/distance/radius and technical details, camera capture mock, processing state, final server-returned result card with score, distance and time; specific failure explanations with retry.
- History: filters by course, date range, status; monthly summary; table on desktop, cards on mobile.
- Courses list with attendance percentages, and profile page.

Lecturer
- Dashboard: welcome, four metrics, quick actions, active session panel, recent sessions.
- Create session: course, topic, capture location with accuracy, radius slider 50–100m (default 75), optional note, schematic geofence visual, confirmation screen with session ID.
- Live session (priority screen): header with duration and live badge, live summary, feed that ticks in new verifications on a timer, search/filter, export stub, end-session confirmation that stops new check-ins.
- Session history with filters, and session attendance ledger with collapsible anchor coordinates and prototype CSV/PDF export action.
- Courses and profile pages.

## Technical notes

- TanStack Router file routes under `src/routes` (the project's router — no React Router). `/` becomes the landing page; student and lecturer route groups with a shared `AppShell` layout: desktop sidebar + top header, mobile bottom nav + compact top bar.
- Mock auth/session state in a React context persisted to localStorage; role-aware route guards that redirect to `/login`.
- Mock services in `src/services/`: `authService`, `locationService`, `biometricService`, `attendanceService` — each async with realistic delays and pluggable outcome scenarios.
- Seed data in `src/data/` using the specified Nigerian university sample (Chinedu Okafor, Dr. Adaeze Nwosu, ECE 501–509, active ECE 503 session at 75m).
- Shared components in `src/components/` (layout, navigation, attendance, verification, forms) covering the reusable list: MetricCard, StatusBadge, DataTable, ResponsiveRecordCard, CameraCaptureMock, LocationVerificationPanel, VerificationStepIndicator, AttendanceResultCard, EmptyState, ErrorState, LoadingSkeleton, ConfirmationDialog, toasts via sonner.
- Demo Controls panel (floating, dismissible) to force success/failure scenarios for GPS and face verification during a presentation.
- Wording throughout reflects server-side verification: the client captures but never decides. No identity picker, no manual coordinate entry.
- Per-route `head()` metadata with unique titles and descriptions.

## Out of scope

BLE beacons, device binding, gamification, ranking, anomaly detection, real camera/biometric backend, real database.
