# Admin Account Deletion

## Goal
Let administrators permanently remove student or lecturer accounts so the same identity can onboard again safely.

## Tasks
- [x] Add an authenticated admin-only account deletion API that deletes Supabase Auth users.
- [x] Block lecturer deletion while course assignments or attendance sessions remain.
- [x] Add student and lecturer delete actions with typed `DELETE` confirmation.
- [x] Remove deleted people from the dashboard immediately and show actionable errors.
- [x] Delete all current student Auth accounts and verify profiles and face embeddings are gone.
- [x] Run unit, security, lint, type, and production build checks.

## Done When
- [x] Admins can delete eligible student and lecturer accounts; non-admin requests are rejected.
- [x] Deleted students can reuse their email and face during onboarding.
