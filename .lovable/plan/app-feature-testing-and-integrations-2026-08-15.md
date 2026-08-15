# Smart Campus Presence — Feature Testing and Integration Plan

## Objective

Move the app from a polished prototype with partial live services to a release candidate whose core student and lecturer journeys are verified on web and Android, with Supabase, biometric verification, geofencing, notifications, and deployment integrations tested end to end.

## Current baseline

- The student and lecturer screens, permissions gate, liveness flow, Capacitor wrapper, Supabase client, attendance service, push service, and face-check API route exist.
- The app operates in two modes: mock mode when Supabase is not configured and live mode when valid Supabase browser credentials are present.
- Courses and several dashboard/history views still read `src/data/mockData.ts` directly, while authentication, sessions, records, push subscriptions, and duplicate-face checks can use Supabase.
- There is no JavaScript unit, component, or browser end-to-end test framework configured.
- Android contains only the generated example tests.
- The local migration chain needs repair and a clean-database replay before it can be treated as authoritative.
- Live Supabase state has not yet been verified from this environment because the configured project hostname could not be resolved.

## Working rules

- Keep mock mode as a deliberate demo mode, but never silently fall back to mock data after a live integration error.
- Use separate development/test Supabase data. Never run destructive migration tests against production.
- Keep service-role credentials server-side. Browser tests use an anon key and disposable test users.
- Each phase ends with evidence: command output, screenshots, database assertions, or device test notes.
- A phase is complete only when its acceptance criteria pass; failed checks become tracked defects before moving on.

## Phase 1 — Establish a reproducible quality baseline

