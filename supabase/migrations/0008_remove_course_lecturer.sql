-- Remove lecturer column from courses table
alter table public.courses drop column if exists lecturer;
