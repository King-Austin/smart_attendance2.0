-- ============================================================
-- Smart Campus Presence - EEE Curriculum Seed
-- Adds the `level` column to courses and replaces the legacy
-- five-course seed with the full Electrical and Electronic
-- Engineering curriculum by level (matches src/data/mockData.ts).
-- Safe to run on databases where 0001 already seeded the old
-- ECE 50x courses.
-- ============================================================

-- 1. Add level column (idempotent for fresh installs that already
--    include it via the updated 0001 migration).
alter table public.courses
  add column if not exists level text;

-- 2. Remove rows that depend on the legacy seed courses before
--    deleting them (FK: attendance_records / attendance_sessions).
delete from public.attendance_records
  where course_id in ('ece501', 'ece503', 'ece505', 'ece507', 'ece509');

delete from public.attendance_sessions
  where course_id in ('ece501', 'ece503', 'ece505', 'ece507', 'ece509');

delete from public.courses
  where id in ('ece501', 'ece503', 'ece505', 'ece507', 'ece509');

-- 3. Seed the full curriculum.
insert into public.courses (id, code, title, credit_unit, department, level, lecturer)
values
  -- 100 Level
  ('chm103', 'CHM 103', 'Basic Organic Chemistry', 2, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Emeka Obi'),
  ('chm111', 'CHM 111', 'General Basic Inorganic Chemistry', 2, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Emeka Obi'),
  ('chm117', 'CHM 117', 'Basic Practical Chemistry', 2, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Emeka Obi'),
  ('chm121', 'CHM 121', 'Basic General Physical Chemistry', 2, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Emeka Obi'),
  ('eee131', 'EEE 131', 'Circuit Theory I', 2, 'Electrical and Electronic Engineering', '100 Level', 'Prof. Adewale Ogunlade'),
  ('gec101', 'GEC 101', 'Introduction to Business', 2, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Sarah Adebayo'),
  ('gst101', 'GST 101', 'Use of English I', 2, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Sarah Adebayo'),
  ('gst102', 'GST 102', 'Humanities', 2, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Sarah Adebayo'),
  ('gst103', 'GST 103', 'Nigerian Peoples and Culture', 2, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Hauwa Yusuf'),
  ('gst111', 'GST 111', 'Use of English II', 2, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Sarah Adebayo'),
  ('gst112', 'GST 112', 'Introduction to Logic and Philosophy', 2, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Sarah Adebayo'),
  ('mth101', 'MTH 101', 'Elementary Mathematics I', 3, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Chidi Okafor'),
  ('mth111', 'MTH 111', 'Engineering Mathematics I', 3, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Chidi Okafor'),
  ('mth112', 'MTH 112', 'Elementary Mathematics II', 3, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Chidi Okafor'),
  ('mth121', 'MTH 121', 'Engineering Mathematics II', 3, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Chidi Okafor'),
  ('phy101', 'PHY 101', 'General Physics I', 3, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Hauwa Yusuf'),
  ('phy107', 'PHY 107', 'General Physics Laboratory I', 1, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Hauwa Yusuf'),
  ('phy112', 'PHY 112', 'General Physics II', 3, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Hauwa Yusuf'),
  ('phy117', 'PHY 117', 'General Physics Laboratory II', 1, 'Electrical and Electronic Engineering', '100 Level', 'Dr. Hauwa Yusuf'),
  -- 200 Level
  ('chm211', 'CHM 211', 'General Physical Chemistry', 2, 'Electrical and Electronic Engineering', '200 Level', 'Dr. Emeka Obi'),
  ('eee231', 'EEE 231', 'Applied Electricity I', 2, 'Electrical and Electronic Engineering', '200 Level', 'Prof. Ibrahim Sanusi'),
  ('eee241', 'EEE 241', 'Applied Electricity II', 3, 'Electrical and Electronic Engineering', '200 Level', 'Prof. Ibrahim Sanusi'),
  ('gec202', 'GEC 202', 'Principles Management', 2, 'Electrical and Electronic Engineering', '200 Level', 'Dr. Sarah Adebayo'),
  ('gec203', 'GEC 203', 'Engineers in Society', 2, 'Electrical and Electronic Engineering', '200 Level', 'Dr. Sarah Adebayo'),
  ('gec211', 'GEC 211', 'Computer Programming I', 2, 'Electrical and Electronic Engineering', '200 Level', 'Dr. Kemi Alabi'),
  ('gec212', 'GEC 212', 'Computer Programming II', 2, 'Electrical and Electronic Engineering', '200 Level', 'Dr. Kemi Alabi'),
  ('gec221', 'GEC 221', 'Workshop Practice I', 2, 'Electrical and Electronic Engineering', '200 Level', 'Engr. Musa Danjuma'),
  ('gec222', 'GEC 222', 'Engineering Drawing I', 2, 'Electrical and Electronic Engineering', '200 Level', 'Engr. Musa Danjuma'),
  ('gec223', 'GEC 223', 'Engineering Drawing II', 2, 'Electrical and Electronic Engineering', '200 Level', 'Engr. Musa Danjuma'),
  ('gec224', 'GEC 224', 'Workshop Practice II', 2, 'Electrical and Electronic Engineering', '200 Level', 'Engr. Musa Danjuma'),
  ('mec211', 'MEC 211', 'Applied Mechanics I (Statical)', 2, 'Electrical and Electronic Engineering', '200 Level', 'Engr. Musa Danjuma'),
  ('mec212', 'MEC 212', 'Applied Mechanics II (Dynamics)', 2, 'Electrical and Electronic Engineering', '200 Level', 'Engr. Musa Danjuma'),
  ('mec213', 'MEC 213', 'Fluid Mechanics I', 2, 'Electrical and Electronic Engineering', '200 Level', 'Engr. Musa Danjuma'),
  ('mec221', 'MEC 221', 'Principles of Material Science', 2, 'Electrical and Electronic Engineering', '200 Level', 'Engr. Musa Danjuma'),
  ('mec231', 'MEC 231', 'Strength of Materials I', 3, 'Electrical and Electronic Engineering', '200 Level', 'Engr. Musa Danjuma'),
  ('mec242', 'MEC 242', 'Thermodynamics', 2, 'Electrical and Electronic Engineering', '200 Level', 'Prof. Ngozi Eze'),
  ('mth201', 'MTH 201', 'Linear Algebra', 3, 'Electrical and Electronic Engineering', '200 Level', 'Dr. Chidi Okafor'),
  ('mth211', 'MTH 211', 'Elementary Differential Equations', 3, 'Electrical and Electronic Engineering', '200 Level', 'Dr. Chidi Okafor'),
  -- 300 Level
  ('eee331', 'EEE 331', 'Circuit Theory II', 2, 'Electrical and Electronic Engineering', '300 Level', 'Prof. Adewale Ogunlade'),
  ('eee332', 'EEE 332', 'Electromechanical Devices & Machines I', 2, 'Electrical and Electronic Engineering', '300 Level', 'Prof. Ibrahim Sanusi'),
  ('eee333', 'EEE 333', 'Electromagnetic Fields & Waves', 3, 'Electrical and Electronic Engineering', '300 Level', 'Prof. Adewale Ogunlade'),
  ('eee335', 'EEE 335', 'Power Systems', 3, 'Electrical and Electronic Engineering', '300 Level', 'Prof. Ibrahim Sanusi'),
  ('eee341', 'EEE 341', 'Telecommunication I', 2, 'Electrical and Electronic Engineering', '300 Level', 'Assoc. Prof. Fatima Bello'),
  ('eee342', 'EEE 342', 'Electronic Devices & Circuits I', 2, 'Electrical and Electronic Engineering', '300 Level', 'Prof. Adewale Ogunlade'),
  ('eee343', 'EEE 343', 'Signal Analysis & Systems', 2, 'Electrical and Electronic Engineering', '300 Level', 'Dr. Adaeze Nwosu'),
  ('eee344', 'EEE 344', 'Digital System Design I', 2, 'Electrical and Electronic Engineering', '300 Level', 'Dr. Tunde Balogun'),
  ('eee351', 'EEE 351', 'Circuit Theory III', 2, 'Electrical and Electronic Engineering', '300 Level', 'Prof. Adewale Ogunlade'),
  ('eee352', 'EEE 352', 'Electromechanical Devices & Machines II', 2, 'Electrical and Electronic Engineering', '300 Level', 'Prof. Ibrahim Sanusi'),
  ('eee353', 'EEE 353', 'Electrodynamics', 2, 'Electrical and Electronic Engineering', '300 Level', 'Prof. Adewale Ogunlade'),
  ('eee354', 'EEE 354', 'Instrumentation & Measurement I', 2, 'Electrical and Electronic Engineering', '300 Level', 'Dr. Tunde Balogun'),
  ('eee361', 'EEE 361', 'Feedback & Control Systems', 3, 'Electrical and Electronic Engineering', '300 Level', 'Dr. Adaeze Nwosu'),
  ('eee362', 'EEE 362', 'Telecommunication II', 2, 'Electrical and Electronic Engineering', '300 Level', 'Assoc. Prof. Fatima Bello'),
  ('eee363', 'EEE 363', 'Physical Electronics', 3, 'Electrical and Electronic Engineering', '300 Level', 'Prof. Adewale Ogunlade'),
  ('eee364', 'EEE 364', 'Electronic Devices & Circuits II', 2, 'Electrical and Electronic Engineering', '300 Level', 'Prof. Adewale Ogunlade'),
  ('eee365', 'EEE 365', 'Digital System Design II', 2, 'Electrical and Electronic Engineering', '300 Level', 'Dr. Tunde Balogun'),
  ('gst312', 'GST 312', 'Introduction to Philosophy & Logic', 2, 'Electrical and Electronic Engineering', '300 Level', 'Dr. Sarah Adebayo'),
  ('mth311', 'MTH 311', 'Engineering Mathematics III', 3, 'Electrical and Electronic Engineering', '300 Level', 'Dr. Chidi Okafor'),
  -- 400 Level
  ('eee431', 'EEE 431', 'Circuit Theory IV', 3, 'Electrical and Electronic Engineering', '400 Level', 'Prof. Adewale Ogunlade'),
  ('eee432', 'EEE 432', 'Instrumentation & Measurement II', 3, 'Electrical and Electronic Engineering', '400 Level', 'Dr. Tunde Balogun'),
  ('eee441', 'EEE 441', 'Microprocessors & Microcomputers', 3, 'Electrical and Electronic Engineering', '400 Level', 'Dr. Tunde Balogun'),
  ('eee442', 'EEE 442', 'Assembly Language Programming', 2, 'Electrical and Electronic Engineering', '400 Level', 'Dr. Tunde Balogun'),
  ('eee443', 'EEE 443', 'Advance Circuit Techniques', 3, 'Electrical and Electronic Engineering', '400 Level', 'Prof. Adewale Ogunlade'),
  ('eee451', 'EEE 451', 'Fundamentals of Digital Communication', 3, 'Electrical and Electronic Engineering', '400 Level', 'Assoc. Prof. Fatima Bello'),
  ('gec402', 'GEC 402', 'Engineering Contracts & Specifications', 2, 'Electrical and Electronic Engineering', '400 Level', 'Dr. Sarah Adebayo'),
  ('mth411', 'MTH 411', 'Engineering Mathematics IV', 3, 'Electrical and Electronic Engineering', '400 Level', 'Dr. Chidi Okafor'),
  -- 500 Level
  ('eee501', 'EEE 501', 'Computer Aided Design', 3, 'Electrical and Electronic Engineering', '500 Level', 'Prof. Ngozi Eze'),
  ('eee502', 'EEE 502', 'Real Time Computing & Control', 3, 'Electrical and Electronic Engineering', '500 Level', 'Dr. Adaeze Nwosu'),
  ('eee503', 'EEE 503', 'Solid State Electronics', 3, 'Electrical and Electronic Engineering', '500 Level', 'Prof. Adewale Ogunlade'),
  ('eee504', 'EEE 504', 'Digital Signal Processing', 3, 'Electrical and Electronic Engineering', '500 Level', 'Dr. Adaeze Nwosu'),
  ('eee505', 'EEE 505', 'Computer Architecture & System Programming', 3, 'Electrical and Electronic Engineering', '500 Level', 'Dr. Tunde Balogun'),
  ('eee506', 'EEE 506', 'Artificial Intelligence & Robotics', 3, 'Electrical and Electronic Engineering', '500 Level', 'Dr. Kemi Alabi'),
  ('eee507', 'EEE 507', 'Seminar', 2, 'Electrical and Electronic Engineering', '500 Level', 'Prof. Ngozi Eze'),
  ('eee508', 'EEE 508', 'Data Communication Network', 3, 'Electrical and Electronic Engineering', '500 Level', 'Assoc. Prof. Fatima Bello'),
  ('eee509', 'EEE 509', 'Database Management Systems', 3, 'Electrical and Electronic Engineering', '500 Level', 'Dr. Kemi Alabi'),
  ('eee510', 'EEE 510', 'Software Engineering', 3, 'Electrical and Electronic Engineering', '500 Level', 'Dr. Kemi Alabi'),
  ('eee511', 'EEE 511', 'Network Analysis and Synthesis', 3, 'Electrical and Electronic Engineering', '500 Level', 'Dr. Adaeze Nwosu'),
  ('eee512', 'EEE 512', 'Control System Engineering', 3, 'Electrical and Electronic Engineering', '500 Level', 'Dr. Adaeze Nwosu')
on conflict (id) do nothing;
