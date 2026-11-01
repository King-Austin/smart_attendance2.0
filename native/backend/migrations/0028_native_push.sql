-- Apply after the repository's existing migrations. No service keys belong in the app.
BEGIN;
CREATE TABLE IF NOT EXISTS public.native_push_tokens (
 token text PRIMARY KEY CHECK (length(token) BETWEEN 20 AND 256),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 platform text NOT NULL CHECK (platform IN ('android','ios')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.native_push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.native_push_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.native_push_tokens TO authenticated;
GRANT ALL ON public.native_push_tokens TO service_role;
CREATE POLICY "Users own their native push registrations" ON public.native_push_tokens
 FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE TABLE IF NOT EXISTS public.native_push_dispatches (
 session_id text PRIMARY KEY REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 sent_count integer NOT NULL DEFAULT 0
);
ALTER TABLE public.native_push_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.native_push_dispatches FROM anon,authenticated;
GRANT ALL ON public.native_push_dispatches TO service_role;

-- Single-use claim for administrator bootstrap. Only the server function can access it.
CREATE TABLE IF NOT EXISTS public.native_admin_bootstrap (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 claimed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.native_admin_bootstrap ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.native_admin_bootstrap FROM anon,authenticated;
GRANT ALL ON public.native_admin_bootstrap TO service_role;

COMMIT;
