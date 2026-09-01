// Admin server functions. Every handler re-checks the caller's admin role server-side.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAdminAction, startOfDayIso, bucketByDay } from "@/lib/admin.server";

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data), userId: context.userId, email: (context.claims as { email?: string }).email ?? null };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = context.supabase;
    const today = startOfDayIso(0);

    const [total, active, newToday, qr, feedback, openFeedback, recent] = await Promise.all([
      sb.from("profiles").select("id", { count: "exact", head: true }),
      sb.from("profiles").select("id", { count: "exact", head: true }).eq("account_status", "active"),
      sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", today),
      sb.from("share_tokens").select("id", { count: "exact", head: true }),
      sb.from("feedback").select("id", { count: "exact", head: true }),
      sb.from("feedback").select("id", { count: "exact", head: true }).eq("status", "open"),
      sb
        .from("admin_activity_logs")
        .select("id, action, admin_email, target_type, details, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    return {
      totalPatients: total.count ?? 0,
      activePatients: active.count ?? 0,
      newToday: newToday.count ?? 0,
      qrProfiles: qr.count ?? 0,
      feedbackCount: feedback.count ?? 0,
      openFeedback: openFeedback.count ?? 0,
      recentActivity: recent.data ?? [],
    };
  });

export const adminListPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ search: z.string().max(120).optional(), status: z.enum(["all", "active", "deactivated"]).default("all") }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    // Only non-clinical account fields — never passwords or medical records.
    let query = context.supabase
      .from("profiles")
      .select("id, full_name, email, phone, cnic, account_status, created_at, last_login_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.status !== "all") query = query.eq("account_status", data.status);
    const term = data.search?.trim();
    if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminGetPatient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, email, phone, cnic, account_status, created_at, last_login_at, consent_revoked, consent_expires_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const [tokens, views] = await Promise.all([
      context.supabase.from("share_tokens").select("id", { count: "exact", head: true }).eq("patient_id", data.id),
      context.supabase.from("access_logs").select("id", { count: "exact", head: true }).eq("patient_id", data.id),
    ]);

    return { profile: row, qrCount: tokens.count ?? 0, accessCount: views.count ?? 0 };
  });

export const adminSetPatientStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "deactivated"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("profiles")
      .update({ account_status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      adminId: context.userId,
      adminEmail: (context.claims as { email?: string }).email ?? null,
      action: data.status === "active" ? "patient.reactivated" : "patient.deactivated",
      targetType: "patient",
      targetId: data.id,
      details: `Account status set to ${data.status}`,
    });
    return { ok: true };
  });

// ---------- Feedback ----------
export const adminListFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpdateFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        admin_reply: z.string().trim().max(2000).optional(),
        status: z.enum(["open", "in_progress", "resolved"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const patch: {
      admin_reply?: string;
      replied_at?: string;
      status?: string;
      resolved_at?: string | null;
    } = {};
    if (data.admin_reply !== undefined) {
      patch.admin_reply = data.admin_reply;
      patch.replied_at = new Date().toISOString();
    }
    if (data.status !== undefined) {
      patch.status = data.status;
      patch.resolved_at = data.status === "resolved" ? new Date().toISOString() : null;
    }
    const { error } = await context.supabase.from("feedback").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      adminId: context.userId,
      adminEmail: (context.claims as { email?: string }).email ?? null,
      action: data.status ? `feedback.${data.status}` : "feedback.replied",
      targetType: "feedback",
      targetId: data.id,
      details: data.admin_reply ? "Replied to feedback" : `Status changed to ${data.status}`,
    });
    return { ok: true };
  });

// ---------- Announcements ----------
export const adminListAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSaveAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(3).max(160),
        body: z.string().trim().min(3).max(4000),
        audience: z.enum(["all", "patients", "providers"]).default("all"),
        published: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload = {
      title: data.title,
      body: data.body,
      audience: data.audience,
      published: data.published,
      published_at: data.published ? new Date().toISOString() : null,
      created_by: context.userId,
    };
    const result = data.id
      ? await context.supabase.from("announcements").update(payload).eq("id", data.id)
      : await context.supabase.from("announcements").insert(payload);
    if (result.error) throw new Error(result.error.message);
    await logAdminAction(context.supabase, {
      adminId: context.userId,
      adminEmail: (context.claims as { email?: string }).email ?? null,
      action: data.id ? "announcement.updated" : "announcement.created",
      targetType: "announcement",
      targetId: data.id ?? null,
      details: data.title,
    });
    return { ok: true };
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      adminId: context.userId,
      adminEmail: (context.claims as { email?: string }).email ?? null,
      action: "announcement.deleted",
      targetType: "announcement",
      targetId: data.id,
    });
    return { ok: true };
  });

// ---------- Analytics ----------
export const adminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const since = startOfDayIso(29);
    const [profiles, tokens, logins, accesses] = await Promise.all([
      context.supabase.from("profiles").select("created_at").gte("created_at", since).limit(5000),
      context.supabase.from("share_tokens").select("created_at").gte("created_at", since).limit(5000),
      context.supabase.from("profiles").select("last_login_at").not("last_login_at", "is", null).limit(5000),
      context.supabase.from("access_logs").select("at, role").gte("at", since).limit(5000),
    ]);

    const loginDates = (logins.data ?? []).map((r) => r.last_login_at as string);
    const activeLast7 = loginDates.filter((d) => d >= startOfDayIso(6)).length;
    const activeLast30 = loginDates.filter((d) => d >= since).length;

    const roleCounts: Record<string, number> = {};
    for (const row of accesses.data ?? []) {
      const key = row.role ?? "unknown";
      roleCounts[key] = (roleCounts[key] ?? 0) + 1;
    }

    return {
      registrations: bucketByDay((profiles.data ?? []).map((r) => r.created_at as string), 30),
      qrUsage: bucketByDay((tokens.data ?? []).map((r) => r.created_at as string), 30),
      logins: bucketByDay(loginDates.filter((d) => d >= since), 30),
      scansByRole: Object.entries(roleCounts).map(([role, count]) => ({ role, count })),
      activeLast7,
      activeLast30,
      totalScans: (accesses.data ?? []).length,
    };
  });

// ---------- Activity logs ----------
export const adminActivityLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ action: z.string().max(60).optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let query = context.supabase
      .from("admin_activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.action) query = query.ilike("action", `%${data.action}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminRecordEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ action: z.string().trim().max(60), details: z.string().trim().max(300).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await logAdminAction(context.supabase, {
      adminId: context.userId,
      adminEmail: (context.claims as { email?: string }).email ?? null,
      action: data.action,
      details: data.details ?? null,
    });
    if (data.action === "admin.login") {
      await context.supabase
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", context.userId);
    }
    return { ok: true };
  });

// ---------- Admin settings ----------
export const adminUpdateOwnProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ full_name: z.string().trim().min(2).max(120), phone: z.string().trim().max(40).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.full_name, phone: data.phone ?? null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      adminId: context.userId,
      adminEmail: (context.claims as { email?: string }).email ?? null,
      action: "admin.profile_updated",
      details: "Updated admin profile details",
    });
    return { ok: true };
  });
