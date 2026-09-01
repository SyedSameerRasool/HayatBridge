// Secure, RLS-scoped server API for the clinical record tables.
// Every write goes through Supabase with the caller's own identity, and the
// database audit triggers record user, role, patient, action, time and IP.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// ---------- Vaccinations ----------
const vaccinationSchema = z.object({
  vaccine_name: z.string().min(1).max(160),
  dose_number: z.number().int().min(0).max(20).optional().nullable(),
  administered_on: z.string().optional().nullable(),
  provider: z.string().max(160).optional().nullable(),
  lot_number: z.string().max(80).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const listVaccinations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vaccinations")
      .select("*")
      .eq("patient_id", context.userId)
      .order("administered_on", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createVaccination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => vaccinationSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("vaccinations")
      .insert({ ...data, patient_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteVaccination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("vaccinations")
      .delete()
      .eq("id", data.id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Procedures ----------
const procedureSchema = z.object({
  name: z.string().min(1).max(200),
  performed_on: z.string().optional().nullable(),
  provider: z.string().max(160).optional().nullable(),
  facility: z.string().max(160).optional().nullable(),
  outcome: z.string().max(400).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const listProcedures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("procedures")
      .select("*")
      .eq("patient_id", context.userId)
      .order("performed_on", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createProcedure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => procedureSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("procedures")
      .insert({ ...data, patient_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteProcedure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("procedures")
      .delete()
      .eq("id", data.id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Imaging reports ----------
const imagingSchema = z.object({
  modality: z.string().min(1).max(80),
  body_part: z.string().max(120).optional().nullable(),
  performed_on: z.string().optional().nullable(),
  facility: z.string().max(160).optional().nullable(),
  ordering_provider: z.string().max(160).optional().nullable(),
  findings: z.string().max(4000).optional().nullable(),
  impression: z.string().max(2000).optional().nullable(),
  report_url: z.string().max(500).optional().nullable(),
});

export const listImagingReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("imaging_reports")
      .select("*")
      .eq("patient_id", context.userId)
      .order("performed_on", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createImagingReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => imagingSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("imaging_reports")
      .insert({ ...data, patient_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteImagingReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("imaging_reports")
      .delete()
      .eq("id", data.id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Emergency contacts ----------
const contactSchema = z.object({
  name: z.string().min(1).max(160),
  relationship: z.string().max(80).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  is_primary: z.boolean().optional(),
});

export const listEmergencyContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("emergency_contacts")
      .select("*")
      .eq("patient_id", context.userId)
      .order("is_primary", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertEmergencyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => contactSchema.extend({ id: uuid.optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    if (id) {
      const { data: row, error } = await context.supabase
        .from("emergency_contacts")
        .update(rest)
        .eq("id", id)
        .eq("patient_id", context.userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("emergency_contacts")
      .insert({ ...rest, patient_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteEmergencyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("emergency_contacts")
      .delete()
      .eq("id", data.id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Medical history ----------
const historySchema = z.object({
  item: z.string().min(1).max(200),
  category: z.string().max(60).optional(),
  occurred_on: z.string().optional().nullable(),
  details: z.string().max(2000).optional().nullable(),
});

export const listMedicalHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("medical_history")
      .select("*")
      .eq("patient_id", context.userId)
      .order("occurred_on", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createMedicalHistoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => historySchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("medical_history")
      .insert({ ...data, patient_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMedicalHistoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("medical_history")
      .delete()
      .eq("id", data.id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Clinical notes & medication history (patient read view) ----------
export const listMyClinicalNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clinical_notes")
      .select("*")
      .eq("patient_id", context.userId)
      .order("encounter_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listMyMedicationHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("medication_history")
      .select("*")
      .eq("patient_id", context.userId)
      .order("occurred_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Clinician writes (only during an active, patient-approved grant) ----------
export const addClinicalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        patient_id: uuid,
        note: z.string().min(1).max(6000),
        note_type: z.string().max(60).default("consultation"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: clinician } = await context.supabase
      .from("clinicians")
      .select("full_name, professional_role, verified")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!clinician?.verified)
      throw new Error("Access denied. Only verified healthcare professionals may access patient records.");
    const { data: row, error } = await context.supabase
      .from("clinical_notes")
      .insert({
        patient_id: data.patient_id,
        note: data.note,
        note_type: data.note_type,
        author_id: context.userId,
        author_name: clinician.full_name,
        author_role: clinician.professional_role,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const addMedicationHistoryEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        patient_id: uuid,
        medication_id: uuid.optional().nullable(),
        medication_name: z.string().min(1).max(200),
        action: z.string().min(1).max(80),
        details: z.string().max(2000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: clinician } = await context.supabase
      .from("clinicians")
      .select("full_name, professional_role, verified")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!clinician?.verified)
      throw new Error("Access denied. Only verified healthcare professionals may access patient records.");
    const { data: row, error } = await context.supabase
      .from("medication_history")
      .insert({
        ...data,
        changed_by: context.userId,
        changed_by_name: clinician.full_name,
        changed_by_role: clinician.professional_role,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- Audit trail ----------
export const listMyAuditTrail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
