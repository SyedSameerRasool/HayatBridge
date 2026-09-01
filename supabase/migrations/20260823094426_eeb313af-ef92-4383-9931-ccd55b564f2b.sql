-- ============ Helper functions ============
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = ANY(_roles));
$$;
REVOKE ALL ON FUNCTION public.has_any_role(uuid, text[]) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.my_clinician_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT professional_role FROM public.clinicians WHERE user_id = auth.uid() AND verified LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.my_clinician_role() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.has_active_access(_patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.access_requests ar
    JOIN public.clinicians c ON c.user_id = ar.clinician_id AND c.verified
    WHERE ar.clinician_id = auth.uid()
      AND ar.patient_id = _patient_id
      AND ar.status = 'approved'
      AND ar.expires_at IS NOT NULL
      AND ar.expires_at > now()
  );
$$;
REVOKE ALL ON FUNCTION public.has_active_access(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.can_write_clinical(_patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_active_access(_patient_id)
     AND public.my_clinician_role() IN ('doctor', 'emergency_physician');
$$;
REVOKE ALL ON FUNCTION public.can_write_clinical(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.can_write_medication_notes(_patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_active_access(_patient_id)
     AND public.my_clinician_role() IN ('doctor', 'emergency_physician', 'pharmacist', 'nurse');
$$;
REVOKE ALL ON FUNCTION public.can_write_medication_notes(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.current_actor_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT professional_role FROM public.clinicians WHERE user_id = auth.uid() LIMIT 1),
    (SELECT role::text FROM public.user_roles WHERE user_id = auth.uid()
      ORDER BY CASE role::text WHEN 'admin' THEN 0 WHEN 'hospital_admin' THEN 1 ELSE 2 END LIMIT 1),
    'anonymous');
$$;
REVOKE ALL ON FUNCTION public.current_actor_role() FROM PUBLIC, anon;

-- ============ Audit log ============
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_role text NOT NULL DEFAULT 'anonymous',
  patient_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  ip_address text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients read their own audit trail" ON public.audit_logs
  FOR SELECT TO authenticated USING (patient_id = auth.uid() OR user_id = auth.uid());
CREATE POLICY "Admins read all audit entries" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','hospital_admin']));

CREATE INDEX IF NOT EXISTS audit_logs_patient_idx ON public.audit_logs (patient_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec jsonb;
  pid uuid;
  ip text;
BEGIN
  rec := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  BEGIN
    pid := NULLIF(COALESCE(rec->>'patient_id', rec->>'id'), '')::uuid;
  EXCEPTION WHEN others THEN pid := NULL;
  END;
  BEGIN
    ip := NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', '');
  EXCEPTION WHEN others THEN ip := NULL;
  END;
  INSERT INTO public.audit_logs (user_id, user_role, patient_id, action, table_name, record_id, ip_address)
  VALUES (auth.uid(), public.current_actor_role(), pid, TG_OP, TG_TABLE_NAME, rec->>'id', ip);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- ============ New clinical tables ============
CREATE TABLE public.vaccinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vaccine_name text NOT NULL,
  dose_number integer,
  administered_on date,
  provider text,
  lot_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaccinations TO authenticated;
GRANT ALL ON public.vaccinations TO service_role;
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients manage own vaccinations" ON public.vaccinations
  FOR ALL TO authenticated USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Granted clinicians read vaccinations" ON public.vaccinations
  FOR SELECT TO authenticated USING (public.has_active_access(patient_id));
CREATE POLICY "Doctors add vaccinations" ON public.vaccinations
  FOR INSERT TO authenticated WITH CHECK (public.can_write_clinical(patient_id));

CREATE TABLE public.procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  performed_on date,
  provider text,
  facility text,
  outcome text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedures TO authenticated;
GRANT ALL ON public.procedures TO service_role;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients manage own procedures" ON public.procedures
  FOR ALL TO authenticated USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Granted clinicians read procedures" ON public.procedures
  FOR SELECT TO authenticated USING (public.has_active_access(patient_id));
CREATE POLICY "Doctors add procedures" ON public.procedures
  FOR INSERT TO authenticated WITH CHECK (public.can_write_clinical(patient_id));

CREATE TABLE public.imaging_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modality text NOT NULL,
  body_part text,
  performed_on date,
  facility text,
  ordering_provider text,
  findings text,
  impression text,
  report_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imaging_reports TO authenticated;
GRANT ALL ON public.imaging_reports TO service_role;
ALTER TABLE public.imaging_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients manage own imaging" ON public.imaging_reports
  FOR ALL TO authenticated USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Granted clinicians read imaging" ON public.imaging_reports
  FOR SELECT TO authenticated USING (public.has_active_access(patient_id));
CREATE POLICY "Doctors add imaging" ON public.imaging_reports
  FOR INSERT TO authenticated WITH CHECK (public.can_write_clinical(patient_id));

CREATE TABLE public.clinical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT '',
  author_role text NOT NULL DEFAULT 'doctor',
  note_type text NOT NULL DEFAULT 'consultation',
  encounter_date timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_notes TO authenticated;
GRANT ALL ON public.clinical_notes TO service_role;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients read own clinical notes" ON public.clinical_notes
  FOR SELECT TO authenticated USING (patient_id = auth.uid());
CREATE POLICY "Granted clinicians read clinical notes" ON public.clinical_notes
  FOR SELECT TO authenticated USING (public.has_active_access(patient_id));
CREATE POLICY "Clinicians add clinical notes" ON public.clinical_notes
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_write_medication_notes(patient_id));
CREATE POLICY "Authors update own notes" ON public.clinical_notes
  FOR UPDATE TO authenticated USING (author_id = auth.uid() AND public.has_active_access(patient_id))
  WITH CHECK (author_id = auth.uid());

CREATE TABLE public.medication_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES public.medications(id) ON DELETE SET NULL,
  medication_name text NOT NULL,
  action text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name text NOT NULL DEFAULT '',
  changed_by_role text NOT NULL DEFAULT 'patient',
  details text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.medication_history TO authenticated;
GRANT ALL ON public.medication_history TO service_role;
ALTER TABLE public.medication_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients read own medication history" ON public.medication_history
  FOR SELECT TO authenticated USING (patient_id = auth.uid());
CREATE POLICY "Patients add own medication history" ON public.medication_history
  FOR INSERT TO authenticated WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Granted clinicians read medication history" ON public.medication_history
  FOR SELECT TO authenticated USING (public.has_active_access(patient_id));
CREATE POLICY "Clinicians add medication history" ON public.medication_history
  FOR INSERT TO authenticated WITH CHECK (public.can_write_medication_notes(patient_id));

CREATE TABLE public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text,
  phone text,
  email text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_contacts TO authenticated;
GRANT ALL ON public.emergency_contacts TO service_role;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients manage own emergency contacts" ON public.emergency_contacts
  FOR ALL TO authenticated USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Granted clinicians read emergency contacts" ON public.emergency_contacts
  FOR SELECT TO authenticated USING (public.has_active_access(patient_id));

CREATE TABLE public.medical_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item text NOT NULL,
  category text NOT NULL DEFAULT 'condition',
  occurred_on date,
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_history TO authenticated;
GRANT ALL ON public.medical_history TO service_role;
ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients manage own medical history" ON public.medical_history
  FOR ALL TO authenticated USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Granted clinicians read medical history" ON public.medical_history
  FOR SELECT TO authenticated USING (public.has_active_access(patient_id));
CREATE POLICY "Doctors add medical history" ON public.medical_history
  FOR INSERT TO authenticated WITH CHECK (public.can_write_clinical(patient_id));

-- updated_at triggers
CREATE TRIGGER trg_vaccinations_updated_at BEFORE UPDATE ON public.vaccinations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_procedures_updated_at BEFORE UPDATE ON public.procedures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_imaging_updated_at BEFORE UPDATE ON public.imaging_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clinical_notes_updated_at BEFORE UPDATE ON public.clinical_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_emergency_contacts_updated_at BEFORE UPDATE ON public.emergency_contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_medical_history_updated_at BEFORE UPDATE ON public.medical_history FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Clinician read access to existing clinical tables ============
CREATE POLICY "Granted clinicians read allergies" ON public.allergies
  FOR SELECT TO authenticated USING (public.has_active_access(patient_id));
CREATE POLICY "Granted clinicians read medications" ON public.medications
  FOR SELECT TO authenticated USING (public.has_active_access(patient_id));
CREATE POLICY "Granted clinicians read diagnoses" ON public.diagnoses
  FOR SELECT TO authenticated USING (public.has_active_access(patient_id));
CREATE POLICY "Granted clinicians read test results" ON public.test_results
  FOR SELECT TO authenticated USING (public.has_active_access(patient_id));
CREATE POLICY "Granted clinicians read profile" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_active_access(id));

CREATE POLICY "Doctors add diagnoses" ON public.diagnoses
  FOR INSERT TO authenticated WITH CHECK (public.can_write_clinical(patient_id));
CREATE POLICY "Doctors update diagnoses" ON public.diagnoses
  FOR UPDATE TO authenticated USING (public.can_write_clinical(patient_id)) WITH CHECK (public.can_write_clinical(patient_id));
CREATE POLICY "Granted prescribers add medications" ON public.medications
  FOR INSERT TO authenticated WITH CHECK (public.can_write_medication_notes(patient_id));
CREATE POLICY "Granted prescribers update medications" ON public.medications
  FOR UPDATE TO authenticated USING (public.can_write_medication_notes(patient_id)) WITH CHECK (public.can_write_medication_notes(patient_id));
CREATE POLICY "Doctors add allergies" ON public.allergies
  FOR INSERT TO authenticated WITH CHECK (public.can_write_clinical(patient_id));

-- ============ Hospital administrators manage clinician verification ============
CREATE POLICY "Hospital admins read clinicians" ON public.clinicians
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','hospital_admin']));
CREATE POLICY "Hospital admins verify clinicians" ON public.clinicians
  FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','hospital_admin']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','hospital_admin']));
