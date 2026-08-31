# Smart Campus Presence Project System Guidelines

This file is the working source of truth for the current Smart Campus Presence rebuild. When older documents conflict with this file, follow this file first, then `mobile/PRODUCT_SPEC.md`, then the implementation.

## 1. Product Identity

- Product name: **Smart Campus Presence**.
- Institution context: **Nnamdi Azikiwe University (UNIZIK), Awka**.
- Do not rename the app to `UNIZIK Presence`.
- The university name may appear in copy, onboarding, reports, and institutional context, but the app brand remains Smart Campus Presence.
- Keep the existing application identity where possible:
  - Android package: `com.smartattendance.app`.
  - iOS bundle identifier: `com.smartattendance.app`.
  - Deep-link scheme: `smartattendance`.

## 2. Current V1 Scope

- Build a full mobile experience for:
  - Students.
  - Lecturers.
  - Faculty admins.
- Platform priority:
  - Android first.
  - iOS-ready architecture.
  - No dependency on Expo Go for production features.
- Institution scope:
  - Multiple departments inside one faculty.
  - Not whole-university or multi-institution yet.
- Backend:
  - Keep Supabase.
  - Keep the existing external biometric API.
  - Use Supabase Edge Functions for trusted attendance and face-enrolment decisions.

## 3. Visual and Screen Direction

The Expo app must feel like the previous Smart Campus Presence application, not a fresh unrelated redesign.

Use:

- Slate/navy primary brand tone.
- Muted light app background.
- White rounded cards.
- Compact dashboard-style typography.
- Status badges/chips for active, pending, verified, missed, failed, and warning states.
- Floating pill-style mobile navigation, matching the old mobile shell.
- Existing Smart Campus Presence naming, icon direction, and language.

Avoid:

- Rebranding the product around UNIZIK-only colours.
- Generic Expo starter visuals.
- Marketing-style hero screens inside the app.
- Overly large mobile cards that hide data density.
- Permission screens that feel detached from the actual workflow.

## 4. Main Role Rules

### Student

- Students self-register.
- Students enrol their face during registration before they can mark attendance.
- Students select their own courses.
- Students may only select courses matching their:
  - Department.
  - Level.
  - Semester.
- Students may use another phone only by signing into their own account and verifying their own live face.
- Attendance is identity-bound, not device-bound.
- Students may replace their enrolled face only after a fresh duplicate-face check.

### Lecturer

- Lecturers self-register.
- Lecturer accounts start as pending.
- Admin approval is required before a lecturer can create sessions.
- Approved lecturers select approved department courses.
- Lecturer course selection becomes active immediately.
- Multiple lecturers can manage the same course with equal access.
- A lecturer can create and close sessions only through trusted server-side checks.

### Admin

- Admins approve or reject lecturers.
- Admins manually create:
  - Faculties.
  - Departments.
  - Courses.
  - Levels and semesters where needed.
- Admins view summaries, ledgers, and reports.
- Admins can correct attendance records with mandatory audit reasons.
- Public registration must never create admin accounts.
- First admin creation must happen through a trusted Supabase SQL/service-role operation.

## 5. Core Screen Map

### Auth

- Sign in.
- Student registration.
- Lecturer registration.
- Student face enrolment.
- Pending lecturer approval state.
- Role-based routing after login.

### Student Mobile

- Dashboard.
- History.
- Courses.
- Profile.
- Face enrolment/replacement.
- Attendance verification.
- Attendance result state.
- Permission recovery state.

Student dashboard priority:

- Active eligible attendance sessions.
- Attendance performance.
- Selected courses.
- Recent attendance.

### Lecturer Mobile

- Dashboard.
- Sessions.
- Courses.
- Profile.
- Create session.
- Live session monitor.
- Session ledger.
- Correction flow.
- CSV export.

### Admin Mobile

- Dashboard.
- Lecturer approvals.
- Academic setup.
- Reports.
- Profile.
- Ledger correction flow.
- CSV export.

## 6. Attendance Policy

- Normal attendance requires:
  - Active session.
  - Student enrolled in the course.
  - Online connection.
  - Precise GPS.
  - Within fixed geofence.
  - Live-face liveness success.
  - Face match against the enrolled identity.
  - Server-owned attendance write.
- Fixed geofence radius: **150 metres**.
- The radius is not lecturer-configurable in V1.
- Active eligible sessions appear automatically to students.
- Sessions remain open until the creating lecturer ends them manually.
- Offline attendance is not accepted or queued.
- Attendance cannot be marked by a client-side success flag.

## 7. Attendance Correction Policy

- Only the session creator or an admin can correct an attendance record.
- Every correction must include a meaningful reason.
- Corrections must be auditable.
- Store:
  - Previous status.
  - New status.
  - Actor ID.
  - Actor role.
  - Session ID.
  - Attendance record ID.
  - Reason.
  - Timestamp.
