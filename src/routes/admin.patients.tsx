import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, ShieldOff, ShieldCheck, Eye } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SectionCard, StatusBadge } from "@/components/admin/AdminUI";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminListPatients, adminGetPatient, adminSetPatientStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/patients")({
  component: AdminPatients,
  head: () => ({
    meta: [
      { title: "Patients · HayatBridge Admin" },
      { name: "description", content: "Search, review and manage HayatBridge patient accounts." },
      { property: "og:title", content: "Patients · HayatBridge Admin" },
      { property: "og:description", content: "Account administration for registered HayatBridge patients." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminPatients() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "deactivated">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const listFn = useServerFn(adminListPatients);
  const detailFn = useServerFn(adminGetPatient);
  const statusFn = useServerFn(adminSetPatientStatus);

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["admin", "patients", search, status],
    queryFn: () => listFn({ data: { search, status } }),
  });

  const { data: detail } = useQuery({
    queryKey: ["admin", "patient", openId],
    queryFn: () => detailFn({ data: { id: openId as string } }),
    enabled: Boolean(openId),
  });

  const toggle = useMutation({
    mutationFn: (vars: { id: string; status: "active" | "deactivated" }) => statusFn({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(vars.status === "active" ? "Account reactivated" : "Account deactivated");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminLayout title="Patients" subtitle="Account administration only — clinical records and passwords are never shown here.">
      <SectionCard title="Patient directory" description={`${patients.length} account(s) shown`}>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="deactivated">Deactivated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Registered</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Loading patients…</td></tr>
              )}
              {!isLoading && patients.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No patients match this search.</td></tr>
              )}
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-muted/40">
                  <td className="px-3 py-3 font-medium">{p.full_name || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{p.email}</td>
                  <td className="px-3 py-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-3"><StatusBadge status={p.account_status} /></td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setOpenId(p.id)}>
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                      </Button>
                      {p.account_status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => toggle.mutate({ id: p.id, status: "deactivated" })}
                        >
                          <ShieldOff className="mr-1.5 h-3.5 w-3.5" /> Deactivate
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => toggle.mutate({ id: p.id, status: "active" })}>
                          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Reactivate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Dialog open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Patient account</DialogTitle></DialogHeader>
          {detail?.profile ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Full name" value={detail.profile.full_name || "—"} />
              <Field label="Email" value={detail.profile.email} />
              <Field label="Phone" value={detail.profile.phone ?? "—"} />
              <Field label="CNIC" value={detail.profile.cnic ?? "—"} />
              <Field label="Registered" value={new Date(detail.profile.created_at).toLocaleString()} />
              <Field label="Last login" value={detail.profile.last_login_at ? new Date(detail.profile.last_login_at).toLocaleString() : "Never"} />
              <Field label="QR profiles" value={String(detail.qrCount)} />
              <Field label="Record views" value={String(detail.accessCount)} />
              <Field label="Consent" value={detail.profile.consent_revoked ? "Revoked" : "Active"} />
              <Field label="Account status" value={detail.profile.account_status} />
              <p className="col-span-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                Passwords and medical records are never accessible from the admin console.
              </p>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium capitalize">{value}</dd>
    </div>
  );
}