CREATE POLICY "Hospital admins read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','hospital_admin']));

-- ============ Audit triggers ============
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_allergies AFTER INSERT OR UPDATE OR DELETE ON public.allergies FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_medications AFTER INSERT OR UPDATE OR DELETE ON public.medications FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_diagnoses AFTER INSERT OR UPDATE OR DELETE ON public.diagnoses FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_test_results AFTER INSERT OR UPDATE OR DELETE ON public.test_results FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_share_tokens AFTER INSERT OR UPDATE OR DELETE ON public.share_tokens FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_access_requests AFTER INSERT OR UPDATE OR DELETE ON public.access_requests FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_clinicians AFTER INSERT OR UPDATE OR DELETE ON public.clinicians FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_appointments AFTER INSERT OR UPDATE OR DELETE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_questionnaire AFTER INSERT OR UPDATE OR DELETE ON public.questionnaire_responses FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_vaccinations AFTER INSERT OR UPDATE OR DELETE ON public.vaccinations FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_procedures AFTER INSERT OR UPDATE OR DELETE ON public.procedures FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_imaging AFTER INSERT OR UPDATE OR DELETE ON public.imaging_reports FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_clinical_notes AFTER INSERT OR UPDATE OR DELETE ON public.clinical_notes FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_medication_history AFTER INSERT OR UPDATE OR DELETE ON public.medication_history FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_emergency_contacts AFTER INSERT OR UPDATE OR DELETE ON public.emergency_contacts FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_medical_history AFTER INSERT OR UPDATE OR DELETE ON public.medical_history FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();