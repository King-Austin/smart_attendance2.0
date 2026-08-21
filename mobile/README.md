# UNIZIK Presence Mobile

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

## Local setup

1. Copy `.env.example` to `.env` and supply the public mobile values.
2. Install dependencies with `npm install`.
3. Run `npm start` for Expo Go-compatible UI work.
4. Use an Expo development build for push notifications and the production face scanner.

Development builds expose role-preview buttons when live credentials are absent. This code is guarded by `__DEV__` and is unavailable in production bundles.

## Checks

```bash
npm run typecheck
npm run lint
npx expo-doctor
```

## Required external configuration

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Supabase Function secrets: `BIOMETRIC_API_URL`, `BIOMETRIC_API_KEY`, and `REQUIRE_SERVER_LIVENESS`
- EAS project/account and Android signing access
- Firebase Cloud Messaging credentials for Android push delivery through Expo Notifications

Never place service-role, biometric private, Firebase service-account, or Supabase personal-access tokens in `EXPO_PUBLIC_*` variables.
