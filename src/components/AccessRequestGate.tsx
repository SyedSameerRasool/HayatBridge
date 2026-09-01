import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Building2, ShieldCheck, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decideAccessRequest, listAccessRequests } from "@/lib/access.functions";
import { ACCESS_GRANT_MINUTES, CLINICIAN_ROLE_LABEL } from "@/lib/access.shared";

/**
 * Watches for clinician access requests aimed at the signed-in patient and asks
 * for explicit consent before any record is opened. Mounted once in AppHeader.
 */
export function AccessRequestGate() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAccessRequests);
  const decideFn = useServerFn(decideAccessRequest);

  const { data } = useQuery({
    queryKey: ["accessRequests"],
    queryFn: () => listFn(),
    refetchInterval: 4000,
    retry: false,
  });

  const decide = useMutation({
    mutationFn: (vars: { id: string; decision: "allow" | "deny" | "revoke" }) =>
      decideFn({ data: vars }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["accessRequests"] });
      qc.invalidateQueries({ queryKey: ["accessLogs"] });
      qc.invalidateQueries({ queryKey: ["shareTokens"] });
      toast.success(
        vars.decision === "allow"
          ? `Access granted for ${ACCESS_GRANT_MINUTES} minutes.`
          : vars.decision === "deny"
            ? "Access denied."
            : "Access revoked.",
      );
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const pending = data?.pending?.[0];
  const active = data?.active ?? [];

  if (!pending && active.length === 0) return null;

  return (
    <>
      {active.length > 0 && !pending && (
        <div className="border-b border-success/30 bg-success/10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-xs sm:px-6">
            <ShieldCheck className="h-4 w-4 text-success" />
            {active.map((a) => (
              <span key={a.id} className="flex items-center gap-2 font-medium text-foreground">
                {a.clinician_name} ({CLINICIAN_ROLE_LABEL[a.clinician_role] ?? a.clinician_role}) has
                temporary access until{" "}
                {a.expires_at ? new Date(a.expires_at).toLocaleTimeString() : "—"}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => decide.mutate({ id: a.id, decision: "revoke" })}
                >
                  Revoke
                </Button>
              </span>
            ))}
          </div>
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-foreground">
                    {pending.clinician_name}
                  </h2>
                  <span className="flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                </div>
                <div className="mt-0.5 text-sm font-medium text-primary">
                  {CLINICIAN_ROLE_LABEL[pending.clinician_role] ?? pending.clinician_role}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 rounded-xl border border-border bg-surface p-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="font-medium text-foreground">
                  {pending.hospital || "Hospital/Clinic not provided"}
                </span>
              </div>
              <div className="text-muted-foreground">
                Department ·{" "}
                <span className="font-medium text-foreground">
                  {pending.department || "—"}
                </span>
              </div>
              {pending.license_no && (
                <div className="text-muted-foreground">
                  License · <span className="font-medium text-foreground">{pending.license_no}</span>
                </div>
              )}
            </div>

            <p className="mt-4 text-sm font-medium text-foreground">
              {pending.clinician_name} is requesting temporary access to your health record.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              If you allow, access lasts {ACCESS_GRANT_MINUTES} minutes for this consultation, shows
              only the fields appropriate for their role, can be revoked by you at any time, and is
              recorded in your access log.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: pending.id, decision: "deny" })}
              >
                Deny Access
              </Button>
              <Button
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: pending.id, decision: "allow" })}
              >
                Allow Access
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}