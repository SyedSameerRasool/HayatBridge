ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pharmacist';

ALTER TABLE public.diagnoses ADD COLUMN IF NOT EXISTS icd10_code TEXT;
ALTER TABLE public.diagnoses ADD COLUMN IF NOT EXISTS onset_date DATE;

CREATE OR REPLACE FUNCTION public.is_prescriber(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('doctor', 'pharmacist')
  )
$$;

ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS report_url TEXT;
ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'provider';
ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS patient_notes TEXT;
