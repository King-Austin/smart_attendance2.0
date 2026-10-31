UPDATE public.profiles
SET course_ids = array_remove(array_remove(course_ids, 'nau-csc-csc299'), 'nau-csc-csc399')
WHERE course_ids && ARRAY['nau-csc-csc299', 'nau-csc-csc399']::text[];

DELETE FROM public.courses
WHERE id IN ('nau-csc-csc299', 'nau-csc-csc399')
   OR upper(btrim(title)) = 'SIWES';
