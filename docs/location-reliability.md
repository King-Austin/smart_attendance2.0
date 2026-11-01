# Capacitor location reliability

## Behaviour

Attendance starts foreground acquisition after the permission gate is satisfied. Android requests high accuracy with an explicit 2-second desired/minimum update interval and a 30-second overall deadline. Updates are platform hints, not delivery guarantees. `VITE_GPS_ACQUISITION_TIMEOUT_MS` can tune the deadline from 10–60 seconds. The former sample-count settings are no longer used.

A recent cached location can appear immediately as a preview. Acceptance requires valid coordinates, a capture timestamp no more than 5 seconds old (at most 2 seconds ahead for clock skew), and estimated accuracy no worse than 25 metres. Environment accuracy settings can tighten that ceiling, never loosen it. Fractional accuracy and timestamps are retained; duplicate timestamps and out-of-order fixes do not replace newer evidence. There is no compulsory five-callback wait.

The client and database compare distance with the sum of student and anchor accuracy estimates:

- Inside: `distance + studentAccuracy + anchorAccuracy <= radius`.
- Clearly outside: `distance - studentAccuracy - anchorAccuracy > radius`.
- Otherwise uncertain: continue acquisition until the deadline, then explain how to retry. An uncertain reading is never accepted by widening the radius.

Reported accuracy is an estimate, not a guaranteed error bound. These checks do not establish room/floor identity or prevent a modified client from fabricating coordinates, timestamps, or face scores. The existing biometric trust model is unchanged. Strong anti-spoofing/proximity verification is a separate feature.

Facial verification still starts after the initial venue check. A second fresh acquisition runs immediately before the attendance RPC, so completing a long face scan cannot submit the old location. Coordinates are not retained in an application-wide preview cache.

The app clears watches on completion, cancellation, route exit, or backgrounding, including a native watch ID returned after cancellation. Capacitor's one-shot position call has no cancellation API: late results are ignored and its own timeout is bounded. No background tracking or foreground service was added. Returning from Settings rechecks permissions; returning to attendance restarts acquisition. Login no longer requests camera/location permissions.

## Database rollout

Apply `supabase/migrations/0027_location_reliability.sql` to a staging database first, validate the matching app there, then schedule a coordinated production rollout. This branch does **not** apply migrations to any remote project.

The migration removes the old attendance and session-creation RPC signatures deliberately. Older app versions cannot keep submitting without a location timestamp. Update/rebuild the mobile client and web deployment alongside the database change; plan for older installed APKs to require an update. No fallback bypasses the new checks.

Freshness is checked again using the server clock after acquiring the session row lock. Slow networks or incorrect device clocks can therefore produce a retry even after successful client verification. Measure that rate before changing policy; never invent a new timestamp for an old fix.

Session anchors captured on the lecturer's phone expire for creation after five minutes. Their capture time is stored. Saved verified venues use their original verification time instead and are not treated as live phone fixes. Existing session anchors retain their current values; this migration does not relabel old anchors as verified venues.

## Saved classrooms

Lecturers can choose from `verified_venues` or capture a fresh temporary venue location. A trusted database operator must first verify and provision real classroom coordinates. There are no demo coordinates seeded and no lecturer/student write access to the catalog. This branch includes the selector and read service, not an administrator venue-management screen.

Using a trusted SQL console, insert the actual surveyed/verified values:

```sql
INSERT INTO public.verified_venues
  (name, lat, lng, accuracy, verification_note)
VALUES
  (:venue_name, :latitude, :longitude, :estimated_accuracy_metres, :verification_method);
```

The placeholders must be replaced/bound to real verified values. Accuracy must be 0–25 metres; do not use zero to represent unknown accuracy. Deactivate a venue with `UPDATE public.verified_venues SET active = false WHERE id = :venue_id`. The creation RPC reads authoritative catalog coordinates and rejects inactive/missing venues, regardless of the client's copy. Active sessions keep their captured anchor snapshot if the catalog changes later.

## Diagnostics

Listen temporarily during a development/device test:

```js
window.addEventListener("scp:location-diagnostic", (event) => console.info(event.detail));
```

Events include first-fix time, total duration, distinct sample count, estimated accuracy, reading age, final decision, and native error code. They exclude coordinates, session identifiers and user identities. The branch adds no remote telemetry collector. Keep test exports free of precise coordinates and personal identifiers.

## Verification

Automated checks:

```sh
npm run test:unit
npm run test:security
npx tsc --noEmit
npm run mobile:build
```

Run the SQL regression in a **disposable empty PostgreSQL database**, never production:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/location-database.sql
```

The SQL fixture tests the real migration/RPCs, stale/future readings, fractional accuracy, invalid coordinates, face threshold, boundary ambiguity, outside rejection, trusted venue overrides, inactive venue rejection, RLS and removal of the old RPC. It uses minimal schema fixtures; a staging run against the complete project's migration history is still required.

### Physical-phone test matrix — pending

Use the affected phone and at least two other available Android models. Record each device model/Android version, test condition, first-fix milliseconds, accepted-fix milliseconds, estimated accuracy, reading age, outcome, and native code. Do not record student identities or coordinates in the comparison sheet.

| Scenario                                      | Expected result                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Outdoor, precise access, location enabled     | Fresh suitable fix completes without waiting for five samples                             |
| Indoor classroom                              | Accept a sufficiently accurate inside fix, otherwise explain uncertainty/accuracy failure |
| Cold start / no cached location               | Progress immediately; bounded acquisition and actionable timeout                          |
| Approximate-only permission                   | Explain Precise location requirement; open app settings                                   |
| Location switched off                         | Explain disabled device location; open location settings                                  |
| Permission denied or revoked                  | Gate attendance; no repeated automatic permission prompts                                 |
| Return from Settings                          | Refresh actual permission/services state and restart acquisition when allowed             |
| Near boundary / clearly outside               | Retry uncertainty; never accept outside the conservative boundary                         |
| Leave screen or background during acquisition | Watch cleared; late result cannot update the abandoned run                                |
| Slow face scan / movement during scan         | Fresh venue verification before the write                                                 |
| Weak network / device clock skew              | Server rejects stale/future evidence with a retry message                                 |
| Verified venue versus fresh lecturer anchor   | Catalog coordinates used server-side; imprecise/stale temporary anchors rejected          |

Compare pre-change and post-change median/p95 time to first fix, time to accepted fix, success rate, false rejections from known inside test positions, and error distribution. No performance improvement is claimed until those runs exist.

## Native plugin decision

A custom Android plugin is deferred pending the physical-device results. The installed Capacitor geolocation plugin already exposes update cadence, recent-fix allowance and native errors, and its Android dependency includes Google Play services location. Adding a second native implementation before measuring the corrected flow would add maintenance without a demonstrated benefit. Keep `locationService` as the adapter boundary if direct fused-provider control becomes necessary.

## Implementation validation

At implementation time: 41 unit tests and 11 security checks passed; the project TypeScript check passed; lint of changed TypeScript files had no errors (the existing `useAuth` Fast Refresh export warnings remain). Web production build, mobile SPA build and Capacitor Android sync passed. The SQL regression above also passed using local PGlite/PostgreSQL with the minimal fixtures.

The mobile prerender preview binds to loopback explicitly so building does not depend on enumerating network interfaces. One pre-existing React test global was given an explicit type to allow project-wide TypeScript checking.

An Android APK/native Gradle build, full staging migration rollout, real biometric-to-database device flow, and the physical-phone matrix have not been verified here. No live migration or deployment was performed.
