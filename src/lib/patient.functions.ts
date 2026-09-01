// Server functions for patient dashboard data (real backend, RLS-scoped to the caller).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Profile ----------
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const profileUpdateSchema = z.object({
  full_name: z.string().max(120).optional(),
  date_of_birth: z.string().optional().nullable(),
  blood_type: z.string().max(4).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  emergency_contact: z.string().max(200).optional().nullable(),
  allergies: z.string().max(2000).optional().nullable(),
  medications: z.string().max(2000).optional().nullable(),
  diagnoses: z.string().max(2000).optional().nullable(),
  recent_reports: z.string().max(4000).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: current } = await context.supabase
      .from("profiles")
      .select("initial_setup_completed")
      .eq("id", context.userId)
      .maybeSingle();

    // Locked one-time setup fields are never sent back to the database.
    const patch: z.infer<typeof profileUpdateSchema> = { ...data };
    if (current?.initial_setup_completed) {

      delete patch["full_name"];
      delete patch["date_of_birth"];
      delete patch["allergies"];
      delete patch["diagnoses"];
    }

    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const initialSetupSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  date_of_birth: z.string().trim().min(4).max(20),
  allergies: z.string().trim().max(2000),
  diagnoses: z.string().trim().max(2000),
});

/** One-time patient setup. After this the four fields are locked (DB trigger enforced). */
export const completeInitialSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => initialSetupSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: current } = await context.supabase
      .from("profiles")
      .select("initial_setup_completed")
      .eq("id", context.userId)
      .maybeSingle();
    if (current?.initial_setup_completed)
      throw new Error("Initial setup has already been completed.");

    const { error } = await context.supabase
      .from("profiles")
      .update({ ...data, initial_setup_completed: true })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


// ---------- Consent ----------
export const getMyConsent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("consent_fields, consent_expires_at, consent_revoked, consent_updated_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const consentSchema = z.object({
  consent_fields: z.array(z.string()).optional(),
  consent_expires_at: z.string().optional().nullable(),
  consent_revoked: z.boolean().optional(),
});

export const updateMyConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => consentSchema.parse(i))
  .handler(async ({ data, context }) => {
    const patch: {
      consent_updated_at: string;
      consent_fields?: string[];
      consent_expires_at?: string | null;
      consent_revoked?: boolean;
    } = { consent_updated_at: new Date().toISOString() };
    if (data.consent_fields !== undefined) patch.consent_fields = data.consent_fields;
    if (data.consent_expires_at !== undefined) patch.consent_expires_at = data.consent_expires_at;
    if (data.consent_revoked !== undefined) patch.consent_revoked = data.consent_revoked;
    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    // If revoking, also revoke all outstanding tokens and log the event.
    if (data.consent_revoked === true) {
      await context.supabase
        .from("share_tokens")
        .update({ revoked: true })
        .eq("patient_id", context.userId)
        .is("used_at", null)
        .eq("revoked", false);
      await context.supabase.from("access_logs").insert({
        patient_id: context.userId,
        role: "patient",
        viewer: "Patient (self)",
        device: "Consent revocation",
        fields_viewed: [],
      });
    }
    return { ok: true };
  });

