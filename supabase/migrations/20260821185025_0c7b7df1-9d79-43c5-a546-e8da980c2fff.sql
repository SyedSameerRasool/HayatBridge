-- Roles
CREATE TYPE public.app_role AS ENUM ('patient', 'doctor', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  date_of_birth DATE,
  blood_type TEXT,
  phone TEXT,
  emergency_contact TEXT,
  allergies TEXT,
  medications TEXT,
  diagnoses TEXT,
  recent_reports TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Appointments
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  specialty TEXT,
  location TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients manage own appointments" ON public.appointments FOR ALL TO authenticated USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_appointments_patient_time ON public.appointments(patient_id, scheduled_at DESC);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('patient', 'provider')),
  provider_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients manage own messages" ON public.messages FOR ALL TO authenticated USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);
CREATE INDEX idx_messages_patient_time ON public.messages(patient_id, created_at DESC);

-- Test results
CREATE TABLE public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  category TEXT,
  value TEXT NOT NULL,
  unit TEXT,
  reference_range TEXT,
  flag TEXT CHECK (flag IN ('normal','low','high','critical') OR flag IS NULL),
  ordering_provider TEXT,
  resulted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.test_results TO authenticated;
GRANT ALL ON public.test_results TO service_role;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients read own test results" ON public.test_results FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE INDEX idx_test_results_patient_time ON public.test_results(patient_id, resulted_at DESC);

-- Billing statements
CREATE TABLE public.billing_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_cents INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue')),
  due_date DATE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_statements TO authenticated;
GRANT ALL ON public.billing_statements TO service_role;
ALTER TABLE public.billing_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients read own bills" ON public.billing_statements FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE INDEX idx_billing_patient_time ON public.billing_statements(patient_id, issued_at DESC);

-- Billing preferences
CREATE TABLE public.billing_preferences (
  patient_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  paperless BOOLEAN NOT NULL DEFAULT false,
  delivery_email TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_preferences TO authenticated;
GRANT ALL ON public.billing_preferences TO service_role;
ALTER TABLE public.billing_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients manage own billing prefs" ON public.billing_preferences FOR ALL TO authenticated USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Providers insert test results" ON public.test_results FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.billing_preferences (patient_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'patient');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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

CREATE POLICY "Anyone may append an access event"
  ON public.access_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX access_logs_patient_at_idx ON public.access_logs (patient_id, at DESC);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_fields TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS consent_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_revoked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

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
CREATE TRIGGER trg_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.diagnoses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  condition TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  severity TEXT,
  diagnosed_date DATE,
  resolved_date DATE,
  provider TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnoses TO authenticated;
GRANT ALL ON public.diagnoses TO service_role;

ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view their own diagnoses" ON public.diagnoses FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "Patients can add their own diagnoses" ON public.diagnoses FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Patients can update their own diagnoses" ON public.diagnoses FOR UPDATE TO authenticated USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Patients can delete their own diagnoses" ON public.diagnoses FOR DELETE TO authenticated USING (auth.uid() = patient_id);

CREATE TRIGGER update_diagnoses_updated_at BEFORE UPDATE ON public.diagnoses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_diagnoses_patient ON public.diagnoses(patient_id);