ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS alternate_codes text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS level_requires_verification boolean NOT NULL DEFAULT false;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.courses
    GROUP BY upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce normalized course-code uniqueness: duplicate course codes already exist.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS courses_normalized_code_unique_idx
  ON public.courses (upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')));

INSERT INTO public.faculties(name) VALUES ('Faculty of Physical Sciences') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.departments(faculty_id, name)
SELECT id, 'Computer Science' FROM public.faculties WHERE name = 'Faculty of Physical Sciences'
ON CONFLICT (faculty_id, name) DO NOTHING;

DO $$
DECLARE conflict_code text;
BEGIN
  SELECT incoming.code INTO conflict_code
  FROM (VALUES
    ('nau-csc-csc100','CSC100'),('nau-csc-csc102','CSC102'),('nau-csc-nau-csc110','NAU-CSC110'),
    ('nau-csc-nau-csc112','NAU-CSC112'),('nau-csc-csc202','CSC202'),('nau-csc-csc203','CSC203'),
    ('nau-csc-csc222','CSC222'),('nau-csc-csc232','CSC232'),('nau-csc-csc252','CSC252'),
    ('nau-csc-csc299','CSC299'),('nau-csc-csc308','CSC308'),('nau-csc-csc322','CSC322'),
    ('nau-csc-csc399','CSC399'),('nau-csc-csc412','CSC412'),('nau-csc-csc422','CSC422'),
    ('nau-csc-csc442','CSC442'),('nau-csc-csc452','CSC452'),('nau-csc-csc462','CSC462'),('nau-csc-csc482','CSC482')
  ) AS incoming(id, code)
  JOIN public.courses c ON upper(regexp_replace(c.code, '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(incoming.code, '[^A-Za-z0-9]', '', 'g'))
  WHERE c.id <> incoming.id LIMIT 1;
  IF conflict_code IS NOT NULL THEN RAISE EXCEPTION 'Incoming course code % already belongs to another record.', conflict_code; END IF;
END $$;

WITH hierarchy AS (
  SELECT f.id faculty_id, d.id department_id FROM public.faculties f
  JOIN public.departments d ON d.faculty_id=f.id AND d.name='Computer Science'
  WHERE f.name='Faculty of Physical Sciences'
), seed(id,code,title,units,level,aliases,verify_level) AS (VALUES
  ('nau-csc-csc100','CSC100','Computer Appreciation',2,'100 Level','{}'::text[],false),
  ('nau-csc-csc102','CSC102','Introduction to Computer Programming / Problem Solving',3,'100 Level',ARRAY['COS102'],false),
  ('nau-csc-nau-csc110','NAU-CSC110','Foundation of Computing Science II',3,'100 Level','{}'::text[],false),
  ('nau-csc-nau-csc112','NAU-CSC112','Computer Appreciation and Management',2,'100 Level','{}'::text[],false),
  ('nau-csc-csc202','CSC202','Computer Programming II',3,'200 Level','{}'::text[],false),
  ('nau-csc-csc203','CSC203','Computational Techniques',2,'200 Level','{}'::text[],false),
  ('nau-csc-csc222','CSC222','File Processing & Data Management',2,'200 Level',ARRAY['NAU-CSC222'],false),
  ('nau-csc-csc232','CSC232','Database Design and Management',2,'200 Level',ARRAY['NAU-CSC232'],false),
  ('nau-csc-csc252','CSC252','Data Structure',2,'200 Level',ARRAY['CSC301'],true),
  ('nau-csc-csc299','CSC299','SIWES',3,'200 Level','{}'::text[],false),
  ('nau-csc-csc308','CSC308','Operating System',3,'300 Level','{}'::text[],false),
  ('nau-csc-csc322','CSC322','Computer Science Innovation and New Technologies',3,'300 Level','{}'::text[],false),
  ('nau-csc-csc399','CSC399','SIWES',3,'300 Level','{}'::text[],false),
  ('nau-csc-csc412','CSC412','Computer Graphics & Visualization',2,'400 Level','{}'::text[],false),
  ('nau-csc-csc422','CSC422','Software Development and Management',2,'400 Level','{}'::text[],false),
  ('nau-csc-csc442','CSC442','Computer Modeling and Simulation',2,'400 Level','{}'::text[],false),
  ('nau-csc-csc452','CSC452','Expert System',2,'400 Level','{}'::text[],false),
  ('nau-csc-csc462','CSC462','Computer Installation & Management',2,'400 Level','{}'::text[],false),
  ('nau-csc-csc482','CSC482','Computer Architecture',3,'400 Level','{}'::text[],false)
)
INSERT INTO public.courses(id,code,title,credit_unit,faculty,department,level,semester,faculty_id,department_id,alternate_codes,level_requires_verification,metadata)
SELECT s.id,s.code,s.title,s.units,'Faculty of Physical Sciences','Computer Science',s.level,'Second Semester',h.faculty_id,h.department_id,s.aliases,s.verify_level,
  jsonb_build_object('university','Nnamdi Azikiwe University','campus','Awka','programme','Regular','source_session','2025/2026','import_batch','nau-csc-2025-2026-second-semester')
FROM seed s CROSS JOIN hierarchy h
ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code,title=EXCLUDED.title,credit_unit=EXCLUDED.credit_unit,faculty=EXCLUDED.faculty,department=EXCLUDED.department,level=EXCLUDED.level,semester=EXCLUDED.semester,faculty_id=EXCLUDED.faculty_id,department_id=EXCLUDED.department_id,alternate_codes=EXCLUDED.alternate_codes,level_requires_verification=EXCLUDED.level_requires_verification,metadata=EXCLUDED.metadata;

-- Rollback only this batch:
-- DELETE FROM public.courses WHERE metadata->>'import_batch'='nau-csc-2025-2026-second-semester';
