
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
