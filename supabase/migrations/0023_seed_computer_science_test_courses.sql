INSERT INTO public.faculties(name)
VALUES ('Faculty of Physical Sciences')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.departments(faculty_id, name)
SELECT id, 'Computer Science'
FROM public.faculties
WHERE name = 'Faculty of Physical Sciences'
ON CONFLICT (faculty_id, name) DO NOTHING;

WITH hierarchy AS (
  SELECT f.id AS faculty_id, d.id AS department_id
  FROM public.faculties f
  JOIN public.departments d ON d.faculty_id = f.id
  WHERE f.name = 'Faculty of Physical Sciences'
    AND d.name = 'Computer Science'
), seed(id, code, title, units, level, semester) AS (VALUES
  ('test-csc-101', 'CSC101', 'Introduction to Computer Science (_test)', 3, '100 Level', 'First Semester'),
  ('test-csc-103', 'CSC103', 'Digital Literacy and Information Systems (_test)', 2, '100 Level', 'First Semester'),
  ('test-csc-105', 'CSC105', 'Computational Thinking Fundamentals (_test)', 2, '100 Level', 'First Semester'),
  ('test-csc-104', 'CSC104', 'Structured Programming Fundamentals (_test)', 3, '100 Level', 'Second Semester'),
  ('test-csc-106', 'CSC106', 'Computer Hardware and Logic Systems (_test)', 2, '100 Level', 'Second Semester'),
  ('test-csc-108', 'CSC108', 'Introduction to Web Technologies (_test)', 2, '100 Level', 'Second Semester'),
  ('test-csc-201', 'CSC201', 'Object-Oriented Programming (_test)', 3, '200 Level', 'First Semester'),
  ('test-csc-211', 'CSC211', 'Discrete Structures for Computing (_test)', 3, '200 Level', 'First Semester'),
  ('test-csc-221', 'CSC221', 'Data Structures and Abstractions (_test)', 3, '200 Level', 'First Semester'),
  ('test-csc-204', 'CSC204', 'Algorithm Design and Analysis (_test)', 3, '200 Level', 'Second Semester'),
  ('test-csc-214', 'CSC214', 'Systems Analysis and Design (_test)', 3, '200 Level', 'Second Semester'),
  ('test-csc-224', 'CSC224', 'Relational Database Systems (_test)', 3, '200 Level', 'Second Semester'),
  ('test-csc-303', 'CSC303', 'Software Engineering Principles (_test)', 3, '300 Level', 'First Semester'),
  ('test-csc-313', 'CSC313', 'Data Communications and Networks (_test)', 3, '300 Level', 'First Semester'),
  ('test-csc-323', 'CSC323', 'Theory of Computation (_test)', 3, '300 Level', 'First Semester'),
  ('test-csc-304', 'CSC304', 'Human-Computer Interaction (_test)', 2, '300 Level', 'Second Semester'),
  ('test-csc-314', 'CSC314', 'Compiler Construction (_test)', 3, '300 Level', 'Second Semester'),
  ('test-csc-324', 'CSC324', 'Web Application Engineering (_test)', 3, '300 Level', 'Second Semester'),
  ('test-csc-401', 'CSC401', 'Artificial Intelligence (_test)', 3, '400 Level', 'First Semester'),
  ('test-csc-411', 'CSC411', 'Distributed Computing Systems (_test)', 3, '400 Level', 'First Semester'),
  ('test-csc-421', 'CSC421', 'Cybersecurity Principles (_test)', 3, '400 Level', 'First Semester'),
  ('test-csc-404', 'CSC404', 'Machine Learning Applications (_test)', 3, '400 Level', 'Second Semester'),
  ('test-csc-414', 'CSC414', 'Cloud Computing Architecture (_test)', 3, '400 Level', 'Second Semester'),
  ('test-csc-424', 'CSC424', 'Computer Science Research Methods (_test)', 2, '400 Level', 'Second Semester'),
  ('test-csc-501', 'CSC501', 'Advanced Algorithmic Techniques (_test)', 3, '500 Level', 'First Semester'),
  ('test-csc-511', 'CSC511', 'Data Mining and Knowledge Discovery (_test)', 3, '500 Level', 'First Semester'),
  ('test-csc-521', 'CSC521', 'Advanced Database Systems (_test)', 3, '500 Level', 'First Semester'),
  ('test-csc-502', 'CSC502', 'Deep Learning Systems (_test)', 3, '500 Level', 'Second Semester'),
  ('test-csc-512', 'CSC512', 'Big Data Analytics (_test)', 3, '500 Level', 'Second Semester'),
  ('test-csc-522', 'CSC522', 'Advanced Computer Science Seminar (_test)', 2, '500 Level', 'Second Semester')
)
INSERT INTO public.courses (
  id, code, title, credit_unit, faculty, department, level, semester,
  faculty_id, department_id, alternate_codes, level_requires_verification, metadata
)
SELECT
  seed.id, seed.code, seed.title, seed.units,
  'Faculty of Physical Sciences', 'Computer Science', seed.level, seed.semester,
  hierarchy.faculty_id, hierarchy.department_id, '{}'::text[], false,
  jsonb_build_object('import_batch', 'computer-science-test-courses-v1', 'generated', true)
FROM seed
CROSS JOIN hierarchy
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  title = EXCLUDED.title,
  credit_unit = EXCLUDED.credit_unit,
  faculty = EXCLUDED.faculty,
  department = EXCLUDED.department,
  level = EXCLUDED.level,
  semester = EXCLUDED.semester,
  faculty_id = EXCLUDED.faculty_id,
  department_id = EXCLUDED.department_id,
  alternate_codes = EXCLUDED.alternate_codes,
  level_requires_verification = EXCLUDED.level_requires_verification,
  metadata = EXCLUDED.metadata;

-- Rollback only this generated test batch:
-- DELETE FROM public.courses WHERE metadata->>'import_batch' = 'computer-science-test-courses-v1';
