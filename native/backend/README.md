# Native backend additions

Nothing in this directory is deployed automatically. First test against a staging Supabase project using the full repository migration history through 0027.

1. Apply `migrations/0028_native_push.sql` after 0027. It creates account-scoped native push registrations, server-only dispatch claims, and a single-use administrator bootstrap claim.
2. Copy each `functions/<name>/` directory into your Supabase CLI project's `supabase/functions/<name>/` directory. Keep the deployed source synchronized with this directory.
3. Deploy `native-session-push` with JWT verification enabled. It also verifies the JWT, lecturer approval, session ownership and active status before accessing tokens or sending notifications. A session can claim one dispatch only, preventing repeated button requests from spamming recipients.
4. If the institution needs its first administrator, deploy `native-initialize-admin` with gateway JWT verification disabled (`--no-verify-jwt`). The function performs its own setup-secret verification, validates the form, checks that no administrator exists, and atomically claims the single bootstrap slot. Set a high-entropy **server-only** `NATIVE_ADMIN_SETUP_KEY` (at least 20 characters). Give it only to the institution operator. The native initialization form asks for that code; it is never compiled into the app. Do not enable public admin self-signup through untrusted Auth metadata in the underlying project.

Typical deployment from an existing CLI project, after copying the function sources:

```sh
supabase functions deploy native-session-push --project-ref YOUR_STAGING_REF
supabase functions deploy native-initialize-admin --no-verify-jwt --project-ref YOUR_STAGING_REF
# Set server secrets using the Supabase dashboard or a local ignored secrets file.
```

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to functions. If Expo push access-token protection is enabled, configure `EXPO_ACCESS_TOKEN` as a server secret. The mobile app needs its public EAS project ID, plus configured APNs/FCM credentials. On Android set the `GOOGLE_SERVICES_JSON` file path in the build environment; `app.config.ts` consumes it without committing the file. Use EAS-managed signing or the corresponding native platform setup.

A push-provider accepted ticket is not proof that a device displayed the notification. The function removes tokens reported as `DeviceNotRegistered`; production operators should also monitor delivery receipts and dispatch errors. Claims intentionally remain after a partial failure to avoid duplicate delivery. Inspect server records before any manual retry. Session creation succeeds independently of push delivery.

`native_admin_bootstrap` and `native_push_dispatches` are inaccessible to anonymous/authenticated clients. `native_push_tokens` enforces ownership with RLS on reads and writes. Do not grant the native app service-role access.
