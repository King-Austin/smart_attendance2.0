-- Run only in a disposable PostgreSQL database, never a linked/live project:
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/location-database.sql
-- Minimal fixtures exercise migration 0027's real PL/pgSQL functions and RLS.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
  $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, name text, reg_number text, role text, course_ids text[],
  approval_status text, face_enrolled boolean, face_vector double precision[]
);
CREATE TABLE public.attendance_sessions (
  id text PRIMARY KEY, course_id text, topic text, lecturer_name text, lecturer_id uuid,
  start_time text, end_time text, radius integer, status text, anchor_lat double precision,
  anchor_lng double precision, anchor_accuracy double precision, note text,
  enrolled_count integer, date text, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.attendance_records (
  session_id text, course_id text, student_id uuid, student_name text, reg_number text,
  date text, topic text, status text, face_score double precision, distance double precision,
  gps_accuracy double precision, verified_at text, UNIQUE(session_id, student_id)
);
CREATE FUNCTION public.calculate_haversine_distance(double precision, double precision,
  double precision, double precision) RETURNS double precision LANGUAGE sql AS $$
  SELECT 6371000 * 2 * asin(sqrt(least(1.0,
    sin(radians($3-$1)/2)^2 + cos(radians($1))*cos(radians($3))*sin(radians($4-$2)/2)^2)))
$$;
CREATE FUNCTION public.create_attendance_session(text,text,integer,double precision,
  double precision,double precision,text,integer) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.record_verified_attendance(text,double precision,double precision,
  double precision,double precision) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;

\ir ../../supabase/migrations/0027_location_reliability.sql

CREATE FUNCTION pg_temp.expect_error(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE expected THEN RAISE EXCEPTION 'Unexpected error: % (expected %)', SQLERRM, expected; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Statement should have failed: %', statement;
END;
$$;
INSERT INTO profiles VALUES
 ('00000000-0000-0000-0000-000000000001','Lecturer',NULL,'lecturer',ARRAY['CSC101'],'approved',false,NULL),
 ('00000000-0000-0000-0000-000000000002','Student','TEST-1','student',ARRAY['CSC101'],NULL,true,ARRAY[1.0]),
 ('00000000-0000-0000-0000-000000000003','Unassigned',NULL,'lecturer',ARRAY['OTHER'],'approved',false,NULL);
INSERT INTO verified_venues(id,name,lat,lng,accuracy,verification_note) VALUES
 ('00000000-0000-0000-0000-000000000010','Verified test classroom',0,0,5,'Disposable test fixture'),
 ('00000000-0000-0000-0000-000000000011','Inactive classroom',0,0,5,'Disposable test fixture');
UPDATE verified_venues SET active = false WHERE name = 'Inactive classroom';

SELECT set_config('test.uid','',false);
SELECT pg_temp.expect_error($q$ SELECT create_attendance_session('CSC101','Test',100,0,0,5,NULL,0,NULL,now()) $q$, 'Unauthorized%');
SELECT set_config('test.uid','00000000-0000-0000-0000-000000000003',false);
SELECT pg_temp.expect_error($q$ SELECT create_attendance_session('CSC101','Test',100,0,0,5,NULL,0,NULL,now()) $q$, 'You are not assigned%');
SELECT set_config('test.uid','00000000-0000-0000-0000-000000000001',false);
SELECT pg_temp.expect_error($q$ SELECT create_attendance_session('CSC101','Test',100,0,0,5,NULL,0,NULL,now()-interval '6 minutes') $q$, 'Capture a fresh%');
SELECT pg_temp.expect_error($q$ SELECT create_attendance_session('CSC101','Test',100,0,0,5,NULL,0,'00000000-0000-0000-0000-000000000011',NULL) $q$, 'The saved venue is no longer available%');
SELECT create_attendance_session('CSC101','Test',100,1,1,20,NULL,0,'00000000-0000-0000-0000-000000000010',NULL);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM attendance_sessions WHERE anchor_lat=0 AND anchor_lng=0 AND anchor_accuracy=5 AND venue_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Saved venue did not override client coordinates';
  END IF;
END $$;
-- Use a stable session ID for the verification tests.
UPDATE attendance_sessions SET id='test-session';
SELECT set_config('test.uid','00000000-0000-0000-0000-000000000002',false);
SELECT record_verified_attendance('test-session',0,0,10,0.9,clock_timestamp());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM attendance_records WHERE location_captured_at IS NOT NULL AND status='verified') THEN
    RAISE EXCEPTION 'Valid attendance was not recorded with location timestamp';
  END IF;
END $$;
SELECT pg_temp.expect_error($q$ SELECT record_verified_attendance('test-session',0,0,10,0.9,clock_timestamp()-interval '6 seconds') $q$, 'A fresh location%');
SELECT pg_temp.expect_error($q$ SELECT record_verified_attendance('test-session',0,0,10,0.9,clock_timestamp()+interval '3 seconds') $q$, 'A fresh location%');
SELECT pg_temp.expect_error($q$ SELECT record_verified_attendance('test-session',0,0,25.01,0.9,clock_timestamp()) $q$, 'GPS accuracy must%');
SELECT pg_temp.expect_error($q$ SELECT record_verified_attendance('test-session',91,0,10,0.9,clock_timestamp()) $q$, 'The submitted GPS coordinates%');
SELECT pg_temp.expect_error($q$ SELECT record_verified_attendance('test-session','NaN',0,10,0.9,clock_timestamp()) $q$, 'The submitted GPS coordinates%');
SELECT pg_temp.expect_error($q$ SELECT record_verified_attendance('test-session',0,0,10,0.4,clock_timestamp()) $q$, 'Biometric verification failed%');
SELECT pg_temp.expect_error($q$ SELECT record_verified_attendance('test-session',0.00085,0,10,0.9,clock_timestamp()) $q$, 'Location is uncertain%');
SELECT pg_temp.expect_error($q$ SELECT record_verified_attendance('test-session',0.002,0,10,0.9,clock_timestamp()) $q$, 'Geofence check failed%');
DO $$ BEGIN
  IF to_regprocedure('public.record_verified_attendance(text,double precision,double precision,double precision,double precision)') IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy attendance RPC still exists';
  END IF;
  IF has_function_privilege('anon','public.record_verified_attendance(text,double precision,double precision,double precision,double precision,timestamp with time zone)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous users can execute attendance RPC';
  END IF;
END $$;
SET ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM verified_venues) <> 1 THEN RAISE EXCEPTION 'Inactive venues visible'; END IF;
END $$;
SELECT pg_temp.expect_error($q$ INSERT INTO verified_venues(name,lat,lng,accuracy,verification_note) VALUES ('Forged',0,0,0,'Untrusted') $q$, 'permission denied%');
RESET ROLE;
SELECT 'Location database regression checks passed' AS result;
