import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ACCESS_GRANT_MINUTES,
  fieldsForRole,
  UNVERIFIED_MESSAGE,
  type AccessGrantStatus,
} from "@/lib/access.shared";

export const getMyClinicianProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clinicians")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

export const saveMyClinicianProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        full_name: z.string().min(2).max(160),
        professional_role: z.enum(["doctor", "pharmacist", "nurse", "emergency_physician"]),
        hospital: z.string().trim().min(2).max(160),
        department: z.string().trim().min(2).max(160),
        license_no: z.string().trim().min(3).max(80),
        work_email: z.string().trim().email().max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("clinicians")
      .select("user_id, verified")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing?.verified) return existing;
    if (existing) {
      const { data: row, error } = await context.supabase
        .from("clinicians")
        .update(data)
        .eq("user_id", context.userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("clinicians")
      .insert({ ...data, user_id: context.userId, verified: false })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.rpc("log_audit_event", {
      _action: "CLINICIAN_REGISTERED",
      _table_name: "clinicians",
      _record_id: context.userId,
    });
    return row;
  });

// Clinician scans a QR: verify identity + verification status, then ask the patient.
export const requestPatientAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ token: z.string().min(8).max(64) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: clinician } = await context.supabase
      .from("clinicians")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!clinician) return { ok: false as const, reason: "no_profile" as const };
    if (!clinician.verified)
      return { ok: false as const, reason: "unverified" as const, message: UNVERIFIED_MESSAGE };

    // Every scan attempt is audited, approved or not.
    await context.supabase.rpc("log_audit_event", {
      _action: "QR_SCAN",
      _table_name: "share_tokens",
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: token } = await supabaseAdmin
      .from("share_tokens")
      .select("id, patient_id, expires_at, used_at, revoked")
      .eq("token_value", data.token)
      .maybeSingle();
    if (!token) return { ok: false as const, reason: "invalid_token" as const };
    if (token.revoked) return { ok: false as const, reason: "revoked_token" as const };
    if (new Date(token.expires_at).getTime() < Date.now())
      return { ok: false as const, reason: "expired_token" as const };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("consent_revoked")
      .eq("id", token.patient_id)
      .maybeSingle();
    if (profile?.consent_revoked)
      return { ok: false as const, reason: "consent_revoked" as const };

    // Reuse a still-pending request for the same token + clinician.
    const { data: pending } = await supabaseAdmin
      .from("access_requests")
      .select("id")
      .eq("token_id", token.id)
      .eq("clinician_id", context.userId)
      .in("status", ["pending", "approved"])
      .order("requested_at", { ascending: false })
      .maybeSingle();
    if (pending) return { ok: true as const, requestId: pending.id };

    const { data: row, error } = await supabaseAdmin
      .from("access_requests")
      .insert({
        token_id: token.id,
        patient_id: token.patient_id,
        clinician_id: context.userId,
        clinician_name: clinician.full_name,
        clinician_role: clinician.professional_role,
        hospital: clinician.hospital,
        department: clinician.department,
        license_no: clinician.license_no,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, requestId: row.id };
  });

