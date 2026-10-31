-- ============================================================
-- 0025_safe_duplicate_face_check.sql
-- Removes conflicting 2-argument check_duplicate_face overload
-- and provides public-safe check_duplicate_face_public for mobile/web
-- ============================================================

-- 1. Drop old 2-argument signature to resolve PostgREST overload ambiguity (PGRST203)
DROP FUNCTION IF EXISTS public.check_duplicate_face(vector, double precision);

-- 2. Create public-safe duplicate face check that returns only boolean and score.
--    Does NOT leak match_id, match_name, or embeddings.
CREATE OR REPLACE FUNCTION public.check_duplicate_face_public(
  p_vector vector,
  p_threshold double precision DEFAULT 0.65,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS TABLE (duplicate boolean, similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      (1 - (p.face_vector <=> p_vector)) > p_threshold AS duplicate,
      1 - (p.face_vector <=> p_vector) AS similarity
    FROM public.profiles p
    WHERE p.face_vector IS NOT NULL
      AND p.face_enrolled = true
      AND (p_exclude_id IS NULL OR p.id != p_exclude_id)
    ORDER BY p.face_vector <=> p_vector
    LIMIT 1;
END;
$$;

-- Allow anon and authenticated clients (such as mobile apps) to execute the safe check
REVOKE ALL ON FUNCTION public.check_duplicate_face_public(vector, double precision, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.check_duplicate_face_public(vector, double precision, uuid) TO anon, authenticated, service_role;