- Do not delete or overwrite history silently.

## 8. Face Enrolment and Duplicate Prevention

Face enrolment must be server-owned and atomic.

Required enrolment flow:

1. Server issues a liveness challenge.
2. Device captures and analyses liveness locally.
3. Device sends one identity image and liveness evidence.
4. Edge Function validates the challenge and evidence.
5. Edge Function sends the identity image to biometric `/enroll`.
6. Biometric API returns a 512-dimensional vector.
7. Database checks the vector against existing enrolled faces using pgvector.
8. If similarity exceeds the duplicate threshold, enrolment is rejected.
9. If clear, profile face vector is saved.
10. Challenge is consumed once.

Rules:

- Duplicate threshold: `FACE_DUPLICATE_THRESHOLD`, currently `0.65`.
- Re-enrolment must exclude only the same student’s current profile.
- One face must not be reusable across multiple accounts.
- Duplicate detection must not be client-only.
- Race conditions must be prevented with an atomic database operation.
- Public clients must not write face vectors directly.
- Face captures are transient unless a later approved audit feature changes this.
- Treat embeddings, vectors, and avatars as sensitive biometric data.

## 9. Liveness Policy

Use on-device liveness for low latency, but keep final trusted decisions server-owned.

Current approach:

- Expo development/production build.
- Local Expo native module.
- Google ML Kit face detection on Android.
- iOS adapter point kept for later.

Required local checks:

- Good lighting.
- No severe glare.
- Exactly one face.
- Face properly framed.
- Straight face frame.
- Randomized left/right head movement.
- Closed-eye check.
- Frame hashes.
- Ordered timestamps.

Server-side challenge rules:

- Challenge is randomized.
- Challenge expires.
- Challenge is single-use.
- Evidence order must match issued instructions.
- Frame hashes must be unique.
- The uploaded identity image must hash to the expected primary analysed frame.

Security note:

- On-device liveness reduces casual photo/replay impersonation.
- A modified or rooted client can still forge local evidence.
- Before high-assurance university-wide rollout, add Play Integrity on Android and App Attest on iOS, or move independent liveness verification into trusted backend infrastructure.

## 10. Biometric API Contract

Current biometric API shape:

- `POST /enroll`
  - Input: `image`.
  - Output: `vector` with 512 numeric values.
- `POST /verify`
  - Input: `image`, `stored_vector`.
  - Output: `match`, `similarity`.

Rules:

- Upload only the best still image, not video.
- Compress identity captures before upload.
- Do not upload liveness movement frames unless the API contract explicitly changes.
- Biometric API failures must fail closed.
- A failed biometric response must never create a present attendance record.

## 11. Location and Permission Policy

Location:

- Request foreground precise location only.
- Do not request background location.
- Do not accept approximate/coarse location for attendance.
- Use fresh high-accuracy readings.
- The server makes the final geofence decision.

Camera:

- Request camera only during face enrolment or attendance verification.
- Do not request microphone access.
- Do not request photo-library access for attendance.
- Captures must not be saved to the user’s gallery.

Notifications:

- Ask after sign-in or when value is clear.
- Notifications are helpful, not identity proof.

Permission UX:

- Explain why permission is needed before the native prompt.
- If denied, show retry guidance.
- If blocked, show an app-settings recovery action.
- Do not ask for every permission at app launch.

## 12. Notifications

Push notifications should cover:

- Lecturer opens a session.
- Attendance succeeds.
- Attendance fails.
- Lecturer account is approved.

Push token rules:

- Store mobile push tokens securely.
- Support token refresh.
- Do not expose service-account credentials in public app variables.
- Android FCM credentials must be configured through EAS/GitHub/Supabase secrets, not committed.

## 13. Reports

V1 reports must include:

- Student attendance history.
- Course attendance summary.
- Per-session attendance ledger.
- CSV/Excel export.

Report rules:

- Reports must reflect server records, not cached client assumptions.
- Correction history must be visible where relevant.
- Exported CSV should include enough audit context for review.

## 14. Supabase Rules

Use Supabase for:

- Auth.
- Postgres.
- Row Level Security.
- Realtime feeds.
- Edge Functions.
- pgvector duplicate-face search.

Hard rules:

- RLS must prevent cross-role leaks.
- Clients must not directly write trusted attendance results.
- Clients must not directly write biometric vectors.
- Public clients must not create admin users.
- Service-role operations belong only in trusted Edge Functions or controlled admin scripts.
- Migrations must replay cleanly from an empty database.

Edge Functions own:

- Liveness challenge issue/consume.
- Face enrolment.
- Duplicate-face check.
- Attendance verification.
- Session actions where trust matters.
- Corrections where audit matters.