- [ ] **1. Add the test harness and baseline CI checks**
  Scope: Configure Vitest, React Testing Library, jsdom, Playwright, coverage reporting, and stable `test`, `test:unit`, `test:e2e`, and `typecheck` scripts. Add a web quality workflow alongside the Android workflow.
  Acceptance: A smoke unit test and a smoke browser test pass locally; lint, typecheck, unit tests, production build, and Playwright run from clean install commands.
  Verify: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`, and `npm run test:e2e`.

- [ ] **2. Repair and replay the Supabase migration chain**
  Scope: Move `current_profile_role()` creation before policies that call it; make the pgvector migration compatible with a fresh schema and an older `numeric[]` schema; review the destructive legacy-course cleanup in `0003`; add migration verification SQL for tables, columns, indexes, functions, grants, RLS, and course counts.
  Acceptance: All migrations apply from zero on a disposable local/test database and also upgrade a fixture representing the older schema. Reapplying safe/idempotent portions produces no drift. No production database is modified during this phase.
  Verify: `supabase db reset`, `supabase migration list`, schema assertions, and a clean dump/diff with no unexpected changes.

## Phase 2 — Test the domain services before the screens

- [ ] **3. Unit-test location, permissions, liveness, and biometric decisions**
  Scope: Test geofence boundaries, GPS accuracy thresholds, browser/native permission states, focus rechecks, offline behavior, randomized liveness challenges, all forced demo scenarios, biometric timeouts, malformed responses, duplicate-face results, and safe error messages.
  Acceptance: Boundary values are explicit; denied/unavailable permissions block correctly; captures cannot proceed before liveness passes; network and server failures do not report successful attendance.
  Verify: Targeted Vitest suites with mocked browser APIs, Capacitor modules, timers, and fetch; review coverage for every decision branch.

- [ ] **4. Unit-test auth and attendance state transitions**
  Scope: Cover registration/login/logout/profile hydration, role guards, create/end session, active-session replacement, duplicate check-ins, attendance persistence, feed hydration, and mock/live mode behavior.
  Acceptance: Student and lecturer authorization boundaries hold; ending a session prevents new records; one student cannot record twice for one session; live errors remain errors instead of falling back to mock success.
  Verify: Service tests against deterministic Supabase client fakes plus state-transition assertions.

## Phase 3 — Verify complete user-facing features

- [ ] **5. Component-test critical interaction states**
  Scope: Test the permissions gate, course selector, liveness challenge, camera capture, location panel, verification step indicator, attendance result, session controls, filters, dialogs, loading, empty, error, and offline states.
  Acceptance: Keyboard operation, focus behavior, accessible names, validation, retry paths, and mobile layouts work. Sensitive coordinates and biometric details are shown only where intended.
  Verify: React Testing Library interaction tests, automated accessibility checks, and viewport snapshots for representative mobile and desktop sizes.

- [ ] **6. Build mock-mode end-to-end journeys**
  Scope: Automate student registration and enrollment, student login and successful/failed attendance, history/course/profile views, lecturer registration/login, session creation, live monitoring, session ending, ledger filtering/export, permissions recovery, and offline recovery.
  Acceptance: Every primary route is reachable; success and failure scenarios produce the expected UI; role guards prevent cross-role access; refresh and back navigation preserve valid state.
  Verify: Playwright projects for desktop Chromium and a mobile viewport, with screenshots/traces retained on failure.

## Phase 4 — Complete and certify live integrations

- [ ] **7. Replace direct mock-data reads with repositories**
  Scope: Introduce course, dashboard, history, and ledger data access behind typed repository/service interfaces. Use Supabase implementations in live mode and explicit fixtures in demo mode. Add visible environment/mode diagnostics for developers.
  Acceptance: No route imports domain records directly from `mockData.ts`; mock and live implementations satisfy the same contract; live fetch failures display recoverable errors rather than demo content.
  Verify: `rg` confirms routes no longer import domain mocks; contract tests run against both implementations; manual live-mode smoke test shows database-backed values.

- [ ] **8. Integrate and test Supabase end to end**
  Scope: Link a disposable test project, apply migrations, seed curriculum data, create disposable student/lecturer accounts, and test Auth, profile trigger/update, RLS, course reads, session writes, attendance writes, duplicate prevention, realtime/live feed behavior, and push subscription ownership.
  Acceptance: Anonymous and wrong-role requests are denied; authorized journeys succeed; expected curriculum counts match local seed data; database rows match what the UI displays; migration history is synchronized.
  Verify: Supabase integration test suite using anon/user sessions, server-only admin setup/cleanup, migration-list comparison, and recorded table-count/schema assertions.

- [ ] **9. Integrate biometric verification and notifications**
  Scope: Add health/readiness checks and a documented contract for the InsightFace service; test embedding dimensions, duplicate search threshold, liveness/face error mapping, authentication, timeouts, payload limits, and redacted logging. Validate web-push subscription registration, renewal, delivery, click navigation, opt-out, and expired-endpoint cleanup.
  Acceptance: The biometric service fails closed, keys never reach the browser, embeddings are not logged, unavailable services produce actionable UI, and a test notification reaches a subscribed device/browser.
  Verify: Contract tests against a controlled biometric instance, API-route integration tests, log inspection, and a notification delivery checklist with database evidence.

## Phase 5 — Platform and release validation

- [ ] **10. Certify Android, web deployment, security, and observability**
  Scope: Test Capacitor permission prompts, camera, GPS, network changes, lifecycle resume, back navigation, offline screens, push notifications, and the signed build path on a real Android device. Test Vercel SSR/routes/environment variables and Supabase callback URLs. Review RLS, CSP/CORS, secret handling, rate limits, biometric retention, consent, account deletion, audit logging, error reporting, and operational health checks.
  Acceptance: Web and Android pass the release matrix; no secrets appear in client bundles or logs; production URLs and auth redirects work; critical failures are observable; rollback and incident notes exist.
  Verify: CI artifacts, real-device test record, Vercel preview smoke suite, dependency/security scan, client-bundle secret scan, RLS negative tests, and final release checklist sign-off.

## Required test matrix

| Area | Mock web | Live web | Android device | Failure cases |
|---|---:|---:|---:|---:|
| Authentication and role guards | Yes | Yes | Yes | Yes |
| Student registration and face enrollment | Yes | Yes | Yes | Yes |
| Lecturer session creation/end | Yes | Yes | Yes | Yes |
| GPS geofence and accuracy gate | Yes | Yes | Yes | Yes |
| Liveness and face verification | Yes | Yes | Yes | Yes |
| Attendance persistence and duplicate prevention | Yes | Yes | Yes | Yes |
| Live feed, ledger, history, and courses | Yes | Yes | Yes | Yes |
| Permissions, offline, and resume behavior | Yes | Yes | Yes | Yes |
| Push subscription and delivery | Optional | Yes | Yes | Yes |

## Release gates

1. **Schema gate:** clean migration replay and RLS assertions pass.
2. **Quality gate:** lint, typecheck, unit/component tests, build, and mock E2E pass in CI.
3. **Integration gate:** disposable Supabase and biometric contract suites pass without mock fallback.
4. **Device gate:** core attendance journey passes on a physical Android device under granted, denied, inaccurate-GPS, and offline conditions.
5. **Deployment gate:** Vercel preview, auth redirects, server routes, environment validation, and smoke tests pass.
6. **Release gate:** no open critical/high defects; privacy, security, observability, rollback, and test evidence are documented.

## Recommended execution order

Complete items 1–2 first because every later result depends on a trustworthy test runner and schema. Run items 3–6 next to stabilize behavior without external-service noise. Item 7 removes the mock/live split, after which items 8–9 can prove real integrations. Finish with item 10 and the release gates. Do not start production data migration or app-store preparation until all earlier gates pass.

## Deliverables

- Automated unit, component, contract, and Playwright suites.
- Corrected, replayable Supabase migrations and schema assertions.
- Typed mock/live repositories with explicit operating mode.
- Supabase and biometric integration-test evidence.
- Web and Android test reports, screenshots/traces, and defect log.
- Deployment, security/privacy, monitoring, rollback, and release checklists.
