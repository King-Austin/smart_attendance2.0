# Validation record

## Passed in this implementation environment

- Native TypeScript checking.
- 16 native tests covering all 19 route entries, canonical location/liveness policy alignment, uncertainty/staleness/accuracy decisions, liveness quality and hold/timeout behaviour, report escaping/formula protection, Unicode secure-session encoding, and push ownership policy presence.
- Android and iOS Metro/Hermes production exports. These compile/package JavaScript and assets; they are not native platform builds.
- Android Expo prebuild.
- Local Expo module discovery for Android and Apple platforms, including `SmartFaceScannerModule`.
- Native push migration execution in local PostgreSQL/PGlite, including account-token isolation, denied client access to dispatch/bootstrap tables, and singleton bootstrap claims. This used the minimal schema fixtures from the existing location regression, not a live project.
- Existing web regression suite: 41 unit tests and 11 security checks.
- Lint of native application/test sources: no errors. Context/hook exports retain Fast Refresh warnings.

## Native build blocker

A Gradle compile of `:smart-face-scanner:compileDebugKotlin` was attempted. The Gradle distribution was obtained, but the build stopped in the upstream React Native Gradle plugin before compiling application/module sources: `com.ncorti.ktfmt.gradle:0.22.0` could not be resolved from the configured plugin repositories. No APK was produced and no Kotlin compile success is claimed. There is no configured Android SDK/emulator in this environment. A macOS/Xcode host is also required for Swift/CocoaPods compilation.

Do not confuse successful prebuild, autolinking or Hermes exports with successful Kotlin/Swift compilation. The local module source must pass real native builds before release. MediaPipe dependency compatibility, camera mirroring/rotation, transformation matrix convention and challenge direction must be validated on Android and iOS devices.

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