## 15. Mobile Architecture

Use:

- Expo SDK 57.
- React Native.
- Expo Router.
- TypeScript.
- TanStack Query for server state.
- Supabase JS client.
- Expo development builds for native modules.
- EAS Build/Submit/Update for release flow.

Do not:

- Rebuild the mobile app as a WebView wrapper.
- Reintroduce Capacitor for the new mobile rebuild.
- Depend on Expo Go for ML Kit, push, or release QA.
- Add native packages without checking Expo development-build compatibility.

## 16. Branding and Copy Rules

Use the product brand:

- Smart Campus Presence.
- Smart Campus.
- Presence.

Use institution context carefully:

- Nnamdi Azikiwe University.
- UNIZIK.
- Awka.

Avoid:

- Naming the app `UNIZIK Presence`.
- Using unrelated colour palettes because they look more “official.”
- Claiming an official crest or logo unless the asset and usage approval are available.

Current visual language:

- Primary slate/navy: used for app shell, navigation, icon background, and primary actions.
- Muted light background: used for screens.
- White cards: used for content sections.
- Green: verified/success.
- Amber/gold: warning/pending.
- Red: failure/rejection.

## 17. Security and Secret Handling

Never commit:

- Supabase service-role key.
- Supabase personal access token.
- Biometric API private key.
- Firebase service-account JSON.
- Android signing keys.
- EAS token.
- Any private `.env` file.

Public mobile variables may include only values intended for the client, such as:

- `EXPO_PUBLIC_SUPABASE_URL`.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

Important:

- Secrets previously pasted in chat must be treated as exposed.
- Rotate exposed service-role keys and personal access tokens before production.
- Do not paste new privileged secrets into chat.
- Configure secrets through Supabase, EAS, GitHub Actions, or a secure deployment environment.

## 18. Deployment Access Needed

Production deployment requires:

- Rotated Supabase privileged credentials.
- Supabase project deployment access.
- Biometric API URL/key, if key is required.
- Expo/EAS project access.
- Android signing configuration.
- Android FCM credentials.
- GitHub Actions availability.
- Physical Android device testing.

Deployment commands should not be run blindly. Confirm the target project before pushing migrations or functions.

## 19. Validation Checklist

Before merging meaningful changes:

```bash
npm run typecheck
npm run lint
```

For mobile changes:

```bash
cd mobile
npm run typecheck
npm run lint
npx expo-doctor
```

For Supabase Edge Function changes:

```bash
cd mobile
npm run validate:edge
```

Before release:

- Expo public config resolves correctly.
- Android development build installs.
- Camera permission flow works on device.
- Precise GPS flow works on device.
- Notification token registration works.
- ML Kit liveness works on physical Android.
- Supabase migrations replay cleanly.
- RLS tests pass for student, lecturer, and admin boundaries.
- Duplicate-face enrolment is tested.
- Attendance cannot be forged from the client.
- CSV export contains correct records.

## 20. Engineering Style

Follow existing repo patterns.

General rules:

- Keep changes scoped.
- Prefer typed APIs and structured data.
- Keep security-sensitive decisions on the server.
- Avoid large unrelated refactors.
- Avoid mock success paths in production flows.
- Fail closed for biometric, GPS, liveness, and permission errors.
- Use clear user-facing errors.
- Make dashboard data dense and scannable.

React Native rules:

- Use reusable UI primitives from `mobile/src/components/ui`.
- Keep touch targets comfortable.
- Avoid overlapping bottom tabs and content.
- Use safe areas.
- Keep permission prompts near the action that needs them.
- Keep screens visually aligned with the previous Smart Campus Presence app.

Supabase rules:

- Prefer migrations over manual database drift.
- RLS is required, not optional.
- Trusted writes belong in Edge Functions.
- Do not broaden policies to “make it work.”

## 21. Known Documentation Conflicts

Older `scope.md` content still mentions some earlier decisions. The current V1 decisions are:

- Expo React Native rebuild, not Capacitor.
- Android first, iOS-ready.
- Multiple departments in one faculty, not one department only.
- Fixed 150-metre geofence, not lecturer-configurable radius.
- Normal borrowed-phone flow is allowed only by signing into the student’s own account and passing live-face verification.
- Proxy attendance is not part of the confirmed V1 normal flow unless explicitly re-approved later.

When implementing, use these current rules.

## 22. Definition of Done

A feature is done only when:

- It follows the current V1 scope.
- It keeps Smart Campus Presence branding.
- It works with real Supabase data or fails clearly when credentials are missing.
- It does not introduce fake attendance success.
- It does not weaken duplicate-face protection.
- It does not store unnecessary biometric captures.
- It has clear permission denial and recovery states.
- Typecheck and lint pass.
- Relevant server or native checks are tested.
