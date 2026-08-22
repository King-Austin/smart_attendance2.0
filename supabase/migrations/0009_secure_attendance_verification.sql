-- ============================================================
-- 0009_secure_attendance_verification.sql
-- Security Hardening:
-- 1. Revoke client-side direct INSERT on attendance_records.
-- 2. Protect profiles security fields (role, approval_status, staff_id).
-- 3. Implement server-authoritative attendance verification RPC.
-- 4. Secure duplicate face search with exclusion support.
-- ============================================================

-- ------------------------------------------------------------
-- 1. RLS HARDENING ON ATTENDANCE RECORDS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students can create their own records" ON public.attendance_records;

-- Only service-role or security definer RPCs can insert verified attendance records.
-- Students maintain read access to their own records.
-- Lecturers and admins maintain read access to course/session records.

-- ------------------------------------------------------------
-- 2. PROFILE SECURITY FIELD PROTECTION
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS TRIGGER AS $$
DECLARE
  caller_role text;
BEGIN
  caller_role := public.current_profile_role();

  -- Admins can update any field
  IF caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Non-admins cannot alter their role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: Cannot change user role.';
  END IF;

  -- Non-admins cannot alter their approval status
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    RAISE EXCEPTION 'Unauthorized: Cannot alter approval status.';
  END IF;

  -- Non-admins cannot alter their staff_id once set
  IF OLD.staff_id IS NOT NULL AND NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot alter staff ID.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_security ON public.profiles;
CREATE TRIGGER trg_protect_profile_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_security_fields();

-- ------------------------------------------------------------
-- 3. HAVERSINE DISTANCE HELPER FUNCTION
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_haversine_distance(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision AS $$
DECLARE
  r double precision := 6371000; -- Earth radius in meters
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat / 2.0)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0)^2;
  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ------------------------------------------------------------
-- 4. SERVER-AUTHORITATIVE ATTENDANCE VERIFICATION RPC
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_verified_attendance(
  p_session_id text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision,
  p_face_score double precision
)
RETURNS jsonb AS $$
DECLARE
  v_uid uuid;
  v_profile record;
  v_session record;
  v_distance double precision;
  v_recorded_at text;
  v_max_radius double precision;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  -- Fetch user profile
  SELECT id, name, reg_number, role, course_ids
  INTO v_profile
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.role != 'student' THEN
    RAISE EXCEPTION 'Only students can mark attendance.';
  END IF;

  -- Fetch active session
  SELECT id, course_id, topic, date, status, radius, anchor_lat, anchor_lng, anchor_accuracy
  INTO v_session
  FROM public.attendance_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session does not exist.';
  END IF;

  IF v_session.status != 'active' THEN
    RAISE EXCEPTION 'This session is no longer active.';
  END IF;

  -- Verify course enrollment
  IF NOT (v_session.course_id = ANY(COALESCE(v_profile.course_ids, '{}'::text[]))) THEN
    RAISE EXCEPTION 'You are not enrolled in this course.';
  END IF;

  -- Verify face verification score threshold (minimum 0.60 match)
  IF p_face_score < 0.60 THEN
    RAISE EXCEPTION 'Biometric verification failed: face score too low (%).', round(p_face_score::numeric, 2);
  END IF;

  -- Calculate server-authoritative geofence distance
  v_distance := public.calculate_haversine_distance(
    v_session.anchor_lat,
    v_session.anchor_lng,
    p_lat,
    p_lng
  );

  v_max_radius := v_session.radius;
  -- If GPS accuracy is reported, ensure it's reasonable (max 100m error margin)
  IF p_accuracy > 100 THEN
    RAISE EXCEPTION 'GPS accuracy is too low (%m). Please get a clearer satellite fix.', round(p_accuracy::numeric, 0);
  END IF;

  -- Enforce geofence boundary check
  IF v_distance > v_max_radius THEN
    RAISE EXCEPTION 'You are outside the lecture hall geofence (%m away, max %m).', round(v_distance::numeric, 1), round(v_max_radius::numeric, 0);
  END IF;

  v_recorded_at := to_char(now(), 'HH24:MI:SS');

  -- Insert or update verified attendance record
  INSERT INTO public.attendance_records (
    session_id,
    course_id,
    student_id,
    student_name,
    reg_number,
    date,
    topic,
    status,
    face_score,
    distance,
    gps_accuracy,
    verified_at
  ) VALUES (
    v_session.id,
    v_session.course_id,
    v_uid,
    v_profile.name,
    v_profile.reg_number,
    v_session.date,
    v_session.topic,
    'verified',
    p_face_score,
    round(v_distance::numeric, 2),
    round(p_accuracy::numeric, 2),
    v_recorded_at
  )
  ON CONFLICT (session_id, student_id) DO UPDATE SET
    status = 'verified',
    face_score = excluded.face_score,
    distance = excluded.distance,
    gps_accuracy = excluded.gps_accuracy,
    verified_at = excluded.verified_at;

  RETURN jsonb_build_object(
    'success', true,
    'recordedAt', v_recorded_at,
    'distance', round(v_distance::numeric, 2),
    'faceScore', p_face_score
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_verified_attendance(text, double precision, double precision, double precision, double precision) TO authenticated;

-- ------------------------------------------------------------
-- 5. DUPLICATE FACE SEARCH WITH EXCLUSION SUPPORT
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_duplicate_face(
  p_vector vector,
  p_threshold double precision DEFAULT 0.65,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS TABLE (duplicate boolean, similarity double precision, match_id uuid, match_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      (1 - (p.face_vector <=> p_vector)) > p_threshold AS duplicate,
      1 - (p.face_vector <=> p_vector) AS similarity,
      p.id AS match_id,
      p.name AS match_name
    FROM public.profiles p
    WHERE p.face_vector IS NOT NULL
      AND p.face_enrolled = true
      AND (p_exclude_id IS NULL OR p.id != p_exclude_id)
    ORDER BY p.face_vector <=> p_vector
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.check_duplicate_face(vector, double precision, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_duplicate_face(vector, double precision, uuid) TO service_role;
