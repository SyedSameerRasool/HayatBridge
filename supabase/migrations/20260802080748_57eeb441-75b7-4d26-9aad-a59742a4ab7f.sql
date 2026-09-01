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

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_diagnoses_updated_at BEFORE UPDATE ON public.diagnoses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_diagnoses_patient ON public.diagnoses(patient_id);