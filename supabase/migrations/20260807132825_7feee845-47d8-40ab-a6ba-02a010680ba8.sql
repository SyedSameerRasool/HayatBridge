DROP POLICY IF EXISTS "Patients manage own medications" ON public.medications;

CREATE POLICY "Patients read own medications"
ON public.medications FOR SELECT TO authenticated
USING (auth.uid() = patient_id);

CREATE POLICY "Prescribers insert medications"
ON public.medications FOR INSERT TO authenticated
WITH CHECK (public.is_prescriber(auth.uid()));

CREATE POLICY "Prescribers update medications"
ON public.medications FOR UPDATE TO authenticated
USING (public.is_prescriber(auth.uid()))
WITH CHECK (public.is_prescriber(auth.uid()));

CREATE POLICY "Prescribers delete medications"
ON public.medications FOR DELETE TO authenticated
USING (public.is_prescriber(auth.uid()));

CREATE POLICY "Patients upload own test results"
ON public.test_results FOR INSERT TO authenticated
WITH CHECK (auth.uid() = patient_id AND source = 'patient_upload');

CREATE POLICY "Patients delete own uploaded test results"
ON public.test_results FOR DELETE TO authenticated
USING (auth.uid() = patient_id AND source = 'patient_upload');

REVOKE ALL ON FUNCTION public.is_prescriber(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_prescriber(uuid) TO authenticated;

CREATE POLICY "Patients read own lab reports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lab-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Patients upload own lab reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lab-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Patients delete own lab reports"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'lab-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cnic text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cnic_key ON public.profiles (cnic) WHERE cnic IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

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
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'open',
  admin_reply text,
  replied_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients insert own feedback" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Patients read own feedback" ON public.feedback
  FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "Admins read all feedback" ON public.feedback
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update feedback" ON public.feedback
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_feedback_updated_at BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read published announcements" ON public.announcements
  FOR SELECT TO authenticated USING (published = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert announcements" ON public.announcements
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update announcements" ON public.announcements
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete announcements" ON public.announcements
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_activity_logs TO authenticated;
GRANT ALL ON public.admin_activity_logs TO service_role;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read activity logs" ON public.admin_activity_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write own activity logs" ON public.admin_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at ON public.admin_activity_logs (created_at DESC);

CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update account status" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all share tokens" ON public.share_tokens
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all access logs" ON public.access_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));