// ---------- Share tokens (QR) ----------
function randomTokenValue(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const createTokenSchema = z.object({
  role: z.enum(["doctor", "pharmacist", "hospital"]),
  ttl_ms: z.number().int().min(60_000).max(24 * 60 * 60 * 1000),
});

export const createShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => createTokenSchema.parse(i))
  .handler(async ({ data, context }) => {
    // Read consent for this patient to snapshot approved fields.
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("consent_fields, consent_revoked, consent_expires_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) throw new Error("Profile not found");
    if (profile.consent_revoked) throw new Error("Sharing is currently revoked. Restore consent first.");
    const expiresAt = new Date(Date.now() + data.ttl_ms).toISOString();
    const token_value = randomTokenValue();
    const { data: row, error } = await context.supabase
      .from("share_tokens")
      .insert({
        token_value,
        patient_id: context.userId,
        role: data.role,
        fields: profile.consent_fields ?? [],
        expires_at: expiresAt,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyShareTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("share_tokens")
      .select("*")
      .eq("patient_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const revokeShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("share_tokens")
      .update({ revoked: true })
      .eq("id", data.id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public: look up token status (no PII returned)
function makePublicClient() {
  return import("@supabase/supabase-js").then(({ createClient }) => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
  });
}

export type ShareStatus = "valid" | "used" | "expired" | "revoked" | "unknown" | "consent_revoked";

export const getShareTokenStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().min(8).max(64) }).parse(i))
  .handler(async ({ data }) => {
    // Status lookup only (no PII returned). share_tokens has no anon-readable
    // policy by design, so this must run with the server client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supa = supabaseAdmin;
    const { data: row } = await supa
      .from("share_tokens")
      .select("id, role, expires_at, used_at, revoked, patient_id")
      .eq("token_value", data.token)
      .maybeSingle();
    if (!row) return { status: "unknown" as ShareStatus };
    if (row.revoked) return { status: "revoked" as ShareStatus, expires_at: row.expires_at };
    if (row.used_at) return { status: "used" as ShareStatus, expires_at: row.expires_at };
    if (new Date(row.expires_at).getTime() < Date.now())
      return { status: "expired" as ShareStatus, expires_at: row.expires_at };
    // Also surface consent-revoked so the QR page can react.
    const { data: profile } = await supa
      .from("profiles")
      .select("consent_revoked")
      .eq("id", row.patient_id)
      .maybeSingle();
    if (profile?.consent_revoked) return { status: "consent_revoked" as ShareStatus, expires_at: row.expires_at };
    return { status: "valid" as ShareStatus, expires_at: row.expires_at, role: row.role };
  });

// Public: consume the token and return the filtered patient summary + log the access.
export const consumeShareToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        token: z.string().min(8).max(64),
        viewer: z.string().min(2).max(200),
        device: z.string().max(120).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const supa = await makePublicClient();
    const { data: token, error: tErr } = await supa
      .from("share_tokens")
      .select("*")
      .eq("token_value", data.token)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!token) return { ok: false as const, status: "unknown" as ShareStatus };
    if (token.revoked) return { ok: false as const, status: "revoked" as ShareStatus };
    if (token.used_at) return { ok: false as const, status: "used" as ShareStatus };
    if (new Date(token.expires_at).getTime() < Date.now())
      return { ok: false as const, status: "expired" as ShareStatus };

    // Consent gate
    const { data: profile } = await supa
      .from("profiles")
      .select("*")
      .eq("id", token.patient_id)
      .maybeSingle();
    if (!profile) return { ok: false as const, status: "unknown" as ShareStatus };
    if (profile.consent_revoked)
      return { ok: false as const, status: "consent_revoked" as ShareStatus };

    // Burn the token (single-use).
    const { error: uErr } = await supa
      .from("share_tokens")
      .update({ used_at: new Date().toISOString(), used_by: data.viewer })
      .eq("id", token.id)
      .is("used_at", null)
      .eq("revoked", false);
    if (uErr) throw new Error(uErr.message);

    // Intersect the token's approved fields with the current consent snapshot.
    const currentApproved: string[] = profile.consent_fields ?? [];
    const visible = (token.fields as string[]).filter((f) => currentApproved.includes(f));

    // Append the access log entry (role + timestamp + viewer + fields).
    await supa.from("access_logs").insert({
      patient_id: token.patient_id,
      role: token.role,
      viewer: data.viewer,
      token_id: token.id,
      device: data.device ?? "Web scan",
      fields_viewed: visible,
    });

    return {
      ok: true as const,
      status: "valid" as ShareStatus,
      token: { id: token.id, role: token.role, used_at: new Date().toISOString(), fields: visible },
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        date_of_birth: profile.date_of_birth,
        blood_type: profile.blood_type,
        phone: profile.phone,
        emergency_contact: profile.emergency_contact,
        allergies: profile.allergies,
        medications: profile.medications,
        diagnoses: profile.diagnoses,
        recent_reports: profile.recent_reports,
        notes: profile.notes,
      },
    };
  });

