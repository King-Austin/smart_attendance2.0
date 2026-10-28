CREATE TABLE IF NOT EXISTS public.guardian_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id text REFERENCES public.courses(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('registration_confirmation', 'consecutive_absence')),
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_message_id text,
  failure_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS guardian_registration_email_once_idx
  ON public.guardian_email_events(student_id) WHERE event_type = 'registration_confirmation' AND status = 'sent';
CREATE INDEX IF NOT EXISTS guardian_email_events_lookup_idx
  ON public.guardian_email_events(student_id, course_id, event_type, created_at DESC);
ALTER TABLE public.guardian_email_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guardian_email_events FROM anon, authenticated;
