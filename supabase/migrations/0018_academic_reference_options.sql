CREATE TABLE IF NOT EXISTS public.academic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.academic_sessions (name) VALUES ('2023/2024'), ('2024/2025'), ('2025/2026')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read academic sessions" ON public.academic_sessions;
CREATE POLICY "Public can read academic sessions" ON public.academic_sessions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage academic sessions" ON public.academic_sessions;
CREATE POLICY "Admins can manage academic sessions" ON public.academic_sessions FOR ALL TO authenticated
  USING (public.current_profile_role() = 'admin') WITH CHECK (public.current_profile_role() = 'admin');
