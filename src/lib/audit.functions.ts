// Centralised, server-side audit logging for privacy-sensitive events
// (logins, logouts, QR scans, record views, consent decisions).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const AUDIT_ACTIONS = [
  "LOGIN",
  "LOGOUT",
  "SESSION_TIMEOUT",
  "QR_SCAN",
  "RECORD_VIEW",
  "RECORD_EDIT",
  "CONSENT_APPROVED",
  "CONSENT_DENIED",
  "CONSENT_REVOKED",
  "CLINICIAN_REGISTERED",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const schema = z.object({
  action: z.enum(AUDIT_ACTIONS),
  table_name: z.string().max(80).default("auth"),
  patient_id: z.string().uuid().optional(),
  record_id: z.string().max(200).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

/** Writes one audit row as the signed-in user (RLS + SECURITY DEFINER guarded). */
export const logAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("log_audit_event", {
      _action: data.action,
      _table_name: data.table_name,
      _patient_id: data.patient_id ?? context.userId,
      ...(data.record_id ? { _record_id: data.record_id } : {}),
      _details: (data.details ?? null) as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
