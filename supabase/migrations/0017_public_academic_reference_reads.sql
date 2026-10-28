-- Registration is unauthenticated, so academic reference data must be
-- readable without granting anonymous write access.
DROP POLICY IF EXISTS "Public can read faculties" ON public.faculties;
CREATE POLICY "Public can read faculties" ON public.faculties FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public can read departments" ON public.departments;
CREATE POLICY "Public can read departments" ON public.departments FOR SELECT TO anon USING (true);
