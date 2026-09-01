
-- has_role: safe as INVOKER because the user_roles SELECT policy already permits self-reads.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Trigger functions: not for direct callers.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  role text NOT NULL,
  viewer text NOT NULL,
  token_id text,
  device text,
  fields_viewed text[] NOT NULL DEFAULT '{}',
  at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.access_logs TO authenticated;
GRANT SELECT, INSERT ON public.access_logs TO anon;
GRANT ALL ON public.access_logs TO service_role;

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients read their own access logs"
  ON public.access_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = patient_id);

-- Anyone with a patient's share link may append an access event for that patient.
-- We rely on possession of the token/link as the authorization (mirrors current UX).
CREATE POLICY "Anyone may append an access event"
  ON public.access_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX access_logs_patient_at_idx ON public.access_logs (patient_id, at DESC);

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

-- Allergies
CREATE TABLE public.allergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  substance text NOT NULL,
  reaction text,
  severity text NOT NULL DEFAULT 'mild',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allergies TO authenticated;
GRANT ALL ON public.allergies TO service_role;
ALTER TABLE public.allergies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients manage own allergies" ON public.allergies
  FOR ALL TO authenticated
  USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);
CREATE TRIGGER trg_allergies_updated_at
  BEFORE UPDATE ON public.allergies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Medications
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose text,
  frequency text,
  route text,
  prescriber text,
  reason text,
  start_date date,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications TO authenticated;
GRANT ALL ON public.medications TO service_role;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients manage own medications" ON public.medications
  FOR ALL TO authenticated
  USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);
CREATE TRIGGER trg_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
