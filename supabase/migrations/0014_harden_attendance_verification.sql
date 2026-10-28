-- ============================================================
-- 0014_harden_attendance_verification.sql
-- Make session creation and student check-in fail closed.
-- ============================================================

-- The product supports classroom/campus radii from 100 to 250 metres.
UPDATE public.attendance_sessions
SET radius = LEAST(250, GREATEST(100, radius))
WHERE radius < 100 OR radius > 250;

-- Legacy coarse anchors must not remain usable. Preserve the row for audit,
-- but end it before normalising the stored accuracy for the new constraint.
UPDATE public.attendance_sessions
SET status = 'ended',
    end_time = COALESCE(end_time, to_char(now() AT TIME ZONE 'UTC', 'HH24:MI'))
WHERE status = 'active'
  AND (
    anchor_accuracy < 0 OR anchor_accuracy > 25
    OR anchor_lat NOT BETWEEN -90 AND 90
    OR anchor_lng NOT BETWEEN -180 AND 180
  );

UPDATE public.attendance_sessions
SET anchor_accuracy = LEAST(25, GREATEST(0, anchor_accuracy))
WHERE anchor_accuracy < 0 OR anchor_accuracy > 25;

UPDATE public.profiles
SET approval_status = CASE WHEN role = 'lecturer' THEN 'pending' ELSE 'approved' END
WHERE approval_status IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN approval_status SET NOT NULL;

ALTER TABLE public.attendance_sessions
  DROP CONSTRAINT IF EXISTS attendance_sessions_radius_minimum;

ALTER TABLE public.attendance_sessions
  ADD CONSTRAINT attendance_sessions_radius_minimum CHECK (radius BETWEEN 100 AND 250);

ALTER TABLE public.attendance_sessions
  DROP CONSTRAINT IF EXISTS attendance_sessions_anchor_accuracy_precise;

ALTER TABLE public.attendance_sessions
  ADD CONSTRAINT attendance_sessions_anchor_accuracy_precise
  CHECK (anchor_accuracy BETWEEN 0 AND 25);

ALTER TABLE public.attendance_sessions
  DROP CONSTRAINT IF EXISTS attendance_sessions_anchor_coordinates_valid;

ALTER TABLE public.attendance_sessions
  ADD CONSTRAINT attendance_sessions_anchor_coordinates_valid
  CHECK (anchor_lat BETWEEN -90 AND 90 AND anchor_lng BETWEEN -180 AND 180) NOT VALID;

-- Repair any historic duplicates before enforcing one live session per course.
WITH ranked_active AS (
  SELECT id,
         row_number() OVER (PARTITION BY course_id ORDER BY created_at DESC, id DESC) AS position
  FROM public.attendance_sessions
  WHERE status = 'active'
)
UPDATE public.attendance_sessions AS session
SET status = 'ended',
    end_time = COALESCE(session.end_time, to_char(now() AT TIME ZONE 'UTC', 'HH24:MI'))
FROM ranked_active
WHERE session.id = ranked_active.id
  AND ranked_active.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_one_active_per_course_idx
  ON public.attendance_sessions (course_id)
  WHERE status = 'active';

-- A lecturer must use the validated RPC below. Direct INSERT could otherwise
-- bypass approval, course assignment, anchor quality, and replacement rules.
DROP POLICY IF EXISTS "Lecturers can create sessions" ON public.attendance_sessions;

CREATE OR REPLACE FUNCTION public.create_attendance_session(
  p_course_id text,
  p_topic text,
  p_radius integer,
  p_anchor_lat double precision,
  p_anchor_lng double precision,
  p_anchor_accuracy double precision,
  p_note text DEFAULT NULL,
  p_enrolled_count integer DEFAULT 0
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
    NULLIF(btrim(p_note), ''),
    v_enrolled_count,
    to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  )
  RETURNING * INTO v_created;

  RETURN to_jsonb(v_created);
END;
$$;

REVOKE ALL ON FUNCTION public.create_attendance_session(
  text, text, integer, double precision, double precision, double precision, text, integer
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_attendance_session(
  text, text, integer, double precision, double precision, double precision, text, integer
) TO authenticated;

-- Session owners may end a session, but they may not directly rewrite its
-- course, anchor, radius, timestamps, or ownership after validated creation.
DROP POLICY IF EXISTS "Lecturers can update their own sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Lecturers can delete their own sessions" ON public.attendance_sessions;

CREATE POLICY "Lecturers can delete their own sessions"
  ON public.attendance_sessions
  FOR DELETE
  TO authenticated
  USING (
    public.current_profile_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.profiles AS lecturer
      WHERE lecturer.id = auth.uid()
        AND lecturer.role = 'lecturer'
        AND lecturer.approval_status = 'approved'
        AND lecturer.id = attendance_sessions.lecturer_id
    )
  );

