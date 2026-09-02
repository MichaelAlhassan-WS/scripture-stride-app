ALTER TABLE public.study_logs ADD COLUMN IF NOT EXISTS chapter_end integer;
UPDATE public.study_logs SET chapter_end = chapter WHERE chapter_end IS NULL;
ALTER TABLE public.study_logs ALTER COLUMN minutes DROP NOT NULL;
ALTER TABLE public.study_logs ALTER COLUMN minutes DROP DEFAULT;