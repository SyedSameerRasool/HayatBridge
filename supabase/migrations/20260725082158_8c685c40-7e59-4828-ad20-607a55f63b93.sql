
-- 1. Consent fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_fields TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS consent_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_revoked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Seed reasonable defaults for existing rows
UPDATE public.profiles
SET consent_fields = ARRAY['fullName','dateOfBirth','bloodType','allergies','medications','diagnoses'],
    consent_expires_at = now() + interval '24 hours'
WHERE consent_expires_at IS NULL;

-- 2. share_tokens
CREATE TABLE public.share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_value TEXT NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  fields TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by TEXT,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_tokens TO authenticated;
GRANT ALL ON public.share_tokens TO service_role;
ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients manage own share tokens" ON public.share_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);
CREATE INDEX share_tokens_patient_idx ON public.share_tokens (patient_id, created_at DESC);
CREATE INDEX share_tokens_value_idx ON public.share_tokens (token_value);

-- 3. questionnaire_responses
CREATE TABLE public.questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responses JSONB NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionnaire_responses TO authenticated;
GRANT ALL ON public.questionnaire_responses TO service_role;
ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients read own questionnaires" ON public.questionnaire_responses
  FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "Patients insert own questionnaires" ON public.questionnaire_responses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id);
CREATE INDEX questionnaire_patient_time_idx ON public.questionnaire_responses (patient_id, completed_at DESC);

-- 4. Update new-user trigger to seed consent defaults
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, consent_fields, consent_expires_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    ARRAY['fullName','dateOfBirth','bloodType','allergies','medications','diagnoses'],
    now() + interval '24 hours'
  );
  INSERT INTO public.billing_preferences (patient_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'patient');
  RETURN NEW;
END;
$$;
