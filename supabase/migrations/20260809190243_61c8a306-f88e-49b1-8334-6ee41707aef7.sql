CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============ 1. Server-only secret store + PHI crypto helpers ============
CREATE TABLE IF NOT EXISTS public.app_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_secrets TO service_role;
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
-- No policies: unreachable by anon/authenticated by design.

INSERT INTO public.app_secrets (name, value)
VALUES ('phi_key', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.phi_encrypt(_v text)
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT CASE WHEN _v IS NULL OR _v = '' THEN NULL
    ELSE armor(pgp_sym_encrypt(_v, (SELECT value FROM public.app_secrets WHERE name = 'phi_key')))
  END;
$$;

CREATE OR REPLACE FUNCTION public.phi_decrypt(_v text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT CASE WHEN _v IS NULL OR _v = '' THEN NULL
    ELSE pgp_sym_decrypt(dearmor(_v), (SELECT value FROM public.app_secrets WHERE name = 'phi_key'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.phi_hash(_v text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT CASE WHEN _v IS NULL OR _v = '' THEN NULL
    ELSE encode(hmac(_v, (SELECT value FROM public.app_secrets WHERE name = 'phi_key'), 'sha256'), 'hex')
  END;
$$;

REVOKE ALL ON FUNCTION public.phi_encrypt(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phi_decrypt(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phi_hash(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phi_encrypt(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.phi_decrypt(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.phi_hash(text) TO service_role;

-- ============ 2. Encrypt personal identifier (CNIC) at rest ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cnic_enc text,
  ADD COLUMN IF NOT EXISTS cnic_hash text;

CREATE OR REPLACE FUNCTION public.profiles_protect_identifiers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.cnic IS NOT NULL AND NEW.cnic <> '' THEN
    NEW.cnic_enc := public.phi_encrypt(regexp_replace(NEW.cnic, '\D', '', 'g'));
    NEW.cnic_hash := public.phi_hash(regexp_replace(NEW.cnic, '\D', '', 'g'));
    NEW.cnic := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_identifiers ON public.profiles;
CREATE TRIGGER trg_profiles_protect_identifiers
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_identifiers();

UPDATE public.profiles
SET cnic_enc = public.phi_encrypt(regexp_replace(cnic, '\D', '', 'g')),
    cnic_hash = public.phi_hash(regexp_replace(cnic, '\D', '', 'g')),
    cnic = NULL
WHERE cnic IS NOT NULL AND cnic <> '';

CREATE INDEX IF NOT EXISTS profiles_cnic_hash_idx ON public.profiles (cnic_hash);

-- ============ 3. Clinician verification fields ============
ALTER TABLE public.clinicians
  ADD COLUMN IF NOT EXISTS work_email text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.clinicians DROP CONSTRAINT IF EXISTS clinicians_verification_status_check;
ALTER TABLE public.clinicians ADD CONSTRAINT clinicians_verification_status_check
  CHECK (verification_status IN ('pending', 'verified', 'rejected'));

CREATE OR REPLACE FUNCTION public.clinicians_sync_verification()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.verified THEN
    NEW.verification_status := 'verified';
  ELSIF COALESCE(NEW.verification_status, 'pending') = 'verified' THEN
    NEW.verification_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinicians_sync_verification ON public.clinicians;
CREATE TRIGGER trg_clinicians_sync_verification
  BEFORE INSERT OR UPDATE ON public.clinicians
  FOR EACH ROW EXECUTE FUNCTION public.clinicians_sync_verification();

UPDATE public.clinicians SET verification_status = CASE WHEN verified THEN 'verified' ELSE 'pending' END;

-- ============ 4. Expanded audit logging ============
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS session_ref text;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _table_name text DEFAULT 'auth',
  _patient_id uuid DEFAULT NULL,
  _record_id text DEFAULT NULL,
  _details jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ip text; ua text;
BEGIN
  BEGIN
    ip := NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', '');
    ua := NULLIF(current_setting('request.headers', true)::json->>'user-agent', '');
  EXCEPTION WHEN others THEN ip := NULL; ua := NULL;
  END;
  INSERT INTO public.audit_logs (user_id, user_role, patient_id, action, table_name, record_id, ip_address, user_agent, details)
  VALUES (auth.uid(), public.current_actor_role(), COALESCE(_patient_id, auth.uid()),
          left(_action, 80), left(COALESCE(_table_name, 'auth'), 80), _record_id, ip, ua, _details);
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event(text, text, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, text, jsonb) TO authenticated, service_role;

-- ============ 5. Interoperability scaffolding (inactive, future HIS/FHIR) ============
CREATE TABLE IF NOT EXISTS public.interop_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  system text NOT NULL,
  value text NOT NULL,
  assigner text,
  use text NOT NULL DEFAULT 'MRN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system, value)
);
GRANT SELECT ON public.interop_identifiers TO authenticated;
GRANT ALL ON public.interop_identifiers TO service_role;
ALTER TABLE public.interop_identifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients view own identifiers" ON public.interop_identifiers
  FOR SELECT TO authenticated USING (patient_id = auth.uid());
CREATE POLICY "Admins view all identifiers" ON public.interop_identifiers
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','hospital_admin']));
CREATE TRIGGER trg_interop_identifiers_updated_at BEFORE UPDATE ON public.interop_identifiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.fhir_resource_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL,
  resource_id text,
  local_table text NOT NULL,
  local_id text NOT NULL,
  patient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (local_table, local_id, resource_type)
);
GRANT SELECT ON public.fhir_resource_map TO authenticated;
GRANT ALL ON public.fhir_resource_map TO service_role;
ALTER TABLE public.fhir_resource_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read resource map" ON public.fhir_resource_map
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','hospital_admin']));
CREATE TRIGGER trg_fhir_resource_map_updated_at BEFORE UPDATE ON public.fhir_resource_map
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.interop_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'fhir',
  base_url text,
  status text NOT NULL DEFAULT 'planned',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interop_endpoints_kind_check CHECK (kind IN ('fhir','hl7v2','his','emr','lis','ris','other')),
  CONSTRAINT interop_endpoints_status_check CHECK (status IN ('planned','testing','active','disabled'))
);
GRANT SELECT ON public.interop_endpoints TO authenticated;
GRANT ALL ON public.interop_endpoints TO service_role;
ALTER TABLE public.interop_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read endpoints" ON public.interop_endpoints
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','hospital_admin']));
CREATE TRIGGER trg_interop_endpoints_updated_at BEFORE UPDATE ON public.interop_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.interop_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid REFERENCES public.interop_endpoints(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'outbound',
  message_type text NOT NULL,
  patient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT interop_messages_direction_check CHECK (direction IN ('inbound','outbound')),
  CONSTRAINT interop_messages_status_check CHECK (status IN ('queued','sent','received','failed','skipped'))
);
GRANT SELECT ON public.interop_messages TO authenticated;
GRANT ALL ON public.interop_messages TO service_role;
ALTER TABLE public.interop_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read interop messages" ON public.interop_messages
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','hospital_admin']));
CREATE INDEX IF NOT EXISTS interop_messages_status_idx ON public.interop_messages (status, created_at DESC);