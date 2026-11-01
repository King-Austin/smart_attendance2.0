-- Location reliability: fresh readings, conservative boundaries, and verified venues.
-- Apply before deploying the matching mobile/web clients. Legacy RPCs are removed
-- intentionally; old clients must update rather than bypass freshness checks.
BEGIN;

CREATE TABLE public.verified_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy double precision NOT NULL CHECK (accuracy BETWEEN 0 AND 25),
  verified_at timestamptz NOT NULL DEFAULT now() CHECK (isfinite(verified_at)),
  verification_note text NOT NULL CHECK (length(btrim(verification_note)) > 0),
  active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.verified_venues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verified_venues FROM anon, authenticated;
GRANT SELECT ON public.verified_venues TO authenticated;
GRANT ALL ON public.verified_venues TO service_role;
CREATE POLICY "Authenticated users can read active verified venues"
  ON public.verified_venues FOR SELECT TO authenticated USING (active);
-- Venue coordinates must be verified and provisioned by a trusted operator;
-- students and lecturers cannot label their own location as a verified venue.

ALTER TABLE public.attendance_sessions
  ADD COLUMN venue_id uuid REFERENCES public.verified_venues(id),
  ADD COLUMN anchor_captured_at timestamptz;
ALTER TABLE public.attendance_records ADD COLUMN location_captured_at timestamptz;

DROP FUNCTION public.create_attendance_session(
  text, text, integer, double precision, double precision, double precision, text, integer
);
DROP FUNCTION public.record_verified_attendance(
  text, double precision, double precision, double precision, double precision
);

CREATE OR REPLACE FUNCTION public.create_attendance_session(
  p_course_id text,
  p_topic text,
  p_radius integer,
  p_anchor_lat double precision,
  p_anchor_lng double precision,
  p_anchor_accuracy double precision,
  p_note text DEFAULT NULL,
  p_enrolled_count integer DEFAULT 0,
  p_venue_id uuid DEFAULT NULL,
  p_anchor_captured_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lecturer record;
  v_created public.attendance_sessions%ROWTYPE;
  v_now timestamptz := now();
  v_session_id text;
  v_active_lecturer uuid;
  v_enrolled_count integer;
  v_venue public.verified_venues%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  SELECT id, role, name, approval_status, course_ids
  INTO v_lecturer
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND OR v_lecturer.role <> 'lecturer' THEN
    RAISE EXCEPTION 'Only lecturers can create attendance sessions.';
  END IF;

  IF v_lecturer.approval_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Your lecturer account must be approved before creating a session.';
  END IF;

  IF NOT (p_course_id = ANY(COALESCE(v_lecturer.course_ids, '{}'::text[]))) THEN
    RAISE EXCEPTION 'You are not assigned to this course.';
  END IF;

  IF NULLIF(btrim(p_topic), '') IS NULL THEN
    RAISE EXCEPTION 'A lecture topic is required.';
  END IF;

  IF p_radius IS NULL OR p_radius NOT BETWEEN 100 AND 250 THEN
    RAISE EXCEPTION 'Session radius must be between 100 and 250 metres.';
  END IF;

  IF p_anchor_lat IS NULL OR p_anchor_lat NOT BETWEEN -90 AND 90
     OR p_anchor_lng IS NULL OR p_anchor_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'The session anchor coordinates are invalid.';
  END IF;

  IF p_anchor_accuracy IS NULL OR p_anchor_accuracy < 0 OR p_anchor_accuracy > 25 THEN
    RAISE EXCEPTION 'Session anchor accuracy must be 25 metres or better.';
  END IF;

  IF p_venue_id IS NOT NULL THEN
    SELECT * INTO v_venue FROM public.verified_venues WHERE id = p_venue_id AND active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The saved venue is no longer available. Select another venue.';
    END IF;
    -- Use authoritative coordinates, not a client's copy of the venue record.
    p_anchor_lat := v_venue.lat;
    p_anchor_lng := v_venue.lng;
    p_anchor_accuracy := v_venue.accuracy;
  ELSIF p_anchor_captured_at IS NULL OR NOT isfinite(p_anchor_captured_at)
     OR p_anchor_captured_at < clock_timestamp() - interval '5 minutes'
     OR p_anchor_captured_at > clock_timestamp() + interval '2 seconds' THEN
    RAISE EXCEPTION 'Capture a fresh venue anchor before creating the session.';
  END IF;

  -- Serialize creation per course. Concurrent sessions for unrelated courses
  -- do not contend and are never closed by this function.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_course_id, 0));

  SELECT lecturer_id
  INTO v_active_lecturer
  FROM public.attendance_sessions
  WHERE course_id = p_course_id
    AND status = 'active'
  FOR UPDATE;

  IF FOUND AND v_active_lecturer IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Another lecturer already has an active session for this course.';
  END IF;

  UPDATE public.attendance_sessions
  SET status = 'ended',
      end_time = to_char(v_now AT TIME ZONE 'UTC', 'HH24:MI')
  WHERE course_id = p_course_id
    AND lecturer_id = v_uid
    AND status = 'active';

  SELECT count(*)::integer
  INTO v_enrolled_count
  FROM public.profiles
  WHERE role = 'student'
    AND p_course_id = ANY(COALESCE(course_ids, '{}'::text[]));

  v_session_id := 'SES-' || to_char(v_now, 'YYYY') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.attendance_sessions (
    id,
    course_id,
    topic,
    lecturer_name,
    lecturer_id,
    start_time,
    radius,
    status,
    anchor_lat,
    anchor_lng,
    anchor_accuracy,
    venue_id,
    anchor_captured_at,
    note,
    enrolled_count,
    date
  ) VALUES (
    v_session_id,
    p_course_id,
    btrim(p_topic),
    v_lecturer.name,
    v_uid,
    to_char(v_now AT TIME ZONE 'UTC', 'HH24:MI'),
    p_radius,
    'active',
    p_anchor_lat,
    p_anchor_lng,
    p_anchor_accuracy,
    p_venue_id,
    CASE WHEN p_venue_id IS NULL THEN p_anchor_captured_at ELSE v_venue.verified_at END,
    NULLIF(btrim(p_note), ''),
    v_enrolled_count,
    to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  )
  RETURNING * INTO v_created;

  RETURN to_jsonb(v_created);