CREATE OR REPLACE FUNCTION public.end_attendance_session(p_session_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_approval text;
  v_owner uuid;
  v_end_time text := to_char(now() AT TIME ZONE 'UTC', 'HH24:MI');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  SELECT role, approval_status
  INTO v_role, v_approval
  FROM public.profiles
  WHERE id = v_uid;

  SELECT lecturer_id
  INTO v_owner
  FROM public.attendance_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session does not exist.';
  END IF;

  IF v_role <> 'admin'
     AND NOT (v_role = 'lecturer' AND v_approval = 'approved' AND v_owner = v_uid) THEN
    RAISE EXCEPTION 'You are not allowed to end this session.';
  END IF;

  UPDATE public.attendance_sessions
  SET status = 'ended',
      end_time = COALESCE(end_time, v_end_time)
  WHERE id = p_session_id;

  RETURN jsonb_build_object('success', true, 'endTime', v_end_time);
END;
$$;

REVOKE ALL ON FUNCTION public.end_attendance_session(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_attendance_session(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_attendance_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  UPDATE public.attendance_sessions
  SET status = 'ended',
      end_time = to_char(created_at + interval '30 minutes', 'HH24:MI')
  WHERE status = 'active'
    AND created_at < now() - interval '30 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_attendance_sessions()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_attendance_sessions() TO authenticated;

-- Direct lecturer profile reads exposed biometric vectors because RLS is
-- row-based, not column-based. Provide only the roster fields required by the
-- lecturer UI through a validated function.
DROP POLICY IF EXISTS "Lecturers can read student profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_course_student_roster(p_course_id text)
RETURNS TABLE (
  student_id uuid,
  student_name text,
  reg_number text,
  email text,
  guardian_name text,
  guardian_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  SELECT role, approval_status, course_ids
  INTO v_profile
  FROM public.profiles
  WHERE id = v_uid;

  IF v_profile.role <> 'admin'
     AND NOT (
       v_profile.role = 'lecturer'
       AND v_profile.approval_status = 'approved'
       AND p_course_id = ANY(COALESCE(v_profile.course_ids, '{}'::text[]))
     ) THEN
    RAISE EXCEPTION 'You are not allowed to view this course roster.';
  END IF;

  RETURN QUERY
  SELECT profile.id,
         profile.name,
         profile.reg_number,
         profile.email,
         profile.guardian_name,
         profile.guardian_email
  FROM public.profiles AS profile
  WHERE profile.role = 'student'
    AND p_course_id = ANY(COALESCE(profile.course_ids, '{}'::text[]))
  ORDER BY profile.name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_course_student_roster(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_student_roster(text) TO authenticated;

-- Students must never create or promote ledger rows through table RLS. The
-- SECURITY DEFINER RPC is the sole normal check-in write path.
DROP POLICY IF EXISTS "Students can create their own records" ON public.attendance_records;
DROP POLICY IF EXISTS "Students can insert their own records" ON public.attendance_records;
DROP POLICY IF EXISTS "Students can update their own records" ON public.attendance_records;

-- Migration 0012 accidentally granted every lecturer full access to every
-- ledger. Keep the session-owner mutation policies from 0010 and scope reads
-- to courses assigned to that lecturer.
DROP POLICY IF EXISTS "Lecturers can manage attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Lecturers can read records for their sessions" ON public.attendance_records;
DROP POLICY IF EXISTS "Lecturers can read records for assigned courses" ON public.attendance_records;
DROP POLICY IF EXISTS "Authorized users can read attendance records" ON public.attendance_records;

CREATE POLICY "Authorized users can read attendance records"
  ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR public.current_profile_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.attendance_sessions AS session
      JOIN public.profiles AS lecturer ON lecturer.id = auth.uid()
      WHERE session.id = attendance_records.session_id
        AND lecturer.role = 'lecturer'
        AND lecturer.approval_status = 'approved'
        AND session.lecturer_id = auth.uid()
    )
  );

-- Rebuild the retained lecturer CRUD policies so historic student-owned
-- sessions and cross-course rows cannot grant mutation access.
DROP POLICY IF EXISTS "Lecturers can update attendance for their sessions"
  ON public.attendance_records;
CREATE POLICY "Lecturers can update attendance for their sessions"
  ON public.attendance_records
  FOR UPDATE
  TO authenticated
  USING (
    public.current_profile_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.attendance_sessions AS session
      JOIN public.profiles AS lecturer ON lecturer.id = auth.uid()
      WHERE session.id = attendance_records.session_id
        AND session.course_id = attendance_records.course_id
        AND session.lecturer_id = auth.uid()
        AND lecturer.role = 'lecturer'
        AND lecturer.approval_status = 'approved'
    )
  )
  WITH CHECK (
    public.current_profile_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.attendance_sessions AS session
      JOIN public.profiles AS lecturer ON lecturer.id = auth.uid()
      WHERE session.id = attendance_records.session_id
        AND session.course_id = attendance_records.course_id
        AND session.lecturer_id = auth.uid()
        AND lecturer.role = 'lecturer'
        AND lecturer.approval_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Lecturers can delete attendance for their sessions"
  ON public.attendance_records;
CREATE POLICY "Lecturers can delete attendance for their sessions"
  ON public.attendance_records
  FOR DELETE
  TO authenticated
  USING (
    public.current_profile_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.attendance_sessions AS session
      JOIN public.profiles AS lecturer ON lecturer.id = auth.uid()
      WHERE session.id = attendance_records.session_id
        AND session.course_id = attendance_records.course_id
        AND session.lecturer_id = auth.uid()
        AND lecturer.role = 'lecturer'
        AND lecturer.approval_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Lecturers can manually insert attendance for their sessions"
  ON public.attendance_records;
CREATE POLICY "Lecturers can manually insert attendance for their sessions"
  ON public.attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_profile_role() = 'admin'
    OR (
      EXISTS (
        SELECT 1
        FROM public.attendance_sessions AS session
        JOIN public.profiles AS lecturer ON lecturer.id = auth.uid()
        WHERE session.id = attendance_records.session_id
          AND session.course_id = attendance_records.course_id
          AND session.lecturer_id = auth.uid()
          AND lecturer.role = 'lecturer'
          AND lecturer.approval_status = 'approved'
      )
      AND EXISTS (
        SELECT 1
        FROM public.profiles AS student
        WHERE student.id = attendance_records.student_id
          AND student.role = 'student'
          AND attendance_records.course_id = ANY(COALESCE(student.course_ids, '{}'::text[]))
      )
    )
  );

-- The former authenticated RPC remains the compatibility write path. It now
-- validates the submitted score, GPS accuracy, enrollment, and geofence in the
-- database; a trusted biometric verification service should replace the
-- client-supplied score in a later migration.
REVOKE ALL ON FUNCTION public.record_verified_attendance(
  text, double precision, double precision, double precision, double precision
) FROM PUBLIC, anon, authenticated, service_role;

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

  IF v_distance > v_session.radius THEN
    RAISE EXCEPTION 'Geofence check failed: You are % metres away (allowed: %m).',
      round(v_distance::numeric, 1), round(v_session.radius::numeric, 1);
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
    face_score = EXCLUDED.face_score,
    distance = EXCLUDED.distance,
    gps_accuracy = EXCLUDED.gps_accuracy,
    verified_at = EXCLUDED.verified_at;

  RETURN jsonb_build_object(
    'success', true,
    'recordedAt', v_recorded_at,
    'distance', round(v_distance::numeric, 2),
    'faceScore', p_face_score
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_verified_attendance(
  text, double precision, double precision, double precision, double precision
) TO authenticated;

-- Prevent users from promoting their own role/approval state or replacing a
-- biometric template outside the duplicate-checked RPC below. Admins update
-- other users, so those legitimate governance writes remain available.
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_secure_face_writer text := COALESCE(current_setting('app.secure_face_writer', true), '');
BEGIN
  IF auth.uid() = old.id THEN
    IF new.role IS DISTINCT FROM old.role
       OR new.approval_status IS DISTINCT FROM old.approval_status THEN
      RAISE EXCEPTION 'Role and approval status may be changed only by an administrator.';
    END IF;

    IF old.staff_id IS NOT NULL AND new.staff_id IS DISTINCT FROM old.staff_id THEN
      RAISE EXCEPTION 'Staff ID may not be changed once it has been set.';
    END IF;

    IF (new.face_vector IS DISTINCT FROM old.face_vector
        OR new.face_enrolled IS DISTINCT FROM old.face_enrolled)
       AND v_secure_face_writer <> auth.uid()::text THEN
      RAISE EXCEPTION 'Face enrollment must use the secure enrollment operation.';
    END IF;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_security ON public.profiles;
DROP TRIGGER IF EXISTS trg_protect_profile_security_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_security_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_security_fields();

CREATE OR REPLACE FUNCTION public.enroll_own_face(p_vector vector)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_similarity double precision;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  IF p_vector IS NULL OR vector_dims(p_vector) <> 512 THEN
    RAISE EXCEPTION 'A valid 512-value face vector is required.';
  END IF;

  IF -(p_vector <#> p_vector) < 0.000001 THEN
    RAISE EXCEPTION 'A non-empty face template is required.';
  END IF;

  -- Serialize duplicate-check plus update so two concurrent enrollments cannot
  -- both pass the similarity test before either template is stored.
  PERFORM pg_advisory_xact_lock(hashtextextended('face-enrollment', 0));

  SELECT 1 - (profile.face_vector <=> p_vector)
  INTO v_similarity
  FROM public.profiles AS profile
  WHERE profile.id <> v_uid
    AND profile.face_enrolled = true
    AND profile.face_vector IS NOT NULL
  ORDER BY profile.face_vector <=> p_vector
  LIMIT 1;

  IF COALESCE(v_similarity, 0) > 0.65 THEN
    RAISE EXCEPTION 'This face is already enrolled under a different account.';
  END IF;

  PERFORM set_config('app.secure_face_writer', v_uid::text, true);

  UPDATE public.profiles
  SET face_vector = p_vector,
      face_enrolled = true
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_own_face(vector) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_own_face(vector) TO authenticated;