// Clinician polls this. Data is only returned once the patient approved and the grant is live.
export const getAccessGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ requestId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: req } = await context.supabase
      .from("access_requests")
      .select("*")
      .eq("id", data.requestId)
      .eq("clinician_id", context.userId)
      .maybeSingle();
    if (!req) return { status: "unknown" as AccessGrantStatus };
    if (req.status !== "approved")
      return { status: req.status as AccessGrantStatus, clinician_role: req.clinician_role };
    if (!req.expires_at || new Date(req.expires_at).getTime() < Date.now())
      return { status: "expired" as AccessGrantStatus };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: token } = await supabaseAdmin
      .from("share_tokens")
      .select("id, fields, used_at, revoked")
      .eq("id", req.token_id)
      .maybeSingle();
    if (!token || token.revoked) return { status: "revoked" as AccessGrantStatus };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", req.patient_id)
      .maybeSingle();
    if (!profile) return { status: "unknown" as AccessGrantStatus };
    if (profile.consent_revoked) return { status: "revoked" as AccessGrantStatus };

    const approved: string[] = (profile.consent_fields ?? []).filter((f: string) =>
      (token.fields as string[]).includes(f),
    );
    const visible = fieldsForRole(req.clinician_role, approved);

    // Burn the single-use token + write the audit entry on first successful open.
    if (!token.used_at) {
      await supabaseAdmin
        .from("share_tokens")
        .update({ used_at: new Date().toISOString(), used_by: req.clinician_name })
        .eq("id", token.id)
        .is("used_at", null);
      await supabaseAdmin.from("access_logs").insert({
        patient_id: req.patient_id,
        role: req.clinician_role,
        viewer: `${req.clinician_name}${req.hospital ? ` · ${req.hospital}` : ""}${req.department ? ` · ${req.department}` : ""}`,
        token_id: token.id,
        device: "Verified clinician scan (patient approved)",
        fields_viewed: visible,
      });
      await context.supabase.rpc("log_audit_event", {
        _action: "RECORD_VIEW",
        _table_name: "profiles",
        _patient_id: req.patient_id,
        _record_id: req.patient_id,
      });
    }

    return {
      status: "approved" as AccessGrantStatus,
      expires_at: req.expires_at,
      clinician_role: req.clinician_role,
      clinician_name: req.clinician_name,
      hospital: req.hospital,
      department: req.department,
      token_id: token.id,
      fields: visible,
      profile: {
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
      } as Record<string, string | null>,
    };
  });

// Patient side: pending requests awaiting a decision + currently live grants.
export const listAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("access_requests")
      .select("*")
      .eq("patient_id", context.userId)
      .in("status", ["pending", "approved"])
      .order("requested_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const now = Date.now();
    const rows = data ?? [];
    return {
      pending: rows.filter(
        (r) =>
          r.status === "pending" &&
          now - new Date(r.requested_at).getTime() < 10 * 60 * 1000,
      ),
      active: rows.filter(
        (r) =>
          r.status === "approved" &&
          !!r.expires_at &&
          new Date(r.expires_at).getTime() > now,
      ),
    };
  });

export const decideAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ id: z.string().uuid(), decision: z.enum(["allow", "deny", "revoke"]) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: req } = await context.supabase
      .from("access_requests")
      .select("*")
      .eq("id", data.id)
      .eq("patient_id", context.userId)
      .maybeSingle();
    if (!req) throw new Error("Request not found");

    const status =
      data.decision === "allow" ? "approved" : data.decision === "deny" ? "denied" : "revoked";
    const expires_at =
      data.decision === "allow"
        ? new Date(Date.now() + ACCESS_GRANT_MINUTES * 60 * 1000).toISOString()
        : null;

    const { error } = await context.supabase
      .from("access_requests")
      .update({ status, decided_at: new Date().toISOString(), expires_at })
      .eq("id", data.id)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);

    if (data.decision !== "allow") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("share_tokens")
        .update({ revoked: true })
        .eq("id", req.token_id);
    }

    // Audit trail for the consent decision itself.
    await context.supabase.from("access_logs").insert({
      patient_id: context.userId,
      role: req.clinician_role,
      viewer: `${req.clinician_name} — access ${status}`,
      token_id: req.token_id,
      device:
        data.decision === "allow"
          ? `Patient approved · expires in ${ACCESS_GRANT_MINUTES} min`
          : data.decision === "deny"
            ? "Patient denied access"
            : "Patient revoked access",
      fields_viewed: [],
    });

    await context.supabase.rpc("log_audit_event", {
      _action:
        data.decision === "allow"
          ? "CONSENT_APPROVED"
          : data.decision === "deny"
            ? "CONSENT_DENIED"
            : "CONSENT_REVOKED",
      _table_name: "access_requests",
      _patient_id: context.userId,
      _record_id: data.id,
    });

    return { ok: true as const, status, expires_at };
  });

// ---------- Admin verification ----------
export const adminListClinicians = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clinicians")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSetClinicianVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ user_id: z.string().uuid(), verified: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("clinicians")
      .update({ verified: data.verified, verified_at: data.verified ? new Date().toISOString() : null })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });