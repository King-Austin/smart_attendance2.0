-- ============================================================
-- Flexible auth: role is resolvable from JWT claims OR profiles
-- ============================================================
-- Makes the role check work no matter how an account was created:
--  - client sign-up (raw_user_meta_data.role)
--  - admin provisioning (raw_app_meta_data.role via createUser)
--  - direct SQL insert into auth.users
--
-- Two triggers are used:
--  - BEFORE INSERT: copies the role into raw_app_meta_data so it lands in the
--    access-token claims (BEFORE triggers may modify NEW).
--  - AFTER INSERT: creates the profile row (must run AFTER so the FK
--    profiles.id -> auth.users.id is satisfied).

-- 1a. Claims trigger: derive the role and stamp it into app_metadata.
create or replace function public.handle_new_user_claims()
returns trigger as $$
declare
  meta_role text := coalesce(
    nullif(new.raw_app_meta_data->>'role', ''),
    nullif(new.raw_user_meta_data->>'role', ''),
    'student'
  );
begin
  new.raw_app_meta_data = jsonb_set(
    coalesce(new.raw_app_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(meta_role)
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  before insert on auth.users
  for each row execute function public.handle_new_user_claims();

-- 1b. Profile trigger: create the row after the user exists.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  meta_role text := coalesce(
    nullif(new.raw_app_meta_data->>'role', ''),
    nullif(new.raw_user_meta_data->>'role', ''),
    'student'
  );
begin
  insert into public.profiles (id, role, name, email)
  values (new.id, meta_role, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email)
  on conflict (id) do update set role = excluded.role;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_profile on auth.users;
create trigger on_auth_user_profile
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Role helper: prefer the JWT app_metadata.role claim; fall back to the
--    profiles column. Works whether role lives in claims, the table, or both.
create or replace function public.current_profile_role()
returns text as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    (select role from public.profiles where id = auth.uid()),
    ''
  );
$$ language sql stable security definer set search_path = public;

-- 3. Harden the self-edit policy: a user may update their own profile but may
--    not change their own role (prevents student -> lecturer self-escalation).
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );