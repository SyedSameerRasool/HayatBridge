// Server-only helpers for the admin surface.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AdminClient = SupabaseClient<Database>;

/** Throws unless the caller holds the `admin` role (checked in the database). */
export async function assertAdmin(supabase: AdminClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: administrator access required");
}

/** Appends an immutable audit entry for an admin action. */
export async function logAdminAction(
  supabase: AdminClient,
  params: {
    adminId: string;
    adminEmail?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    details?: string | null;
  },
) {
  await supabase.from("admin_activity_logs").insert({
    admin_id: params.adminId,
    admin_email: params.adminEmail ?? null,
    action: params.action,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    details: params.details ?? null,
  });
}

export function startOfDayIso(daysAgo = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

export function bucketByDay(dates: string[], days: number) {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(startOfDayIso(i).slice(0, 10), 0);
  }
  for (const raw of dates) {
    const key = raw.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets, ([date, count]) => ({ date, count }));
}
