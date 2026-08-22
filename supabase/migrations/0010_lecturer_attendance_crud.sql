-- ============================================================
-- 0010_lecturer_attendance_crud.sql
-- RLS policies allowing Lecturers & Admins full CRUD on attendance_records
-- for sessions belonging to them.
-- ============================================================

-- 1. UPDATE policy for lecturers & admins
DROP POLICY IF EXISTS "Lecturers can update attendance for their sessions" ON public.attendance_records;
CREATE POLICY "Lecturers can update attendance for their sessions"
  ON public.attendance_records
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = attendance_records.session_id
        AND s.lecturer_id = auth.uid()
    )
    OR public.current_profile_role() = 'admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = attendance_records.session_id
        AND s.lecturer_id = auth.uid()
    )
    OR public.current_profile_role() = 'admin'
  );

-- 2. DELETE policy for lecturers & admins
DROP POLICY IF EXISTS "Lecturers can delete attendance for their sessions" ON public.attendance_records;
CREATE POLICY "Lecturers can delete attendance for their sessions"
  ON public.attendance_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = attendance_records.session_id
        AND s.lecturer_id = auth.uid()
    )
    OR public.current_profile_role() = 'admin'
  );

-- 3. INSERT policy for lecturers (manual check-in / override) & admins
DROP POLICY IF EXISTS "Lecturers can manually insert attendance for their sessions" ON public.attendance_records;
CREATE POLICY "Lecturers can manually insert attendance for their sessions"
  ON public.attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = attendance_records.session_id
        AND s.lecturer_id = auth.uid()
    )
    OR public.current_profile_role() = 'admin'
  );
