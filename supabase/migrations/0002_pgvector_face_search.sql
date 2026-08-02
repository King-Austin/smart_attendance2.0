-- ============================================================
-- Smart Campus Presence - PGVECTOR Face Search
-- Migrates face_vector from numeric[] to vector(512) and adds a
-- cosine-similarity index plus a server-side search function used
-- by the duplicate-face check at registration.
-- ============================================================

-- 1. Enable the pgvector extension (idempotent)
create extension if not exists vector;

-- 2. Convert face_vector numeric[] -> vector(512)
--    numeric[] -> text gives '{0.1,0.2,...}'; normalize to pgvector '[0.1,0.2,...]'.
alter table public.profiles
  alter column face_vector type vector(512)
  using (
    case
      when face_vector is null then null
      else ('[' || array_to_string(face_vector, ',') || ']')::vector
    end
  );

-- 3. HNSW index for fast approximate nearest-neighbor cosine search.
create index if not exists profiles_face_vector_hnsw_idx
  on public.profiles
  using hnsw (face_vector vector_cosine_ops);

-- 4. Server-side nearest-neighbor search used by the registration flow.
--    Returns the closest enrolled face and whether it is a duplicate.
--    Wrapped in security definer so the service role can search all
--    profiles without exposing embeddings to clients.
create or replace function public.check_duplicate_face(p_vector vector, p_threshold double precision default 0.65)
returns table (duplicate boolean, similarity double precision, match_id uuid, match_name text)
language plpgsql
security definer
set search_path = public
as $body$
begin
  return query
    select
      (1 - (p.face_vector <=> p_vector)) > p_threshold as duplicate,
      1 - (p.face_vector <=> p_vector) as similarity,
      p.id as match_id,
      p.name as match_name
    from public.profiles p
    where p.face_vector is not null
      and p.face_enrolled = true
    order by p.face_vector <=> p_vector
    limit 1;
end;
$body$;

-- Allow only the service role to invoke the search (privacy: embeddings stay server-side).
revoke all on function public.check_duplicate_face(vector, double precision) from public, anon, authenticated;
grant execute on function public.check_duplicate_face(vector, double precision) to service_role;
