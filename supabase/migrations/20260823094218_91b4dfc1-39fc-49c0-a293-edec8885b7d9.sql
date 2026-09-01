CREATE TABLE public.clinicians (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  professional_role text NOT NULL DEFAULT 'doctor',
  hospital text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT '',
  license_no text NOT NULL DEFAULT '',
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinicians_role_check CHECK (professional_role IN ('doctor','pharmacist','nurse','emergency_physician'))
);

GRANT SELECT, INSERT, UPDATE ON public.clinicians TO authenticated;
GRANT ALL ON public.clinicians TO service_role;
ALTER TABLE public.clinicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinicians view own record" ON public.clinicians
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Clinicians create own record" ON public.clinicians
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND verified = false);
CREATE POLICY "Clinicians edit own unverified record" ON public.clinicians
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND verified = false)
  WITH CHECK (auth.uid() = user_id AND verified = false);
CREATE POLICY "Admins view all clinicians" ON public.clinicians
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update clinicians" ON public.clinicians
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_clinicians_updated_at BEFORE UPDATE ON public.clinicians
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES public.share_tokens(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinician_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinician_name text NOT NULL,
  clinician_role text NOT NULL,
  hospital text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT '',
  license_no text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_requests_status_check CHECK (status IN ('pending','approved','denied','revoked'))
);

CREATE INDEX idx_access_requests_patient ON public.access_requests (patient_id, status);
CREATE INDEX idx_access_requests_clinician ON public.access_requests (clinician_id, status);

GRANT SELECT, INSERT, UPDATE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own access requests" ON public.access_requests
  FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "Patients decide own access requests" ON public.access_requests
  FOR UPDATE TO authenticated USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Clinicians view own access requests" ON public.access_requests
  FOR SELECT TO authenticated USING (auth.uid() = clinician_id);
CREATE POLICY "Clinicians create own access requests" ON public.access_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = clinician_id);
CREATE POLICY "Admins view all access requests" ON public.access_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_access_requests_updated_at BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();