CREATE TABLE IF NOT EXISTS public.faculties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES public.faculties(id) ON DELETE RESTRICT,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (faculty_id, name)
);

ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS faculty_id uuid REFERENCES public.faculties(id) ON DELETE RESTRICT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT;

INSERT INTO public.faculties (name)
SELECT DISTINCT btrim(faculty) FROM public.courses
WHERE faculty IS NOT NULL AND btrim(faculty) <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.departments (faculty_id, name)
SELECT DISTINCT f.id, btrim(c.department)
FROM public.courses c JOIN public.faculties f ON f.name = btrim(c.faculty)
WHERE c.department IS NOT NULL AND btrim(c.department) <> ''
ON CONFLICT (faculty_id, name) DO NOTHING;

UPDATE public.courses c
SET faculty_id = f.id, department_id = d.id
FROM public.faculties f, public.departments d
WHERE f.name = btrim(c.faculty)
  AND d.faculty_id = f.id
  AND d.name = btrim(c.department)
  AND (c.faculty_id IS NULL OR c.department_id IS NULL);

CREATE INDEX IF NOT EXISTS departments_faculty_id_idx ON public.departments(faculty_id);
CREATE INDEX IF NOT EXISTS courses_faculty_id_idx ON public.courses(faculty_id);
CREATE INDEX IF NOT EXISTS courses_department_id_idx ON public.courses(department_id);

DROP POLICY IF EXISTS "Authenticated users can read faculties" ON public.faculties;
CREATE POLICY "Authenticated users can read faculties" ON public.faculties FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage faculties" ON public.faculties;
CREATE POLICY "Admins can manage faculties" ON public.faculties FOR ALL TO authenticated
  USING (public.current_profile_role() = 'admin') WITH CHECK (public.current_profile_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated users can read departments" ON public.departments;
CREATE POLICY "Authenticated users can read departments" ON public.departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL TO authenticated
  USING (public.current_profile_role() = 'admin') WITH CHECK (public.current_profile_role() = 'admin');

DROP POLICY IF EXISTS "Admins can manage all courses" ON public.courses;
CREATE POLICY "Admins can manage all courses" ON public.courses FOR ALL TO authenticated
  USING (public.current_profile_role() = 'admin') WITH CHECK (public.current_profile_role() = 'admin');
