# Smart Campus Presence Mobile

Expo/React Native rebuild of Smart Campus Presence for Nnamdi Azikiwe University.

## Product rules represented in this app

- Android-first and iOS-ready.
- Student, lecturer, and faculty-admin experiences.
- Students select courses limited to their department, level, and semester.
- Lecturers require admin approval, then may select department courses immediately.
- Multiple lecturers can share a course with equal course access.
- Attendance requires precise GPS within a fixed 150-metre radius and a live-face match.
- Sessions remain open until the creating lecturer closes them.
- Only the session creator or an admin may correct attendance, with a required audit reason.

## Implemented production flows

- Student and lecturer registration with normalized faculty/department placement.
- Mandatory student face enrolment and replacement through server-issued, Google ML Kit on-device liveness challenges.
- Atomic pgvector duplicate-face prevention across every other account.
- Student and lecturer course selection enforced by Supabase RLS.
- Automatic active-session discovery, fresh precise GPS, live-face challenge, and server-owned attendance writes.
- Lecturer session creation/end, complete ledgers, automatic missed records, audited corrections, course summaries, and CSV export.
- Admin lecturer review, academic setup, faculty reports, CSV export, and audited corrections.
- Expo push registration and server-triggered session, attendance-result, and lecturer-approval notifications.

No preview identities or client-side attendance success path remain.

## Local setup

1. Copy `.env.example` to `.env` and supply the public mobile values.
2. Install dependencies with `npm install`.
3. Run `npm start` for Expo Go-compatible UI work outside the live-face route.
4. Use an Expo development build for the native ML Kit face scanner, push notifications, and physical-device QA.

Use an Expo development build for camera, precise-location, notification, and file-sharing QA on a physical Android device.

## Checks

```bash
npm run typecheck
npm run lint
npx expo-doctor
```

## Required external configuration

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Supabase Function secrets: `BIOMETRIC_API_URL`, optional `BIOMETRIC_API_KEY`, and `FACE_DUPLICATE_THRESHOLD`
- EAS project/account and Android signing access
- Firebase Cloud Messaging credentials for Android push delivery through Expo Notifications

## Supabase deployment

After linking the intended Supabase project:

```bash
supabase db push
supabase secrets set --env-file supabase/.env.functions
supabase functions deploy liveness-challenge
supabase functions deploy enroll-face
supabase functions deploy verify-attendance
supabase functions deploy session-actions
```

Supabase automatically supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. Copy `supabase/.env.functions.example` to an untracked `supabase/.env.functions` and supply the biometric values.

The biometric server handles identity only; liveness is processed locally before it is called:

- `POST /enroll`: accepts `image`; returns a 512-number `vector`.
- `POST /verify`: accepts `image` and `stored_vector`; returns `match` and `similarity`.

The app uses the bundled Google ML Kit model to check lighting, one-person framing, head angles, and eye state without waiting for a network round-trip. The Edge Function still owns the randomized one-time challenge, validates the ordered ML Kit evidence, verifies unique frame hashes and timestamps, and checks that the identity image hashes to the first analysed frame. Only that identity image is uploaded to the biometric API.

Client-side liveness raises the cost of casual photo impersonation but a modified/rooted client can forge client evidence. Before a high-assurance institutional rollout, add Play Integrity/App Attest verification or move independent liveness validation into a trusted backend.

Create the first administrator through a trusted Supabase SQL/service-role operation after their account exists. The public registration path deliberately cannot create admins.

Never place service-role, biometric private, Firebase service-account, or Supabase personal-access tokens in `EXPO_PUBLIC_*` variables.
