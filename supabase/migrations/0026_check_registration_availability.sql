-- ============================================================
-- 0026_check_registration_availability.sql
-- Provides an early validation RPC for student and lecturer registration.
-- Returns boolean flags without leaking student/lecturer identities or PII.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_registration_availability(
  p_email text DEFAULT NULL,
  p_reg_number text DEFAULT NULL,
  p_staff_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_taken boolean := false;
  v_reg_number_taken boolean := false;
  v_staff_id_taken boolean := false;
  v_clean_email text;
  v_clean_reg text;
  v_clean_staff text;
BEGIN
  v_clean_email := lower(trim(coalesce(p_email, '')));
  v_clean_reg := lower(trim(coalesce(p_reg_number, '')));
  v_clean_staff := lower(trim(coalesce(p_staff_id, '')));

  IF v_clean_email <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE lower(trim(email)) = v_clean_email
    ) INTO v_email_taken;
  END IF;

  IF v_clean_reg <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE lower(trim(coalesce(reg_number, ''))) = v_clean_reg
    ) INTO v_reg_number_taken;
  END IF;

  IF v_clean_staff <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE lower(trim(coalesce(staff_id, ''))) = v_clean_staff
    ) INTO v_staff_id_taken;
  END IF;

  RETURN jsonb_build_object(
    'email_taken', v_email_taken,
    'reg_number_taken', v_reg_number_taken,
    'staff_id_taken', v_staff_id_taken
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_registration_availability(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_registration_availability(text, text, text) TO anon, authenticated, service_role;

