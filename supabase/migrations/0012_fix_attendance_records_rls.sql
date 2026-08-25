-- ============================================================
-- 0012_fix_attendance_records_rls.sql
-- Fix RLS policies on attendance_records and ensure record_verified_attendance is SECURITY DEFINER
-- ============================================================

-- 1. Ensure authenticated students can insert/upsert their own attendance records
DROP POLICY IF EXISTS "Students can insert their own records" ON public.attendance_records;
CREATE POLICY "Students can insert their own records"
  ON public.attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update their own records" ON public.attendance_records;
CREATE POLICY "Students can update their own records"
  ON public.attendance_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can view their own records" ON public.attendance_records;
CREATE POLICY "Students can view their own records"
  ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

-- 2. Ensure lecturers can manage attendance for their sessions
DROP POLICY IF EXISTS "Lecturers can manage attendance" ON public.attendance_records;
CREATE POLICY "Lecturers can manage attendance"
  ON public.attendance_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('lecturer', 'admin')
    )
  );

-- 3. Upgrade record_verified_attendance with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.record_verified_attendance(
  p_session_id text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision,
  p_face_score double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
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
  SELECT id, course_id, topic, date, status, radius, anchor_lat, anchor_lng, anchor_accuracy, created_at
  INTO v_session
  FROM public.attendance_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session does not exist.';
  END IF;

  IF v_session.status != 'active' THEN
    RAISE EXCEPTION 'This session is no longer active.';
  END IF;

  -- Enforce 30-minute max expiration
  IF v_session.created_at IS NOT NULL AND (now() - v_session.created_at) > interval '30 minutes' THEN
    UPDATE public.attendance_sessions
    SET status = 'ended',
        end_time = to_char(v_session.created_at + interval '30 minutes', 'HH24:MI')
    WHERE id = p_session_id;
    RAISE EXCEPTION 'This attendance session has expired (30-minute maximum duration).';
  END IF;

  -- Verify course enrollment (allow if course_ids contains course_id or course_ids is empty/unrestricted)
  IF v_profile.course_ids IS NOT NULL AND array_length(v_profile.course_ids, 1) > 0 THEN
    IF NOT (v_session.course_id = ANY(v_profile.course_ids)) THEN
      RAISE EXCEPTION 'You are not enrolled in this course.';
    END IF;
  END IF;

  -- Compute Haversine distance from anchor
  v_distance := public.haversine_distance_meters(
    p_lat,
    p_lng,
    v_session.anchor_lat,
    v_session.anchor_lng
  );

  -- Geofence tolerance: radius + anchor_accuracy + device_accuracy (max 50m buffer)
  v_max_radius := v_session.radius + LEAST(50.0, COALESCE(v_session.anchor_accuracy, 15.0) + COALESCE(p_accuracy, 15.0));

  IF v_distance > v_max_radius THEN
    RAISE EXCEPTION 'Geofence check failed: You are % meters away (allowed: %m).', ROUND(v_distance::numeric, 1), ROUND(v_max_radius::numeric, 1);
  END IF;

  v_recorded_at := to_char(now() AT TIME ZONE 'UTC', 'HH24:MI:SS');

  -- Upsert verified attendance record
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
    p_session_id,
    v_session.course_id,
    v_uid,
    v_profile.name,
    v_profile.reg_number,
    v_session.date,
    v_session.topic,
    'verified',
    p_face_score,
    ROUND(v_distance::numeric, 1),
    p_accuracy,
    v_recorded_at
  )
  ON CONFLICT (session_id, student_id)
  DO UPDATE SET
    status = 'verified',
    face_score = EXCLUDED.face_score,
    distance = EXCLUDED.distance,
    gps_accuracy = EXCLUDED.gps_accuracy,
    verified_at = EXCLUDED.verified_at;

  RETURN jsonb_build_object(
    'ok', true,
    'recordedAt', v_recorded_at,
    'distance', ROUND(v_distance::numeric, 1),
    'faceScore', p_face_score
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_verified_attendance(text, double precision, double precision, double precision, double precision) TO authenticated;
