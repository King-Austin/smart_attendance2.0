-- ============================================================
-- 0011_auto_expire_30min_sessions.sql
-- Enforce 30-minute max lifetime on attendance sessions in the DB RPC
-- ============================================================

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

  -- Verify course enrollment
  IF NOT (v_session.course_id = ANY(COALESCE(v_profile.course_ids, '{}'::text[]))) THEN
    RAISE EXCEPTION 'You are not enrolled in this course.';
  END IF;

  -- Verify face verification score threshold (minimum 0.60 match)
  IF p_face_score < 0.60 THEN
    -- Record failed attempt
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
      'failed',
      p_face_score,
      NULL,
      p_accuracy,
      to_char(now() AT TIME ZONE 'UTC', 'HH24:MI:SS')
    )
    ON CONFLICT (session_id, student_id) DO NOTHING;

    RAISE EXCEPTION 'Face verification failed: score below threshold.';
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
    ROUND(p_accuracy::numeric, 1),
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
    'success', true,
    'recordedAt', v_recorded_at,
    'distance', ROUND(v_distance::numeric, 1),
    'faceScore', p_face_score
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
