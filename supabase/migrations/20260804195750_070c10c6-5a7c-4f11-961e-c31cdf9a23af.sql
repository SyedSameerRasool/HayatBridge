ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cnic text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cnic_key ON public.profiles (cnic) WHERE cnic IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, cnic, consent_fields, consent_expires_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'cnic', ''),
    ARRAY['fullName','dateOfBirth','bloodType','allergies','medications','diagnoses'],
    now() + interval '24 hours'
  );
  INSERT INTO public.billing_preferences (patient_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'patient');
  RETURN NEW;
END;
$function$;