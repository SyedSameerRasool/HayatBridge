import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SectionCard } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { adminListClinicians, adminSetClinicianVerified } from "@/lib/access.functions";
import { CLINICIAN_ROLE_LABEL } from "@/lib/access.shared";

export const Route = createFileRoute("/admin/clinicians")({
  component: AdminCliniciansPage,
  head: () => ({
    meta: [
      { title: "Clinician verification · HayatBridge admin" },
      { name: "description", content: "Verify healthcare professionals before they may request patient records." },
      { property: "og:title", content: "Clinician verification · HayatBridge admin" },
      { property: "og:description", content: "Approve or revoke clinician verification status." },
    ],
  }),
});

function AdminCliniciansPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListClinicians);
  const setFn = useServerFn(adminSetClinicianVerified);

  const { data, isPending } = useQuery({
    queryKey: ["admin", "clinicians"],
    queryFn: () => listFn(),
  });

  const mut = useMutation({
    mutationFn: (vars: { user_id: string; verified: boolean }) => setFn({ data: vars }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "clinicians"] });
      toast.success(v.verified ? "Clinician verified." : "Verification removed.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AdminLayout
      title="Clinician verification"
      subtitle="Only verified professionals can request temporary access to patient records."
    >
      <SectionCard title="Registered clinicians">
        {isPending ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : (data ?? []).length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No clinician registrations yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {(data ?? []).map((c) => (
              <div key={c.user_id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{c.full_name}</span>
                    {c.verified && (
                      <span className="flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Verified
                      </span>
                    )}
                    {!c.verified && (
                      <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
                        Pending Verification
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {CLINICIAN_ROLE_LABEL[c.professional_role] ?? c.professional_role}
                    {c.hospital ? ` · ${c.hospital}` : ""}
                    {c.department ? ` · ${c.department}` : ""}
                    {c.license_no ? ` · ${c.license_no}` : ""}
                    {c.work_email ? ` · ${c.work_email}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={c.verified ? "outline" : "default"}
                  disabled={mut.isPending}
                  onClick={() => mut.mutate({ user_id: c.user_id, verified: !c.verified })}
                >
                  {c.verified ? "Remove verification" : "Verify"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </AdminLayout>
  );
}