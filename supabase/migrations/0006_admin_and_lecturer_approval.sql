-- Add admin role support and lecturer approval workflow

DO $$ 
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%role%';
  
  IF c_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || c_name;
  END IF;
END $$;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role in ('student', 'lecturer', 'admin'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_status text default 'approved' check (approval_status in ('pending', 'approved', 'rejected'));

-- Update handle_new_user to set lecturers to pending by default
create or replace function public.handle_new_user()
returns trigger as $$
declare
  meta_role text := coalesce(
    nullif(new.raw_app_meta_data->>'role', ''),
    nullif(new.raw_user_meta_data->>'role', ''),
    'student'
  );
  init_status text := 'approved';
begin
  if meta_role = 'lecturer' then
    init_status := 'pending';
  end if;

  insert into public.profiles (id, role, name, email, approval_status)
  values (new.id, meta_role, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, init_status)
  on conflict (id) do update set role = excluded.role, approval_status = excluded.approval_status;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Admin RLS Policies

create policy "Admins can manage all profiles"
  on public.profiles for all
  to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "Admins can view all courses"
  on public.courses for all
  to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "Admins can view all sessions"
  on public.attendance_sessions for all
  to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "Admins can view all records"
  on public.attendance_records for all
  to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');
