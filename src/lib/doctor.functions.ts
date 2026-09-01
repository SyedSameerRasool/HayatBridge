// Doctor-portal server API. Reuses the existing consent + RLS model:
// every read/write below runs as the signed-in clinician, so the database
// policies (has_active_access / can_write_clinical / can_write_medication_notes)
// remain the single source of truth. No schema or policy changes.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireGrant } from "@/lib/doctor-grant";



/** Full clinical record for a patient the doctor currently has approved access to. */
export const getPatientClinicalRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ requestId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const req = await requireGrant(context.supabase as never, data.requestId, context.userId);
    const pid = req.patient_id;
    const sb = context.supabase;

    const [allergies, medications, diagnoses, labs, history, notes] = await Promise.all([
      sb.from("allergies").select("*").eq("patient_id", pid).order("created_at", { ascending: false }),
      sb.from("medications").select("*").eq("patient_id", pid).order("created_at", { ascending: false }),
      sb.from("diagnoses").select("*").eq("patient_id", pid).order("created_at", { ascending: false }),
      sb.from("test_results").select("*").eq("patient_id", pid).order("resulted_at", { ascending: false }).limit(50),
      sb.from("medical_history").select("*").eq("patient_id", pid).order("occurred_on", { ascending: false, nullsFirst: false }),
      sb.from("clinical_notes").select("*").eq("patient_id", pid).order("encounter_date", { ascending: false }).limit(50),
    ]);

    await context.supabase.rpc("log_audit_event", {
      _action: "RECORD_VIEW",
      _table_name: "clinical_record",
      _patient_id: pid,
      _record_id: pid,
    });

    return {
      grant: {
        id: req.id,
        patient_id: pid,
        expires_at: req.expires_at,
        requested_at: req.requested_at,
        decided_at: req.decided_at,
        clinician_role: req.clinician_role,
      },
      allergies: allergies.data ?? [],
      medications: medications.data ?? [],
      diagnoses: diagnoses.data ?? [],
      lab_reports: labs.data ?? [],
      medical_history: history.data ?? [],
      clinical_notes: notes.data ?? [],
    };
  });

export const doctorAddDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        condition: z.string().trim().min(2).max(200),
        status: z.string().trim().max(40).default("active"),
        severity: z.string().trim().max(40).optional().nullable(),
        notes: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const req = await requireGrant(context.supabase as never, data.requestId, context.userId);
    const { data: row, error } = await context.supabase
      .from("diagnoses")
      .insert({
        patient_id: req.patient_id,
        condition: data.condition,
        status: data.status || "active",
        severity: data.severity || null,
        notes: data.notes || null,
        provider: req.clinician_name,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const doctorAddMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
        dose: z.string().trim().max(120).optional().nullable(),
        frequency: z.string().trim().max(120).optional().nullable(),
        reason: z.string().trim().max(300).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const req = await requireGrant(context.supabase as never, data.requestId, context.userId);
    const { data: row, error } = await context.supabase
      .from("medications")
      .insert({
        patient_id: req.patient_id,
        name: data.name,
        dose: data.dose || null,
        frequency: data.frequency || null,
        reason: data.reason || null,
        prescriber: req.clinician_name,
        active: true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("medication_history").insert({
      patient_id: req.patient_id,
      medication_id: row.id,
      medication_name: row.name,
      action: "prescribed",
      changed_by: context.userId,
      changed_by_name: req.clinician_name,
      changed_by_role: req.clinician_role,
      details: [data.dose, data.frequency].filter(Boolean).join(" · ") || null,
    });

    return row;
  });

export const doctorAddClinicalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        note: z.string().trim().min(2).max(6000),
        note_type: z.string().trim().max(60).default("consultation"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const req = await requireGrant(context.supabase as never, data.requestId, context.userId);
    const { data: row, error } = await context.supabase
      .from("clinical_notes")
      .insert({
        patient_id: req.patient_id,
        author_id: context.userId,
        author_name: req.clinician_name,
        author_role: req.clinician_role,
        note_type: data.note_type || "consultation",
        note: data.note,
        encounter_date: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Consent / access status history for the signed-in clinician. */
export const listMyClinicianAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("access_requests")
      .select("*")
      .eq("clinician_id", context.userId)
      .order("requested_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Audit entries recorded for this clinician's own actions. */
export const listMyClinicianAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select("id, action, table_name, patient_id, user_role, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