// ---------- Questionnaire ----------
export const saveQuestionnaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ responses: z.record(z.string(), z.unknown()) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("questionnaire_responses")
      .insert({ patient_id: context.userId, responses: data.responses as never })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getLatestQuestionnaire = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("questionnaire_responses")
      .select("*")
      .eq("patient_id", context.userId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

// ---------- Appointments ----------
export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", context.userId)
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const appointmentSchema = z.object({
  provider_name: z.string().min(1).max(120),
  specialty: z.string().max(80).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  scheduled_at: z.string().min(1),
  duration_minutes: z.number().int().min(5).max(480).default(30),
  notes: z.string().max(2000).optional().nullable(),
});

export const createAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => appointmentSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("appointments")
      .insert({ ...data, patient_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["scheduled", "completed", "cancelled"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("appointments")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("appointments")
      .delete()
      .eq("id", data.id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Messages ----------
export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("messages")
      .select("*")
      .eq("patient_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(4000),
        provider_name: z.string().max(120).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("messages")
      .insert({ ...data, sender: "patient", patient_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const markMessageRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Test results (read-only for patient) ----------
export const listTestResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("test_results")
      .select("*")
      .eq("patient_id", context.userId)
      .order("resulted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Billing ----------
export const listBillingStatements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("billing_statements")
      .select("*")
      .eq("patient_id", context.userId)
      .order("issued_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getBillingPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("billing_preferences")
      .select("*")
      .eq("patient_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateBillingPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ paperless: z.boolean(), delivery_email: z.string().email().nullable().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("billing_preferences")
      .upsert(
        { patient_id: context.userId, paperless: data.paperless, delivery_email: data.delivery_email ?? null, updated_at: new Date().toISOString() },
        { onConflict: "patient_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Dashboard summary ----------
export const getDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const nowIso = new Date().toISOString();
    const [profile, upcoming, unread, latestResult, unpaid, prefs] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("appointments")
        .select("id, provider_name, specialty, scheduled_at, location, status")
        .eq("patient_id", context.userId)
        .eq("status", "scheduled")
        .gte("scheduled_at", nowIso)
        .order("scheduled_at", { ascending: true })
        .limit(3),
      context.supabase
        .from("messages")
        .select("id, subject, sender, created_at, read_at")
        .eq("patient_id", context.userId)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
      context.supabase
        .from("test_results")
        .select("id, test_name, value, unit, flag, resulted_at")
        .eq("patient_id", context.userId)
        .order("resulted_at", { ascending: false })
        .limit(3),
      context.supabase
        .from("billing_statements")
        .select("id, description, amount_cents, status, due_date")
        .eq("patient_id", context.userId)
        .in("status", ["pending", "overdue"]),
      context.supabase.from("billing_preferences").select("*").eq("patient_id", context.userId).maybeSingle(),
    ]);
    return {
      profile: profile.data,
      upcomingAppointments: upcoming.data ?? [],
      unreadMessages: unread.data ?? [],
      latestResults: latestResult.data ?? [],
      unpaidBills: unpaid.data ?? [],
      billingPreferences: prefs.data,
    };
  });

// ---------- Access logs (provider scans of the QR) ----------
export const listAccessLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("access_logs")
      .select("*")
      .eq("patient_id", context.userId)
      .order("at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Legacy unauthenticated logger — kept for backward compatibility with older callers.
export const logAccessEvent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        patient_id: z.string().uuid(),
        role: z.string().max(40),
        viewer: z.string().max(200),
        token_id: z.string().max(80).optional().nullable(),
        device: z.string().max(120).optional().nullable(),
        fields_viewed: z.array(z.string()).default([]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const supa = await makePublicClient();
    const { error } = await supa.from("access_logs").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Seed demo data for the current user ----------
export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [appts, msgs, results] = await Promise.all([
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("patient_id", userId),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("patient_id", userId),
      supabase.from("test_results").select("id", { count: "exact", head: true }).eq("patient_id", userId),
    ]);
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    if ((appts.count ?? 0) === 0) {
      await supabase.from("appointments").insert([
        {
          patient_id: userId,
          provider_name: "Dr. Rania Osman",
          specialty: "Cardiology",
          scheduled_at: new Date(now + 3 * day).toISOString(),
          location: "Northwell Cardiac Center · Suite 402",
          status: "scheduled",
          notes: "Annual follow-up. Bring current medication list.",
        },
        {
          patient_id: userId,
          provider_name: "Dr. Omar Farouk",
          specialty: "Primary Care",
          scheduled_at: new Date(now + 10 * day).toISOString(),
          location: "Downtown Family Health · Room 12",
          status: "scheduled",
        },
        {
          patient_id: userId,
          provider_name: "Dr. Yasmin Halabi",
          specialty: "Dermatology",
          scheduled_at: new Date(now - 21 * day).toISOString(),
          location: "Skin & Care Clinic",
          status: "completed",
        },
      ]);
    }

    if ((msgs.count ?? 0) === 0) {
      await supabase.from("messages").insert([
        {
          patient_id: userId,
          sender: "provider",
          provider_name: "Dr. Rania Osman",
          subject: "Your recent lab results are ready",
          body: "Hello — your lipid panel results are in and look reassuring. We'll review them together at your next visit.",
        },
        {
          patient_id: userId,
          sender: "provider",
          provider_name: "Pharmacy · HayatBridge",
          subject: "Prescription refill available",
          body: "Your Atorvastatin 20mg refill is ready for pickup. Please bring a photo ID.",
        },
        {
          patient_id: userId,
          sender: "provider",
          provider_name: "Care Team",
          subject: "Welcome to HayatBridge",
          body: "We're glad you're here. Use the QR tile on your dashboard to share your record with any provider.",
          read_at: new Date(now - 2 * day).toISOString(),
        },
      ]);
    }

    if ((results.count ?? 0) === 0) {
      await supabase.from("test_results").insert([
        { patient_id: userId, test_name: "Total Cholesterol", category: "Lipid Panel", value: "182", unit: "mg/dL", reference_range: "< 200", flag: "normal", ordering_provider: "Dr. Rania Osman", resulted_at: new Date(now - 5 * day).toISOString() },
        { patient_id: userId, test_name: "LDL Cholesterol", category: "Lipid Panel", value: "118", unit: "mg/dL", reference_range: "< 100", flag: "high", ordering_provider: "Dr. Rania Osman", resulted_at: new Date(now - 5 * day).toISOString() },
        { patient_id: userId, test_name: "Hemoglobin A1c", category: "Diabetes", value: "5.4", unit: "%", reference_range: "< 5.7", flag: "normal", ordering_provider: "Dr. Omar Farouk", resulted_at: new Date(now - 30 * day).toISOString() },
        { patient_id: userId, test_name: "Vitamin D, 25-OH", category: "Chemistry", value: "22", unit: "ng/mL", reference_range: "30 - 100", flag: "low", ordering_provider: "Dr. Omar Farouk", resulted_at: new Date(now - 30 * day).toISOString() },
      ]);
    }

    return { ok: true };
  });

// ---------- Allergies ----------
const allergySchema = z.object({
  substance: z.string().min(1).max(160),
  reaction: z.string().max(500).optional().nullable(),
  severity: z.enum(["mild", "moderate", "severe", "life-threatening"]).default("mild"),
  notes: z.string().max(1000).optional().nullable(),
});

export const listAllergies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("allergies")
      .select("*")
      .eq("patient_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createAllergy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => allergySchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("allergies")
      .insert({ ...data, patient_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateAllergy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid() }).and(allergySchema.partial()).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("allergies")
      .update(patch)
      .eq("id", id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAllergy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("allergies")
      .delete()
      .eq("id", data.id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Medications ----------
const medicationSchema = z.object({
  name: z.string().min(1).max(160),
  dose: z.string().max(80).optional().nullable(),
  frequency: z.string().max(120).optional().nullable(),
  route: z.string().max(60).optional().nullable(),
  prescriber: z.string().max(160).optional().nullable(),
  reason: z.string().max(240).optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  active: z.boolean().default(true),
  notes: z.string().max(1000).optional().nullable(),
});

export const listMedications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("medications")
      .select("*")
      .eq("patient_id", context.userId)
      .order("active", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => medicationSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("medications")
      .insert({ ...data, patient_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid() }).and(medicationSchema.partial()).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("medications")
      .update(patch)
      .eq("id", id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("medications")
      .delete()
      .eq("id", data.id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Diagnoses ----------
const diagnosisSchema = z.object({
  condition: z.string().min(1).max(200),
  status: z.string().max(40).default("active"),
  severity: z.string().max(40).optional().nullable(),
  icd10_code: z.string().max(20).optional().nullable(),
  onset_date: z.string().optional().nullable(),
  diagnosed_date: z.string().optional().nullable(),
  resolved_date: z.string().optional().nullable(),
  provider: z.string().max(160).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const listDiagnoses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("diagnoses")
      .select("*")
      .eq("patient_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => diagnosisSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("diagnoses")
      .insert({ ...data, patient_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid() }).and(diagnosisSchema.partial()).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("diagnoses")
      .update(patch)
      .eq("id", id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("diagnoses")
      .delete()
      .eq("id", data.id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Roles ----------
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r) => r.role as string);
    return {
      roles,
      canPrescribe: roles.includes("doctor") || roles.includes("pharmacist"),
    };
  });

// ---------- Patient-uploaded lab reports ----------
const patientReportSchema = z.object({
  test_name: z.string().min(1).max(200),
  category: z.string().max(120).optional().nullable(),
  resulted_at: z.string(),
  report_url: z.string().min(1).max(500),
  patient_notes: z.string().max(1000).optional().nullable(),
});

export const addPatientTestResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => patientReportSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("test_results")
      .insert({
        patient_id: context.userId,
        test_name: data.test_name,
        category: data.category ?? null,
        resulted_at: data.resulted_at,
        report_url: data.report_url,
        patient_notes: data.patient_notes ?? null,
        source: "patient_upload",
        value: "See attached report",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePatientTestResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("test_results")
      .delete()
      .eq("id", data.id)
      .eq("patient_id", context.userId)
      .eq("source", "patient_upload");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getReportSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ path: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/`)) throw new Error("Not allowed");
    const { data: signed, error } = await context.supabase.storage
      .from("lab-reports")
      .createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
