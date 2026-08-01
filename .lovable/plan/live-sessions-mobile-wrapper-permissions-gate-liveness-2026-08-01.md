# Live Sessions, Mobile Wrapper, Permissions Gate, Liveness

Five changes, all in the prototype's frontend/mock-service layer.

## 1. Missing lecturer pages (fixes "page not found")

The app shell links to lecturer pages that were never created, so after lecturer
registration/login the dashboard 404s. Create:

- `/lecturer/dashboard` — welcome block, four metrics, quick actions, active session panel, recent sessions.
- `/lecturer/create-session` — full create flow (below).
- `/lecturer/session/$sessionId` — live session monitor: duration + live badge, live counts, feed that ticks in new verifications on a timer, search/filter, export stub, end-session confirmation.
- `/lecturer/sessions` — session history with filters.
- `/lecturer/ledger/$sessionId` — per-session ledger with collapsible anchor coordinates and a prototype export action.

Lecturer registration then redirects straight to `/lecturer/dashboard`.

## 2. Create-session flow (end to end)

Course select, topic, optional note, "Capture current location" step that shows the
captured anchor with its GPS accuracy, then a schematic geofence preview and a
confirmation screen with the generated session ID and a link into the live monitor.
Creating a session ends any previously active one and seeds the live feed, using the
existing `attendanceService.createSession`.

**Radius:** remove the slider. The radius is fixed and simply displayed to the
lecturer as the enforced range (75 m default, shown as "75–100 m enforced range"),
not adjustable.

## 3. Up-front permissions gate

A permissions screen that runs the moment someone enters the app (before dashboards),
requesting and verifying in order:

- Location / GPS (browser Geolocation + `navigator.permissions` state; native Geolocation on device)
- Camera (needed for face capture)
- Network reachability (online/offline + Wi-Fi/connection check)

Behaviour: each item shows granted / denied / unavailable with a re-request button;
denied items block continuing and explain how to fix in device settings; state is
re-checked on app focus so a permission revoked later is caught before verification
rather than mid-flow. Once all are granted the gate stays out of the way.

## 4. Liveness detection before capture

Replaces the single-shot camera mock with a guided challenge sequence in both face
enrollment and attendance verification:

- Randomised prompt order: "Turn your head left", "Turn your head right", "Blink", "Smile"
- Each prompt shows a countdown and a pass tick before advancing
- Only after all challenges pass does the app capture the frame and send it to the
  (simulated) biometric server
- Failure states: challenge timeout, too much movement, spoof suspected (flat photo) —
  each with a clear explanation and retry
- Demo Controls gain a liveness scenario switch so pass/fail can be forced on stage

## 5. Installable mobile app (Capacitor)

Add Capacitor so the app can be built as an installable Android/iOS app:

- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`,
  plus `@capacitor/geolocation`, `@capacitor/camera`, `@capacitor/network`
- `capacitor.config.ts` with app id, name, and web dir
- Permission code detects native vs web at runtime: native uses the Capacitor plugins,
  web falls back to browser APIs, so the preview keeps working
- Android/iOS permission strings documented (location, camera)
- Also add a web app manifest + icons so the site is installable to a phone home screen
  without a native build

Native builds (`npx cap add android`, `npx cap sync`, opening Android Studio/Xcode)
have to run on your own machine — I'll include the exact commands in the README.

## Technical notes

- New `src/services/permissionsService.ts` (isomorphic: Capacitor plugins when native,
  browser APIs otherwise) and `src/components/permissions/PermissionsGate.tsx`,
  mounted around the authenticated app shell.
- New `src/components/verification/LivenessChallenge.tsx`; `CameraCaptureMock` becomes
  the final capture step behind it. `biometricService` gains a liveness result stage.
- Radius stays in `AttendanceSession`; the create form sends the fixed value.
- Each new route gets its own `head()` title/description.
- Browser globals only inside effects/handlers so SSR stays clean.

## Out of scope

Real biometric matching, real geofence enforcement, app store submission, push notifications.
