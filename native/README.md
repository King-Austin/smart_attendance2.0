# Smart Campus Presence — React Native

Independent native client in `native/`, based on the reviewed Capacitor location improvements. React Native **0.88.1**, Expo **58.0.22**, NativeWind **4.2.7**. Android and iOS use native screens and a local Kotlin/Swift camera + MediaPipe module. No WebView port or browser liveness fallback.

## Start

```sh
cd native
npm ci
cp .env.example .env
# Fill public Supabase, hosted API and biometric HTTPS endpoints.
npm run prebuild
npm run android
# On macOS with Xcode/CocoaPods:
npm run ios
```

The custom camera module needs a development or release build. Expo Go cannot load it. The public application ID is intentionally `com.smartattendance.mobile`, so test builds can coexist with the Capacitor APK. Configure signing, identifiers and deployment credentials before publishing.

`app.config.ts` is the authoritative configuration. The generated `android/` and `ios/` projects are ignored; `npm run prebuild` recreates them. The local module sources under `modules/smart-face-scanner/` **are** committed, including the same face-landmarker model already used by the repository. NativeWind styling stays local to this package.

Useful commands:

```sh
npm run check             # TypeScript and native policy/parity/report tests
npm run export:android    # Android JS/Hermes bundle, not an APK/native compile
npm run export:ios        # iOS JS/Hermes bundle, not an Xcode build
npm run prebuild          # Generate native host projects
npx eas-cli build --profile preview --platform android
```

## Standalone Android test APK

The `React Native Android APK` GitHub Actions workflow runs on native changes to `feat/react-native-app`. Its `smart-attendance-native-arm64` artifact contains an installable 64-bit Android APK and SHA-256 checksum. It bundles JavaScript and uses the generated Android debug signing key for internal testing; configure your own release signing before distribution. It does not require Metro or Expo Go.

The workflow includes public Supabase and biometric endpoints. Set the repository variable `EXPO_PUBLIC_API_BASE_URL` to the hosted website API when available. Without it, website API operations (email, duplicate-check fallback and administrator account deletion) report missing configuration. Remote push also requires the separate backend/provider setup below. Server secrets must never be included in the workflow or client configuration.

With Java 21 and a configured Android SDK, the equivalent local build is:

```sh
cd native
npm ci
# Configure only public EXPO_PUBLIC_* settings in .env.local.
npx expo prebuild --platform android --no-install
cd android
NODE_ENV=production ./gradlew :app:assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a
# Output: app/build/outputs/apk/release/app-release.apk
```

## Backend compatibility

Use the same Supabase project and hosted web API. Apply repository migrations through **0027_location_reliability.sql** before using the client. Both apps share database authorization, enrollment and attendance RPCs; the native app sends original capture timestamps and does not loosen geofence rules. Full biometric comparison still requires the existing InsightFace server.

The app never embeds Supabase service-role, email-provider, biometric-provider or administrator setup secrets. `EXPO_PUBLIC_*` values are public and cannot protect a secret. All service URLs must use HTTPS. Only public Supabase configuration belongs in `.env`.

For notifications and administrator bootstrap, see [backend/README.md](backend/README.md). They are source additions that require deployment, not pre-existing production endpoints. If no remote push setup is present, realtime session updates and the in-app inbox still operate while the app is connected. The missing legacy `/api/email/session-start` endpoint is reported as unavailable; this client does not pretend it delivered an email.

Email-confirmation settings are respected: if Supabase does not issue a session on signup, confirm the account email, then sign in and finish the profile, guardian details, course enrollment and face enrollment. No confirmation requirement is bypassed.

## Native capabilities

- Foreground precise location with explicit permission checks, settings recovery, original timestamps, 25 m maximum estimated error, 5 s freshness and conservative boundary uncertainty.
- Native CameraX / AVCaptureSession preview with native MediaPipe inference; normalized results feed the existing calibrated challenge state machine. Images stay in temporary app storage and are deleted after processing.
- Camera and location release on backgrounding/route exit. No background location or microphone permission is requested.
- SecureStore-backed chunked authentication storage; profiles are fetched for the authenticated identity rather than trusted from cached JSON.
- Expo push registration, account-scoped inbox, notification navigation and token revocation on sign out.
- Native file generation, PDF creation and share sheet; CSV formula injection and PDF HTML interpolation are escaped.
- Light/dark/system theme, Geist fonts, safe areas, keyboard handling, Android back navigation, pull-to-refresh, offline feedback and paginated large datasets. Searchable option sheets use virtualized lists.

## Screen coverage

The 19 original user-facing routes map to explicit Expo Router files; the admin dashboard retains four sections. See [docs/parity.md](docs/parity.md) for the complete mapping and validation status. This is a source implementation: a route-coverage test does not prove visual or end-to-end device parity.

## Validation boundaries

See [docs/validation.md](docs/validation.md) for actual results and pending checks. Real camera inference, physical-device accuracy, APNs/FCM delivery and an authenticated end-to-end enrollment/attendance run must be verified against staging before production release. Challenge-based movement checks are not a certified anti-spoofing system; the existing client-supplied face-score trust model is unchanged.

The registry in this build environment rejected Expo's recommended newer `@types/react` package. TypeScript **5.9.3** and React typings **19.2.18** are therefore pinned to the installed compatible versions; TypeScript checking passes. Expo dependency diagnostics can still recommend newer development tooling. Runtime dependencies are locked in `package-lock.json`.
