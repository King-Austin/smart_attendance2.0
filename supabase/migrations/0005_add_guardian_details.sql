-- Add guardian contact details to the profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS guardian_name text,
ADD COLUMN IF NOT EXISTS guardian_phone text,
ADD COLUMN IF NOT EXISTS guardian_email text;
