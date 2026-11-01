# Validation record

## Passed in this implementation environment

- Native TypeScript checking.
- 26 native tests covering all 19 route entries, canonical location/liveness policy alignment, uncertainty/staleness/accuracy decisions, liveness quality and hold/timeout behaviour, report escaping/formula protection, Unicode secure-session encoding, push ownership policy presence, and inbox hydration/redelivery/date/corruption regressions.
- Android and iOS Metro/Hermes production exports. These compile/package JavaScript and assets; they are not native platform builds.
- Android Expo prebuild.
- Local Expo module discovery for Android and Apple platforms, including `SmartFaceScannerModule`.
- Native push migration execution in local PostgreSQL/PGlite, including account-token isolation, denied client access to dispatch/bootstrap tables, and singleton bootstrap claims. This used the minimal schema fixtures from the existing location regression, not a live project.
- Existing web regression suite: 41 unit tests and 11 security checks.
- Lint of native application/test sources: no errors. Context/hook exports retain Fast Refresh warnings.

## Android APK build attempts (2026-11-01)

- Resolved the original upstream ktfmt plugin dependency and installed Android SDK/NDK/build tools.
- Fixed the application ID from `com.smartattendance.native` to `com.smartattendance.mobile`: Java reserves the word `native`, so the original namespace cannot compile.
- Android prebuild and native TypeScript + 16 tests pass after the fix.
- Attempted `:app:assembleRelease` for `arm64-v8a` with bundled production JavaScript. The executor terminated network access to `repo.maven.apache.org` under its network policy before native compilation completed.
- Retried with `--offline`. The cache is incomplete: `org.jetbrains.kotlin:kotlin-compiler-embeddable:2.2.10` is missing. No APK was produced.
- Added `.github/workflows/native-android.yml` and triggered run [41267568401](https://github.com/King-Austin/smart_attendance2.0/actions/runs/41267568401). GitHub refused to start the job: “The job was not started because your account is locked due to a billing issue.” The run has no artifact.
- Public Supabase configuration supplied for this build was checked against `/auth/v1/settings` (HTTP 200). Public biometric configuration is included; the hosted website API URL remains unset at the user's request. No supplied server credentials were stored in the repository or client.

Restore GitHub Actions account billing and rerun the failed job, or build on a host with permitted dependency access using the README instructions. The workflow creates an internal-test APK signed with the generated debug key; configure owned production signing separately.

Kotlin/Swift compilation and physical-device behavior remain unverified. A macOS/Xcode host is required for Swift/CocoaPods compilation. MediaPipe dependency compatibility, camera mirroring/rotation, transformation matrix convention and challenge direction must be validated on Android and iOS devices.

## Notification and launch updates (2026-11-01)

- Root launch waits for authentication restoration, redirects an authenticated profile to its role dashboard, and renders the landing page for guests. Existing deep-link routes are retained.
- Shared accessible bottom sheets replace full-page notifications and option popovers. The inbox includes All/Unread filters, counts, grouped dates, read-all, clear confirmation, loading/empty/error states, and session actions.
- Inbox writes are serialized; hydration merges live arrivals; duplicate push/realtime session alerts preserve read state. Cold-start notification responses are consumed after opening.
- TypeScript, 26 tests, targeted lint (no errors; one existing Fast Refresh hook-export warning), and Android Metro/Hermes production export passed. Native APK compilation and physical-device visual/interaction checks remain blocked as recorded above.

## Device/staging checks still required

1. Install a development build on the affected Android phone and other representative devices. Build iOS on macOS and test on a physical iPhone.
2. Configure staging public endpoints and the biometric server; apply the full database history through 0027. Deploy optional native backend additions and push credentials.
3. Run real student and lecturer registration, email confirmation if enabled, existing-account login, sign out/in as another role, and password changes.
4. Enroll and reenroll a face; test duplicate enrollment, denied camera access, no/multiple faces, poor lighting, challenge timeout, successful challenge, and cancellation/backgrounding. Compare captured images and turn directions against the web reference.
5. Test fresh, cold-start, indoor, approximate-only, disabled-location, near-boundary and outside-geofence outcomes. Move during face processing and confirm that submission rechecks the venue.
6. Open/end/expire sessions and verify two-device realtime check-ins. Confirm no check-in succeeds after server rejection or while offline.
7. Exercise every administrator section, batch course creation, faculty/department creation, teaching assignments, approval/rejection and confirmed account deletion using disposable staging records.
8. Export actual attendance as CSV and PDF, inspect names/units/timestamps and share with another app.
9. Verify notification delivery, foreground inbox, cold-start taps, notification preference and token revocation on logout. Monitor provider receipts separately from accepted tickets.
10. Compare each screen against the current mobile web design in both themes, at small/large font scales, with keyboard open, safe-area variations and Android back navigation.

No live Supabase migration, function deployment, credential provisioning, store submission or production deployment was performed.
