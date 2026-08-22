-- ============================================================
-- 0013_lecturer_delete_session_policy.sql
-- Allow lecturers to delete their own sessions and admins to delete any session
-- ============================================================

DROP POLICY IF EXISTS "Lecturers can delete their own sessions" ON public.attendance_sessions;
CREATE POLICY "Lecturers can delete their own sessions"
  ON public.attendance_sessions
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = lecturer_id
    OR public.current_profile_role() = 'admin'
  );
