-- Attendance becomes server-owned. Mobile/web clients can no longer insert a
-- client-declared face score or geofence result directly.

create table public.attendance_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id text references public.attendance_sessions(id) on delete set null,
  student_id uuid references public.profiles(id) on delete set null,
  outcome text not null,
  face_score double precision,
  distance_meters double precision,
  gps_accuracy double precision,
  location_captured_at timestamptz,
  attempted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.attendance_verification_attempts enable row level security;
create policy "Students read their verification attempts"
  on public.attendance_verification_attempts for select to authenticated
  using (student_id = auth.uid());
create policy "Session creators and admins read verification attempts"
  on public.attendance_verification_attempts for select to authenticated
  using (
    public.current_profile_role() = 'admin'
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_verification_attempts.session_id
        and s.lecturer_id = auth.uid()
    )
  );

drop policy if exists "Students can create their own records" on public.attendance_records;

create or replace function public.record_server_verified_attendance(
  target_session_id text,
  target_student_id uuid,
  verified_face_score double precision,
  verified_distance double precision,
  verified_gps_accuracy double precision
)
returns public.attendance_records
language plpgsql security definer set search_path = public
as $$
declare
  student_profile public.profiles;
  target_session public.attendance_sessions;
  new_record public.attendance_records;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server verification is required';
  end if;
  if target_student_id is null then raise exception 'Verified student identity is required'; end if;

  select * into target_session from public.attendance_sessions
  where id = target_session_id and status = 'active'
  for update;
  if not found then raise exception 'Attendance session is not active'; end if;

  select * into student_profile from public.profiles
  where id = target_student_id and role = 'student';
  if not found then raise exception 'Student profile not found'; end if;

  if not exists (
    select 1 from public.student_course_enrollments e
    where e.student_id = target_student_id and e.course_id = target_session.course_id
  ) then raise exception 'Student is not enrolled in this course'; end if;

  insert into public.attendance_records (
    session_id, course_id, student_id, student_name, reg_number,
    date, topic, status, face_score, distance, gps_accuracy, verified_at
  ) values (
    target_session.id, target_session.course_id, target_student_id,
    student_profile.name, student_profile.reg_number, target_session.date,
    target_session.topic, 'verified', verified_face_score, verified_distance,
    verified_gps_accuracy, to_char(now(), 'HH24:MI:SS')
  )
  returning * into new_record;
  return new_record;
end;
$$;

revoke all on function public.record_server_verified_attendance(text, uuid, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.record_server_verified_attendance(text, uuid, double precision, double precision, double precision) to service_role;
