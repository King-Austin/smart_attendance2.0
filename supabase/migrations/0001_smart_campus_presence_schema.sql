-- ============================================================
-- Smart Campus Presence - Supabase Schema
-- Run order: auth schema already exists (Supabase managed).
-- This migration creates all app tables, the profile trigger,
-- RLS policies, and seed data for courses.
-- ============================================================

-- Enable pgvector for face embeddings (idempotent)
create extension if not exists vector;

-- ------------------------------------------------------------
-- 1. PROFILES (one row per auth.users row, created by trigger)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('student', 'lecturer')),
  name text not null,
  email text not null,
  faculty text,
  department text,
  -- Student fields
  reg_number text unique,
  level text,
  semester text,
  academic_session text,
  phone text,
  -- Lecturer fields
  staff_id text unique,
  -- Shared
  course_ids text[] not null default '{}',
  face_enrolled boolean not null default false,
  face_vector vector(512),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- HNSW index for fast cosine nearest-neighbor face search
create index if not exists profiles_face_vector_hnsw_idx
  on public.profiles
  using hnsw (face_vector vector_cosine_ops);

-- auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- RLS for profiles
alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Lecturers can read student profiles"
  on public.profiles for select
  to authenticated
  using (public.current_profile_role() = 'lecturer' or auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create profile row when a user signs up.
-- Role, name etc. are filled in by the client after auth so defaults are blank.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, name, email)
  values (new.id, 'student', coalesce(new.raw_user_meta_data->>'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Security-definer helper so RLS policies can check the caller's role
-- without recursing back into public.profiles.
create or replace function public.current_profile_role()
returns text as $$
  select coalesce((select role from public.profiles where id = auth.uid()), '')
$$ language sql stable security definer set search_path = public;

-- ------------------------------------------------------------
-- 2. COURSES
-- ------------------------------------------------------------
create table if not exists public.courses (
  id text primary key,
  code text not null,
  title text not null,
  credit_unit int not null default 3,
  department text,
  lecturer text,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;

create policy "Courses are readable by any authenticated user"
  on public.courses for select
  to authenticated
  using (true);

-- ------------------------------------------------------------
-- 3. ATTENDANCE SESSIONS
-- ------------------------------------------------------------
create table if not exists public.attendance_sessions (
  id text primary key,
  course_id text not null references public.courses (id),
  topic text not null,
  lecturer_name text not null,
  lecturer_id uuid references public.profiles (id),
  start_time text not null,
  end_time text,
  radius int not null default 75,
  status text not null default 'active' check (status in ('active', 'ended', 'scheduled')),
  anchor_lat double precision not null,
  anchor_lng double precision not null,
  anchor_accuracy double precision not null default 0,
  note text,
  enrolled_count int not null default 0,
  date text not null,
  created_at timestamptz not null default now()
);

alter table public.attendance_sessions enable row level security;

create policy "Sessions are readable by any authenticated user"
  on public.attendance_sessions for select
  to authenticated
  using (true);

create policy "Lecturers can create sessions"
  on public.attendance_sessions for insert
  to authenticated
  with check (auth.uid() = lecturer_id);

create policy "Lecturers can update their own sessions"
  on public.attendance_sessions for update
  to authenticated
  using (auth.uid() = lecturer_id)
  with check (auth.uid() = lecturer_id);

-- ------------------------------------------------------------
-- 4. ATTENDANCE RECORDS
-- ------------------------------------------------------------
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.attendance_sessions (id) on delete cascade,
  course_id text not null references public.courses (id),
  student_id uuid not null references public.profiles (id) on delete cascade,
  student_name text not null,
  reg_number text,
  date text not null,
  topic text,
  status text not null check (status in ('verified', 'missed', 'failed')),
  face_score double precision,
  distance double precision,
  gps_accuracy double precision,
  verified_at text,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);

alter table public.attendance_records enable row level security;

create policy "Students can read their own records"
  on public.attendance_records for select
  to authenticated
  using (auth.uid() = student_id);

create policy "Lecturers can read records for their sessions"
  on public.attendance_records for select
  to authenticated
  using (
    public.current_profile_role() = 'lecturer'
    or auth.uid() = student_id
  );

create policy "Students can create their own records"
  on public.attendance_records for insert
  to authenticated
  with check (auth.uid() = student_id);

-- ------------------------------------------------------------
-- 5. PUSH SUBSCRIPTIONS (web push / FCM-style, no Firebase)
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_push_subscriptions_updated on public.push_subscriptions;
create trigger trg_push_subscriptions_updated
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert their own push subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users delete their own push subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6. SEED COURSES (matches src/data/mockData.ts)
-- ------------------------------------------------------------
insert into public.courses (id, code, title, credit_unit, department, lecturer)
values
  ('ece501', 'ECE 501', 'Digital Signal Processing', 3, 'Electrical and Electronic Engineering', 'Dr. Adaeze Nwosu'),
  ('ece503', 'ECE 503', 'Control Systems Engineering', 3, 'Electrical and Electronic Engineering', 'Dr. Adaeze Nwosu'),
  ('ece505', 'ECE 505', 'Communication Systems', 3, 'Electrical and Electronic Engineering', 'Prof. Ibrahim Sanusi'),
  ('ece507', 'ECE 507', 'Embedded Systems Design', 2, 'Electrical and Electronic Engineering', 'Dr. Adaeze Nwosu'),
  ('ece509', 'ECE 509', 'Engineering Research Methods', 2, 'Electrical and Electronic Engineering', 'Dr. Tunde Balogun')
on conflict (id) do nothing;
