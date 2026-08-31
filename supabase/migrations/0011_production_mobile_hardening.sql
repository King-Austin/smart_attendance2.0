-- Production hardening for the Expo rebuild.
-- Identity decisions remain server-owned and biometric vectors are never
-- readable or writable through the public mobile API.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  requested_role text := lower(coalesce(new.raw_user_meta_data->>'role', 'student'));
  safe_role text;
  initial_status text;
begin
  safe_role := case when requested_role = 'lecturer' then 'lecturer' else 'student' end;
  initial_status := case when safe_role = 'lecturer' then 'pending' else 'approved' end;
  if nullif(new.raw_user_meta_data->>'faculty_id', '') is null
     or nullif(new.raw_user_meta_data->>'department_id', '') is null
     or not exists (
       select 1 from public.departments d
       where d.id = (new.raw_user_meta_data->>'department_id')::uuid
         and d.faculty_id = (new.raw_user_meta_data->>'faculty_id')::uuid
     ) then
    raise exception 'A valid faculty and department placement is required';
  end if;

  insert into public.profiles (
    id, role, name, email, approval_status, faculty_id, department_id,
    faculty, department, reg_number, staff_id, level, semester, phone
  ) values (
    new.id,
    safe_role,
    trim(coalesce(new.raw_user_meta_data->>'full_name', '')),
    coalesce(new.email, ''),
    initial_status,
    nullif(new.raw_user_meta_data->>'faculty_id', '')::uuid,
    nullif(new.raw_user_meta_data->>'department_id', '')::uuid,
    nullif(new.raw_user_meta_data->>'faculty', ''),
    nullif(new.raw_user_meta_data->>'department', ''),
    case when safe_role = 'student' then nullif(trim(new.raw_user_meta_data->>'reg_number'), '') else null end,
    case when safe_role = 'lecturer' then nullif(trim(new.raw_user_meta_data->>'staff_id'), '') else null end,
    case when safe_role = 'student' then nullif(new.raw_user_meta_data->>'level', '') else null end,
    case when safe_role = 'student' then nullif(new.raw_user_meta_data->>'semester', '') else null end,
    nullif(trim(new.raw_user_meta_data->>'phone'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Prevent a normal authenticated client from elevating roles, approving a
-- lecturer, changing institutional scope, or writing biometric state.
create or replace function public.guard_sensitive_profile_update()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and public.current_profile_role() <> 'admin' then
    new.role := old.role;
    new.approval_status := old.approval_status;
    new.faculty_id := old.faculty_id;
    new.department_id := old.department_id;
    new.faculty := old.faculty;
    new.department := old.department;
    new.reg_number := old.reg_number;
    new.staff_id := old.staff_id;
    new.level := old.level;
    new.semester := old.semester;
    new.face_vector := old.face_vector;
    new.face_enrolled := old.face_enrolled;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_sensitive_profile_update on public.profiles;
create trigger trg_guard_sensitive_profile_update
  before update on public.profiles
  for each row execute function public.guard_sensitive_profile_update();

-- Embeddings are never returned through PostgREST, including to lecturers and
-- admins. Service-role Edge Functions retain server-side access.
revoke select on public.profiles from authenticated;
grant select (
  id, role, name, email, faculty, department, reg_number, level, semester,
  academic_session, phone, staff_id, course_ids, face_enrolled, created_at,
  updated_at, guardian_name, guardian_phone, guardian_email, approval_status,
  faculty_id, department_id
) on public.profiles to authenticated;

-- Serialize face enrolments so two concurrent accounts cannot both pass a
-- nearest-neighbour check before either vector is saved.
create or replace function public.enroll_face_atomic(
  target_student_id uuid,
  candidate_vector vector(512),
  duplicate_threshold double precision default 0.65
)
returns table (enrolled boolean, nearest_similarity double precision)
language plpgsql security definer set search_path = public
as $$
declare
  closest_similarity double precision;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server-controlled face enrolment is required';
  end if;
  if candidate_vector is null or vector_dims(candidate_vector) <> 512 then
    raise exception 'A valid 512-dimensional face embedding is required';
  end if;
  if duplicate_threshold < 0.5 or duplicate_threshold > 0.99 then
    raise exception 'Invalid duplicate threshold';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = target_student_id and role = 'student'
  ) then
    raise exception 'Student profile not found';
  end if;

  perform pg_advisory_xact_lock(hashtext('unizik-face-enrolment'));

  select 1 - (p.face_vector <=> candidate_vector)
  into closest_similarity
  from public.profiles p
  where p.face_enrolled = true
    and p.face_vector is not null
    and p.id <> target_student_id
  order by p.face_vector <=> candidate_vector
  limit 1;

  if closest_similarity is not null and closest_similarity >= duplicate_threshold then
    raise exception using
      errcode = '23505',
      message = 'This face is already enrolled to another account';
  end if;

  update public.profiles
  set face_vector = candidate_vector, face_enrolled = true
  where id = target_student_id;

  return query select true, closest_similarity;
end;
$$;

revoke all on function public.enroll_face_atomic(uuid, vector, double precision) from public, anon, authenticated;
grant execute on function public.enroll_face_atomic(uuid, vector, double precision) to service_role;

-- Replace over-broad read policies with course- and session-scoped access.
drop policy if exists "Lecturers can read student profiles" on public.profiles;
create policy "Lecturers read students in assigned courses"
  on public.profiles for select to authenticated
  using (
    auth.uid() = id
    or public.current_profile_role() = 'admin'
    or (
      public.current_profile_role() = 'lecturer'
      and exists (
        select 1
        from public.student_course_enrollments e
        join public.course_lecturers cl on cl.course_id = e.course_id
        where e.student_id = profiles.id and cl.lecturer_id = auth.uid()
      )
    )
  );

drop policy if exists "Sessions are readable by any authenticated user" on public.attendance_sessions;
create policy "Users read eligible sessions"
  on public.attendance_sessions for select to authenticated
  using (
    public.current_profile_role() = 'admin'
    or lecturer_id = auth.uid()
    or exists (
      select 1 from public.course_lecturers cl
      where cl.course_id = attendance_sessions.course_id and cl.lecturer_id = auth.uid()
    )
    or exists (
      select 1 from public.student_course_enrollments e
      where e.course_id = attendance_sessions.course_id and e.student_id = auth.uid()
    )
  );

drop policy if exists "Lecturers can read records for their sessions" on public.attendance_records;
create policy "Users read scoped attendance records"
  on public.attendance_records for select to authenticated
  using (
    student_id = auth.uid()
    or public.current_profile_role() = 'admin'
    or exists (
      select 1 from public.course_lecturers cl
      where cl.course_id = attendance_records.course_id and cl.lecturer_id = auth.uid()
    )
  );

create index if not exists attendance_sessions_course_status_idx
  on public.attendance_sessions(course_id, status, created_at desc);
create index if not exists attendance_records_student_created_idx
  on public.attendance_records(student_id, created_at desc);
create index if not exists attendance_records_session_created_idx
  on public.attendance_records(session_id, created_at desc);
create index if not exists student_course_enrollments_course_idx
  on public.student_course_enrollments(course_id);
create index if not exists course_lecturers_course_idx
  on public.course_lecturers(course_id);

create or replace function public.register_device_push_token(
  target_token text,
  target_platform text,
  target_device_name text default null
)
returns public.device_push_tokens
language plpgsql security definer set search_path = public
as $$
declare saved public.device_push_tokens;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_platform not in ('android', 'ios') then raise exception 'Invalid platform'; end if;
  if target_token !~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$' and target_token !~ '^ExpoPushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Invalid Expo push token';
  end if;
  delete from public.device_push_tokens where expo_push_token = target_token;
  insert into public.device_push_tokens(user_id, expo_push_token, platform, device_name, enabled)
  values (auth.uid(), target_token, target_platform, nullif(trim(target_device_name), ''), true)
  returning * into saved;
  return saved;
end;
$$;

revoke all on function public.register_device_push_token(text, text, text) from public, anon;
grant execute on function public.register_device_push_token(text, text, text) to authenticated;

create table public.liveness_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose in ('enrolment', 'attendance')),
  instructions jsonb not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  used_at timestamptz
);

alter table public.liveness_challenges enable row level security;
-- No client table policy: challenges are issued and consumed only by Edge Functions.
create index liveness_challenges_user_expiry_idx on public.liveness_challenges(user_id, expires_at desc);
