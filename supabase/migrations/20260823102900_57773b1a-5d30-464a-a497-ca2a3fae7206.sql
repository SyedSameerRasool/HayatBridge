-- Harden log_audit_event: require an authenticated actor
CREATE OR REPLACE FUNCTION public.log_audit_event(_action text, _table_name text DEFAULT 'auth'::text, _patient_id uuid DEFAULT NULL::uuid, _record_id text DEFAULT NULL::text, _details jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ip text; ua text; uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'log_audit_event requires an authenticated user';
  END IF;
  BEGIN
    ip := NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', '');
    ua := NULLIF(current_setting('request.headers', true)::json->>'user-agent', '');
  EXCEPTION WHEN others THEN ip := NULL; ua := NULL;
  END;
  INSERT INTO public.audit_logs (user_id, user_role, patient_id, action, table_name, record_id, ip_address, user_agent, details)
  VALUES (uid, public.current_actor_role(), COALESCE(_patient_id, uid),
          left(_action, 80), left(COALESCE(_table_name, 'auth'), 80), _record_id, ip, ua, _details);
END;
$function$;

-- Lock down execution: no PUBLIC/anon access on any SECURITY DEFINER helper
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- Re-grant EXECUTE only where signed-in users genuinely need it
-- (these are referenced directly inside RLS policy predicates or app audit logging)
GRANT EXECUTE ON FUNCTION public.has_active_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_prescriber(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_clinical(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_medication_notes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, text, jsonb) TO authenticated;