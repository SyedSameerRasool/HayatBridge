// Shared guard: confirms the signed-in clinician has a live, patient-approved grant.
export async function requireGrant(
  supabase: { from: (t: string) => any },
  requestId: string,
  clinicianId: string,
) {
  const { data: req } = await supabase
    .from("access_requests")
    .select("*")
    .eq("id", requestId)
    .eq("clinician_id", clinicianId)
    .maybeSingle();
  if (!req) throw new Error("Access request not found.");
  if (req.status !== "approved") throw new Error("The patient has not approved this request.");
  if (!req.expires_at || new Date(req.expires_at).getTime() < Date.now())
    throw new Error("Temporary access has expired. Ask the patient to approve a new request.");
  return req as {
    id: string;
    patient_id: string;
    expires_at: string;
    clinician_name: string;
    clinician_role: string;
    hospital: string;
    department: string;
    decided_at: string | null;
    requested_at: string;
  };
}
