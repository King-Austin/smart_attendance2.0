-- Mobile rebuild: normalized UNIZIK faculty/department structure,
-- student course selection, equal multi-lecturer course access, mobile push,
-- and audited attendance corrections.

create table public.faculties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculties(id) on delete cascade,
  code text not null,
  name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (faculty_id, code),
  unique (faculty_id, name)
);

alter table public.profiles
  add column faculty_id uuid references public.faculties(id),
  add column department_id uuid references public.departments(id);

alter table public.courses
  add column faculty_id uuid references public.faculties(id),
  add column department_id uuid references public.departments(id);

insert into public.faculties (code, name)
values ('ENG', 'Engineering')
on conflict (code) do nothing;

insert into public.departments (faculty_id, code, name)
select id, 'EEE', 'Electrical and Electronic Engineering'
from public.faculties
where code = 'ENG'
on conflict (faculty_id, code) do nothing;

update public.profiles p
set faculty_id = f.id,
    department_id = d.id
from public.faculties f
join public.departments d on d.faculty_id = f.id and d.code = 'EEE'
where f.code = 'ENG'
  and p.department = 'Electrical and Electronic Engineering';

update public.courses c
set faculty_id = f.id,
    department_id = d.id
from public.faculties f
join public.departments d on d.faculty_id = f.id and d.code = 'EEE'
where f.code = 'ENG'
  and c.department = 'Electrical and Electronic Engineering';

create table public.student_course_enrollments (
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (student_id, course_id)
);

create table public.course_lecturers (
  lecturer_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  selected_at timestamptz not null default now(),
  primary key (lecturer_id, course_id)
);

create or replace function public.student_can_select_course(target_course_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.courses c on c.id = target_course_id
    where p.id = auth.uid()
      and p.role = 'student'
      and p.department_id is not null
      and p.department_id = c.department_id
      and p.level = c.level
      and p.semester = c.semester
  );
$$;

create or replace function public.lecturer_can_select_course(target_course_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.courses c on c.id = target_course_id
    where p.id = auth.uid()
      and p.role = 'lecturer'
      and p.approval_status = 'approved'
      and p.department_id is not null
      and p.department_id = c.department_id
  );
$$;

alter table public.faculties enable row level security;
alter table public.departments enable row level security;
alter table public.student_course_enrollments enable row level security;
alter table public.course_lecturers enable row level security;

create policy "Authenticated users read faculties"
  on public.faculties for select to authenticated using (true);
create policy "Admins manage faculties"
  on public.faculties for all to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "Authenticated users read departments"
  on public.departments for select to authenticated using (true);
create policy "Admins manage departments"
  on public.departments for all to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "Users read relevant student enrollments"
  on public.student_course_enrollments for select to authenticated
  using (
    student_id = auth.uid()
    or public.current_profile_role() = 'admin'
    or exists (
      select 1 from public.course_lecturers cl
      where cl.course_id = student_course_enrollments.course_id
        and cl.lecturer_id = auth.uid()
    )
  );
create policy "Students select eligible courses"
  on public.student_course_enrollments for insert to authenticated
  with check (student_id = auth.uid() and public.student_can_select_course(course_id));
create policy "Students remove their courses"
  on public.student_course_enrollments for delete to authenticated
  using (student_id = auth.uid());

create policy "Authenticated users read course lecturers"
  on public.course_lecturers for select to authenticated using (true);
create policy "Approved lecturers select department courses"
  on public.course_lecturers for insert to authenticated
  with check (lecturer_id = auth.uid() and public.lecturer_can_select_course(course_id));
create policy "Lecturers remove their course selection"
  on public.course_lecturers for delete to authenticated
  using (lecturer_id = auth.uid());

-- Backfill legacy array selections into normalized junction tables.
insert into public.student_course_enrollments (student_id, course_id)
select p.id, unnest(p.course_ids)
from public.profiles p
where p.role = 'student'
on conflict do nothing;

insert into public.course_lecturers (lecturer_id, course_id)
select p.id, unnest(p.course_ids)
from public.profiles p
where p.role = 'lecturer' and p.approval_status = 'approved'
on conflict do nothing;

-- Every newly created attendance session uses the confirmed university radius.
alter table public.attendance_sessions
  add constraint attendance_sessions_fixed_radius_check check (radius = 150) not valid;

drop policy if exists "Lecturers can create sessions" on public.attendance_sessions;
create policy "Assigned lecturers create sessions"
  on public.attendance_sessions for insert to authenticated
  with check (
    auth.uid() = lecturer_id
    and radius = 150
    and exists (
      select 1 from public.course_lecturers cl
      where cl.course_id = attendance_sessions.course_id
        and cl.lecturer_id = auth.uid()
    )
  );

create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references public.attendance_records(id) on delete cascade,
  session_id text not null references public.attendance_sessions(id) on delete cascade,
  previous_status text not null,
  corrected_status text not null check (corrected_status in ('verified', 'missed', 'failed')),
  reason text not null check (length(trim(reason)) >= 8),
  corrected_by uuid not null references public.profiles(id),
  corrected_at timestamptz not null default now()
);

alter table public.attendance_records
  add column corrected_by uuid references public.profiles(id),
  add column corrected_at timestamptz;

alter table public.attendance_corrections enable row level security;
create policy "Relevant users read correction audit"
  on public.attendance_corrections for select to authenticated
  using (
    public.current_profile_role() = 'admin'
    or corrected_by = auth.uid()
    or exists (
      select 1 from public.attendance_records ar
      where ar.id = attendance_corrections.attendance_record_id
        and ar.student_id = auth.uid()
    )
  );

create or replace function public.correct_attendance_record(
  target_record_id uuid,
  next_status text,
  correction_reason text
)
returns public.attendance_records
language plpgsql security definer set search_path = public
as $$
declare
  existing_record public.attendance_records;
  session_creator uuid;
  updated_record public.attendance_records;
begin
  if next_status not in ('verified', 'missed', 'failed') then
    raise exception 'Invalid attendance status';
  end if;
  if length(trim(correction_reason)) < 8 then
    raise exception 'A meaningful correction reason is required';
  end if;

  select * into existing_record
  from public.attendance_records
  where id = target_record_id
  for update;
  if not found then raise exception 'Attendance record not found'; end if;

  select lecturer_id into session_creator
  from public.attendance_sessions
  where id = existing_record.session_id;

  if public.current_profile_role() <> 'admin' and session_creator <> auth.uid() then
    raise exception 'Only the session creator or an admin can correct this record';
  end if;

  insert into public.attendance_corrections (
    attendance_record_id, session_id, previous_status, corrected_status, reason, corrected_by
  ) values (
    existing_record.id, existing_record.session_id, existing_record.status,
    next_status, trim(correction_reason), auth.uid()
  );

  update public.attendance_records
  set status = next_status, corrected_by = auth.uid(), corrected_at = now()
  where id = target_record_id
  returning * into updated_record;
  return updated_record;
end;
$$;

revoke all on function public.correct_attendance_record(uuid, text, text) from public;
grant execute on function public.correct_attendance_record(uuid, text, text) to authenticated;
create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  device_name text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_device_push_tokens_updated
  before update on public.device_push_tokens
  for each row execute function public.set_updated_at();

alter table public.device_push_tokens enable row level security;
create policy "Users manage their mobile push tokens"
  on public.device_push_tokens for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
