# Smart Campus Presence

Attendance platform combining facial verification and GPS geofencing for tertiary institutions.

## Features

- **Student registration** with course selection and face enrollment (InsightFace embeddings via pgvector search to prevent duplicate enrollments).
- **Face verification** for attendance, with liveness checks.
- **GPS geofencing** — attendance only valid within a defined radius of the lecture venue.
- **Lecturer dashboards** — create sessions, view attendance ledgers.
- **Push notifications** for attendance session reminders.
- **Mobile** (Capacitor) and **web** targets.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React + Vite, SSR with server routes)
- [Supabase](https://supabase.com) — Postgres, Auth, RLS, pgvector face search
- [InsightFace](https://github.com/deepinsight/insightface) biometric node (Docker/FastAPI)
- Capacitor for Android builds

## Development

Requires Node.js and npm.

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Copy `.env.example` to `.env` and fill in your Supabase project URL, publishable key, and service-role key.

## Deployment

- **Frontend / server routes**: deploy the TanStack Start app to Vercel (`npm run build`, Nitro preset `vercel`).
- **Backend**: Supabase hosts the database, auth, and the pgvector duplicate-face search function.
- **Biometric node**: run the InsightFace Docker container on a reachable host and point `VITE_BIOMETRIC_API_URL` at it.

See `.env.example` for all environment variables.
