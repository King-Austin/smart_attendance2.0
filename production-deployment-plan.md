# Smart Campus Presence Production Deployment Plan

## Goal

Release the one-department MVP safely on Vercel, Supabase, the external biometric service, and Android, with auditable security checks and a tested rollback path.

## Tasks

- [ ] **1. Create a release baseline (owner: engineering):** preserve the current uncommitted work on a release branch, review all deleted/new files, and commit one known release candidate. → **Verify:** clean `git status`, reviewed PR, and immutable release tag.
- [ ] **2. Establish blocking quality gates (owner: engineering):** normalize line endings/formatting, remove remaining lint/type errors, add a `typecheck` script, and add focused tests for authentication, session rules, GPS rejection, biometric failure, and report scoping. → **Verify:** `npm ci`, lint, typecheck, tests, `npm run build`, and `npm run mobile:build` all exit successfully in CI.
- [ ] **3. Provision isolated staging and production environments (owner: platform):** create separate Supabase projects, Vercel environments, biometric API deployments, email credentials, push keys, domains, and Android production variables; keep service-role/API/signing secrets out of client bundles and Git. → **Verify:** an environment matrix identifies every variable, owner, rotation date, and whether it is server-only or public.
- [ ] **4. Prove the database and authorization model (owner: backend/security):** replay migrations `0001`–`0013` on an empty staging database, seed test actors, run a student/lecturer/admin RLS access matrix, validate server-authoritative attendance insertion, and enable backups/PITR before production migration. → **Verify:** clean migration replay, zero unauthorized access cases, backup restore rehearsal, and recorded migration rollback instructions.
- [ ] **5. Harden biometric and privacy operations (owner: backend/security):** host the biometric API near Nigerian users behind TLS and API authentication; define timeouts, rate limits, health checks, retention/deletion rules, encryption, and failure behavior that never records attendance. → **Verify:** duplicate enrollment, wrong face, spoof/liveness failure, outage, slow response, and retry scenarios all produce the expected result without retaining check-in images.
- [ ] **6. Complete staging acceptance tests (owner: QA/product):** exercise student, approved/unapproved lecturer, admin, borrowed-phone, proxy-review, CSV/audit export, guardian email, session expiry, approximate GPS, outside-geofence, and poor-network flows. → **Verify:** signed test report with ledger/database reconciliation and no open critical/high defects.
- [ ] **7. Produce the Android release candidate (owner: mobile):** update `.github/workflows/android-build.yml` from debug-only output to a protected signed AAB/APK workflow, configure production endpoints, and test camera, precise location, liveness speed, notifications, deep links, upgrades, and offline rejection on at least two physical Android versions/devices. → **Verify:** signed artifact installs through Play Internal Testing, passes device acceptance tests, and exposes no secret in the package.
- [ ] **8. Build controlled delivery and observability (owner: platform):** make PR checks mandatory, deploy Vercel previews from PRs, require manual production promotion, add application/biometric health alerts and release dashboards, and document rollback to the prior Vercel deployment, database-compatible app version, biometric image, and Android release. → **Verify:** failed checks block merge, alerts fire in a drill, and rollback is rehearsed in staging.
- [ ] **9. Release and verify (owner: release lead):** announce the window, take/confirm backups, deploy compatible database changes first, then biometric service, Vercel app, and Play internal/closed release; run critical smoke tests and monitor at 5 minutes, 15 minutes, 1 hour, and next day. → **Verify:** registration, login, session creation, verified attendance, live ledger, export, and guardian email succeed; otherwise rollback on service outage, attendance integrity failure, data exposure, or major performance regression.

## Done When

- [ ] All release-readiness criteria in `scope.md` have dated evidence and named approvers.
- [ ] Production uses a signed Android release, not the current debug APK.
- [ ] No attendance path bypasses active session, enrollment, precise GPS, liveness, and face matching except an explicitly approved and audited proxy record.
- [ ] Backups, monitoring, incident contacts, and rollback instructions are tested before launch.

## Decisions Required Before Task 3

- Production biometric hosting provider/region and uptime target.
- Real-campus GPS accuracy threshold after device sampling.
- Exact lecturer proxy-approval workflow.
- Play distribution path for the MVP: internal, closed testing, or public listing.
