# UNIZIK Presence — Confirmed V1 Product Specification

## Scope

- Institution: Nnamdi Azikiwe University (UNIZIK), Awka.
- Initial organization scope: multiple departments within one faculty.
- Platforms: Android first, with architecture and configuration kept iOS-ready.
- Mobile roles: student, lecturer, and faculty admin.
- Backend: existing Supabase project plus the external biometric API.

## Identity and access

- Students self-register and enrol their face during registration.
- Lecturer self-registration creates a pending account; an admin must approve it.
- An approved lecturer may select courses from their approved department immediately.
- Multiple lecturers may select the same course and receive equal course-level access.
- Students may select only courses matching their department, level, and semester.
- Students may replace their enrolled face only after another duplicate-face check.

## Attendance

- Every normal check-in requires precise GPS and live-face verification.
- University-wide session radius is fixed at 150 metres.
- Active eligible sessions appear automatically to students.
- A session remains open until its creator ends it manually.
- A student without a phone may sign into their own account on another device and verify their own live face.
- Offline attendance is not accepted or queued.
- Final location, face match, enrolment, attendance writes, and challenge consumption are server-owned; Google ML Kit measures liveness movements locally for low latency.

## Corrections and audit

- Only the session creator or an admin may correct an attendance record.
- Every correction requires a meaningful reason.
- The previous status, new status, actor, session, reason, and timestamp remain in an immutable audit table.

## Admin

- Approve or reject lecturer accounts.
- Create faculties, departments, and courses through native forms.
- View faculty attendance summaries and session ledgers.
- Correct disputed attendance under the audit policy.

## Notifications

- New attendance session opened.
- Attendance verification succeeded or failed.
- Lecturer account approved.

## Reports

- Student attendance history.
- Course attendance summary.
- Per-session attendance ledger.
- CSV/Excel export.