END;
$$;

REVOKE ALL ON FUNCTION public.create_attendance_session(
  text, text, integer, double precision, double precision, double precision, text, integer, uuid, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_attendance_session(
  text, text, integer, double precision, double precision, double precision, text, integer, uuid, timestamptz
) TO authenticated;


CREATE OR REPLACE FUNCTION public.record_verified_attendance(
  p_session_id text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision,
  p_face_score double precision,
  p_location_captured_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile record;
  v_session record;
  v_distance double precision;
  v_recorded_at text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  SELECT id, name, reg_number, role, course_ids, face_enrolled, face_vector
  INTO v_profile
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_profile.role <> 'student' THEN
    RAISE EXCEPTION 'Only students can mark attendance.';
  END IF;

  IF NOT COALESCE(v_profile.face_enrolled, false) OR v_profile.face_vector IS NULL THEN
    RAISE EXCEPTION 'Complete face enrollment before marking attendance.';
  END IF;

  SELECT id, course_id, topic, date, status, radius, anchor_lat, anchor_lng,
         anchor_accuracy, created_at
  INTO v_session
  FROM public.attendance_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session does not exist.';
  END IF;

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'This session is no longer active.';
  END IF;

  IF v_session.created_at IS NULL OR now() - v_session.created_at > interval '30 minutes' THEN
    UPDATE public.attendance_sessions
    SET status = 'ended',
        end_time = to_char(COALESCE(v_session.created_at, now()) + interval '30 minutes', 'HH24:MI')
    WHERE id = p_session_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This attendance session has expired (30-minute maximum duration).'
    );
  END IF;

  IF NOT (v_session.course_id = ANY(COALESCE(v_profile.course_ids, '{}'::text[]))) THEN
    RAISE EXCEPTION 'You are not enrolled in this course.';
  END IF;

  IF p_face_score IS NULL OR p_face_score < 0.60 OR p_face_score > 1 THEN
    RAISE EXCEPTION 'Biometric verification failed: invalid face score.';
  END IF;

  IF p_location_captured_at IS NULL OR NOT isfinite(p_location_captured_at)
     OR p_location_captured_at < clock_timestamp() - interval '5 seconds'
     OR p_location_captured_at > clock_timestamp() + interval '2 seconds' THEN
    RAISE EXCEPTION 'A fresh location is required. Retry location verification.';
  END IF;

  IF p_accuracy IS NULL OR p_accuracy < 0 OR p_accuracy > 25 THEN
    RAISE EXCEPTION 'GPS accuracy must be 25 metres or better.';
  END IF;

  IF v_session.anchor_accuracy IS NULL OR v_session.anchor_accuracy > 25 THEN
    RAISE EXCEPTION 'This session has an imprecise venue anchor. Ask the lecturer to recreate it.';
  END IF;

  IF p_lat IS NULL OR p_lat NOT BETWEEN -90 AND 90
     OR p_lng IS NULL OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'The submitted GPS coordinates are invalid.';
  END IF;

  v_distance := public.calculate_haversine_distance(
    v_session.anchor_lat,
    v_session.anchor_lng,
    p_lat,
    p_lng
  );

  IF v_distance IS NULL OR v_distance = 'NaN'::double precision THEN
    RAISE EXCEPTION 'The submitted GPS coordinates are invalid.';
  END IF;

  IF v_distance - (p_accuracy + v_session.anchor_accuracy) > v_session.radius THEN
    RAISE EXCEPTION 'Geofence check failed: You are % metres away (allowed: %m).',
      round(v_distance::numeric, 1), round(v_session.radius::numeric, 1);
  END IF;

  IF v_distance + p_accuracy + v_session.anchor_accuracy > v_session.radius THEN
    RAISE EXCEPTION 'Location is uncertain near the venue boundary. Move further inside and retry.';
  END IF;

  v_recorded_at := to_char(now() AT TIME ZONE 'UTC', 'HH24:MI:SS');

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
    location_captured_at,
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
    p_location_captured_at,
    v_recorded_at
  )
  ON CONFLICT (session_id, student_id) DO UPDATE SET
    status = 'verified',
    face_score = EXCLUDED.face_score,
    distance = EXCLUDED.distance,
    gps_accuracy = EXCLUDED.gps_accuracy,
    location_captured_at = EXCLUDED.location_captured_at,
    verified_at = EXCLUDED.verified_at;

  RETURN jsonb_build_object(
    'success', true,
    'recordedAt', v_recorded_at,
    'distance', round(v_distance::numeric, 2),
    'faceScore', p_face_score
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_verified_attendance(
  text, double precision, double precision, double precision, double precision, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_verified_attendance(
  text, double precision, double precision, double precision, double precision, timestamptz
) TO authenticated;

COMMIT;
