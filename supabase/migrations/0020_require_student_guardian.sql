-- Auth creates an intentionally incomplete profile first. Require guardian
-- details before the student can enroll a face or attach any courses.
CREATE OR REPLACE FUNCTION public.require_student_guardian_details()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'student'
     AND (NEW.face_enrolled OR cardinality(COALESCE(NEW.course_ids, '{}'::text[])) > 0)
     AND (
       NULLIF(btrim(NEW.guardian_name), '') IS NULL
       OR NULLIF(btrim(NEW.guardian_phone), '') IS NULL
       OR NULLIF(btrim(NEW.guardian_email), '') IS NULL
       OR NEW.guardian_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     ) THEN
    RAISE EXCEPTION 'Guardian name, phone number, and a valid email are required before student enrollment can be completed.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_student_guardian_details ON public.profiles;
CREATE TRIGGER trg_require_student_guardian_details
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.require_student_guardian_details();
