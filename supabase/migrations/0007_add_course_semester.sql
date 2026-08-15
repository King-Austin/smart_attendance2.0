-- Add semester column to courses table
alter table public.courses add column if not exists semester text not null default 'First Semester';

-- Dynamically infer semester from the course code digits (e.g. 101 -> First Semester, 102 -> Second Semester)
update public.courses
set semester = 'Second Semester'
where substring(code from '[0-9]+')::int % 2 = 0;

update public.courses
set semester = 'First Semester'
where substring(code from '[0-9]+')::int % 2 = 1;
