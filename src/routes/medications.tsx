import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Pill, Plus, X, Check, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { AppHeader, useAuthUser } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createMedication,
  deleteMedication,
  getMyRoles,
  listMedications,
  updateMedication,
} from "@/lib/patient.functions";

export const Route = createFileRoute("/medications")({
  component: MedicationsPage,
  head: () => ({
    meta: [
      { title: "Medications · HayatBridge" },
      { name: "description", content: "Track current and past medications with dose, frequency, and prescriber — securely stored in your HayatBridge record." },
      { property: "og:title", content: "Medications · HayatBridge" },
      { property: "og:description", content: "Manage your medication list in HayatBridge." },
    ],
  }),
});

type MedForm = {
  name: string;
  dose: string;
  frequency: string;
  route: string;
  prescriber: string;
  reason: string;
  start_date: string;
  end_date: string;
  active: boolean;
  notes: string;
};

function MedicationsPage() {
  const user = useAuthUser();
  const qc = useQueryClient();
  const list = useServerFn(listMedications);
  const create = useServerFn(createMedication);
  const update = useServerFn(updateMedication);
  const remove = useServerFn(deleteMedication);
  const roles = useServerFn(getMyRoles);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["medications"],
    queryFn: () => list(),
    enabled: !!user,
  });

  const { data: roleInfo } = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => roles(),
    enabled: !!user,
  });
  const canPrescribe = !!roleInfo?.canPrescribe;

  const createMut = useMutation({
    mutationFn: (data: MedForm) => create({ data: normalize(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medications"] });
      toast.success("Medication added");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => update({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medications"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medications"] });
      toast.success("Medication removed");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [open, setOpen] = useState(false);
  if (!user) return null;

  const active = rows.filter((r) => r.active);
  const inactive = rows.filter((r) => !r.active);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Clinical record
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">Medications</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {canPrescribe
                ? "You have prescriber access — you can add and update medication entries."
                : "Read-only. Medication entries are managed by your doctor or pharmacist."}
            </p>
          </div>
          {canPrescribe && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" /> Add medication
                </Button>
              </DialogTrigger>
              <MedDialog
                submitting={createMut.isPending}
                onSubmit={(v) => createMut.mutate(v, { onSuccess: () => setOpen(false) })}
              />
            </Dialog>
          )}
        </div>

        {!canPrescribe && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-secondary/60 p-4 text-sm text-muted-foreground">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              For patient safety, only verified doctors and pharmacists can add or change
              medications. Ask your provider to update this list at your next visit.
            </p>
          </div>
        )}

        <Section title="Active" count={active.length}>
          {isLoading ? (
            <Empty text="Loading…" />
          ) : active.length === 0 ? (
            <Empty text="No active medications." />
          ) : (
            active.map((m) => (
              <MedCard
                key={m.id}
                med={m}
                canEdit={canPrescribe}
                onDeactivate={() => toggleMut.mutate({ id: m.id, active: false })}
                onDelete={() => delMut.mutate(m.id)}
              />
            ))
          )}
        </Section>

        <Section title="Past" count={inactive.length}>
          {inactive.length === 0 ? (
            <Empty text="No past medications yet." />
          ) : (
            inactive.map((m) => (
              <MedCard
                key={m.id}
                med={m}
                canEdit={canPrescribe}
                onReactivate={() => toggleMut.mutate({ id: m.id, active: true })}
                onDelete={() => delMut.mutate(m.id)}
              />
            ))
          )}
        </Section>

      </main>
    </div>
  );
}

function normalize(v: MedForm) {
  return {
    name: v.name,
    dose: v.dose || null,
    frequency: v.frequency || null,
    route: v.route || null,
    prescriber: v.prescriber || null,
    reason: v.reason || null,
    start_date: v.start_date || null,
    end_date: v.end_date || null,
    active: v.active,
    notes: v.notes || null,
  };
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

type Med = {
  id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  route: string | null;
  prescriber: string | null;
  reason: string | null;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  notes: string | null;
};

function MedCard({
  med,
  canEdit,
  onDeactivate,
  onReactivate,
  onDelete,
}: {
  med: Med;
  canEdit: boolean;
  onDeactivate?: () => void;
  onReactivate?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Pill className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <div className="font-semibold text-foreground">{med.name}</div>
            {med.dose && <span className="text-sm text-muted-foreground">{med.dose}</span>}
            {med.frequency && (
              <span className="text-sm text-muted-foreground">· {med.frequency}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            {med.route && <span>Route: {med.route}</span>}
            {med.prescriber && <span>Prescribed by {med.prescriber}</span>}
            {med.reason && <span>For: {med.reason}</span>}
            {med.start_date && <span>Started {med.start_date}</span>}
            {med.end_date && <span>Ended {med.end_date}</span>}
          </div>
          {med.notes && <p className="mt-2 text-sm text-muted-foreground">{med.notes}</p>}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {onDeactivate && (
              <Button variant="outline" size="sm" onClick={onDeactivate}>
                Mark inactive
              </Button>
            )}
            {onReactivate && (
              <Button variant="outline" size="sm" onClick={onReactivate}>
                <Check className="h-4 w-4" /> Reactivate
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete medication">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}

function MedDialog({
  submitting,
  onSubmit,
}: {
  submitting: boolean;
  onSubmit: (v: MedForm) => void;
}) {
  const [form, setForm] = useState<MedForm>({
    name: "",
    dose: "",
    frequency: "",
    route: "",
    prescriber: "",
    reason: "",
    start_date: "",
    end_date: "",
    active: true,
    notes: "",
  });
  const set = <K extends keyof MedForm>(k: K, v: MedForm[K]) => setForm({ ...form, [k]: v });

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add medication</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Atorvastatin" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Dose</Label>
            <Input value={form.dose} onChange={(e) => set("dose", e.target.value)} placeholder="20 mg" />
          </div>
          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <Input value={form.frequency} onChange={(e) => set("frequency", e.target.value)} placeholder="Once daily" />
          </div>
          <div className="space-y-1.5">
            <Label>Route</Label>
            <Input value={form.route} onChange={(e) => set("route", e.target.value)} placeholder="Oral" />
          </div>
          <div className="space-y-1.5">
            <Label>Prescriber</Label>
            <Input value={form.prescriber} onChange={(e) => set("prescriber", e.target.value)} placeholder="Dr. Rania Osman" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Reason</Label>
            <Input value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="High cholesterol" />
          </div>
          <div className="space-y-1.5">
            <Label>Start date</Label>
            <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>End date</Label>
            <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Side effects, timing, etc." />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={!form.name || submitting} onClick={() => onSubmit(form)}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
