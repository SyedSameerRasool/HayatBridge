REVOKE ALL ON FUNCTION public.is_prescriber(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_prescriber(uuid) TO authenticated;

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

CREATE POLICY "Patients read own lab reports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lab-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Patients upload own lab reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lab-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Patients delete own lab reports"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'lab-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
