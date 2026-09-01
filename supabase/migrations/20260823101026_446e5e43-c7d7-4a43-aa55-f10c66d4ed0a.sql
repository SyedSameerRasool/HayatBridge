ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS initial_setup_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_setup_completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.profiles_lock_initial_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce against the patient themself; admin/service_role paths are unaffected.
  IF auth.uid() IS NULL OR auth.uid() <> OLD.id THEN
    RETURN NEW;
  END IF;

  IF OLD.initial_setup_completed THEN
    IF NEW.initial_setup_completed IS DISTINCT FROM OLD.initial_setup_completed THEN
      RAISE EXCEPTION 'Initial setup state cannot be changed.';
    END IF;
    IF NEW.full_name IS DISTINCT FROM OLD.full_name
       OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
       OR NEW.allergies IS DISTINCT FROM OLD.allergies
       OR NEW.diagnoses IS DISTINCT FROM OLD.diagnoses THEN
      RAISE EXCEPTION 'Locked profile fields (name, date of birth, initial allergies, initial diagnoses) cannot be edited after initial setup.';
    END IF;
  ELSE
    -- Marking setup complete also stamps the time.
    IF NEW.initial_setup_completed THEN
      NEW.initial_setup_completed_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.profiles_lock_initial_fields() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_lock_initial_fields ON public.profiles;
CREATE TRIGGER trg_profiles_lock_initial_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_initial_fields();