-- Persist the academic faculty selected by administrators so registration
-- selectors can discover newly-created faculties from the live catalogue.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS faculty text;

UPDATE public.courses
SET faculty = CASE
  WHEN department IN ('Electrical and Electronic Engineering', 'Computer Engineering', 'Mechanical Engineering', 'Civil Engineering')
    THEN 'Faculty of Engineering'
  WHEN department = 'Computer Science' THEN 'Faculty of Science'
  ELSE 'Faculty of Engineering'
END
WHERE faculty IS NULL OR btrim(faculty) = '';

ALTER TABLE public.courses
  ALTER COLUMN faculty SET DEFAULT 'Faculty of Engineering';
