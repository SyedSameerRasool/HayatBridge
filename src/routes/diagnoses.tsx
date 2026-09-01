import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Stethoscope, Plus, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader, useAuthUser } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createDiagnosis,
  deleteDiagnosis,
  listDiagnoses,
} from "@/lib/patient.functions";

export const Route = createFileRoute("/diagnoses")({
  component: DiagnosesPage,
  head: () => ({
    meta: [
      { title: "Diagnoses Timeline · HayatBridge" },
      {
        name: "description",
        content:
          "A dated timeline of your active, chronic, and resolved conditions with ICD-10 codes — securely stored in your HayatBridge health record.",
      },
      { property: "og:title", content: "Diagnoses Timeline · HayatBridge" },
      {
        property: "og:description",
        content: "Track diagnosed conditions with ICD-10 codes and dates in HayatBridge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type DxForm = {
  condition: string;
  icd10_code: string;
  status: string;
  severity: string;
  onset_date: string;
  diagnosed_date: string;
  resolved_date: string;
  provider: string;
  notes: string;
};

const emptyForm: DxForm = {
  condition: "",
  icd10_code: "",
  status: "active",
  severity: "",
  onset_date: "",
  diagnosed_date: "",
  resolved_date: "",
  provider: "",
  notes: "",
};

type Dx = {
  id: string;
  condition: string;
  icd10_code: string | null;
  status: string;
  severity: string | null;
  onset_date: string | null;
  diagnosed_date: string | null;
  resolved_date: string | null;
  provider: string | null;
  notes: string | null;
};

function fmt(d: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sortKey(d: Dx) {
  return d.diagnosed_date || d.onset_date || "";
}

function DiagnosesPage() {
  const user = useAuthUser();
  const qc = useQueryClient();
  const list = useServerFn(listDiagnoses);
  const create = useServerFn(createDiagnosis);
  const remove = useServerFn(deleteDiagnosis);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["diagnoses"],
    queryFn: () => list(),
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: (data: DxForm) =>
      create({
        data: {
          condition: data.condition,
          icd10_code: data.icd10_code.trim().toUpperCase() || null,
          status: data.status,
          severity: data.severity || null,
          onset_date: data.onset_date || null,
          diagnosed_date: data.diagnosed_date || null,
          resolved_date: data.resolved_date || null,
          provider: data.provider || null,
          notes: data.notes || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diagnoses"] });
      toast.success("Diagnosis added");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diagnoses"] });
      toast.success("Diagnosis removed");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [open, setOpen] = useState(false);
  if (!user) return null;

  const all = rows as unknown as Dx[];
  const byRecent = [...all].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  const current = byRecent.filter((r) => r.status !== "resolved");
  const resolved = byRecent
    .filter((r) => r.status === "resolved")
    .sort((a, b) => (b.resolved_date || "").localeCompare(a.resolved_date || ""));

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Clinical record
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">Diagnoses timeline</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Conditions in date order with ICD-10 codes — visible only to you unless shared.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Add diagnosis
              </Button>
            </DialogTrigger>
            <DxDialog
              submitting={createMut.isPending}
              onSubmit={(v) => createMut.mutate(v, { onSuccess: () => setOpen(false) })}
            />
          </Dialog>
        </div>

        <Section title="Ongoing conditions" count={current.length}>
          {isLoading ? (
            <Empty text="Loading…" />
          ) : current.length === 0 ? (
            <Empty text="No active or chronic diagnoses recorded." />
          ) : (
            <Timeline items={current} onDelete={(id) => delMut.mutate(id)} />
          )}
        </Section>

        <Section title="Resolved" count={resolved.length}>
          {resolved.length === 0 ? (
            <Empty text="No resolved diagnoses yet." />
          ) : (
            <Timeline items={resolved} onDelete={(id) => delMut.mutate(id)} />
          )}
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="mt-3">{children}</div>
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

function statusClass(status: string) {
  if (status === "chronic") return "bg-accent text-accent-foreground";
  if (status === "resolved") return "bg-secondary text-muted-foreground";
  return "bg-primary-soft text-primary";
}

function Timeline({ items, onDelete }: { items: Dx[]; onDelete: (id: string) => void }) {
  return (
    <ol className="relative ml-3 border-l border-border pl-6">
      {items.map((d) => {
        const start = fmt(d.diagnosed_date) || fmt(d.onset_date);
        const end = fmt(d.resolved_date);
        const isResolved = d.status === "resolved";
        return (
          <li key={d.id} className="relative pb-5 last:pb-0">
            <span
              className={`absolute -left-[31px] top-4 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${
                isResolved ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground"
              }`}
            >
              {isResolved ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <Stethoscope className="h-3 w-3" />
              )}
            </span>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="text-xs font-medium tabular-nums text-muted-foreground">
                    {start || "Date not recorded"}
                    {end ? ` → ${end}` : isResolved ? "" : " → present"}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-foreground">{d.condition}</div>
                    {d.icd10_code && (
                      <span className="rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide text-muted-foreground">
                        ICD-10 {d.icd10_code}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusClass(d.status)}`}
                    >
                      {d.status}
                    </span>
                    {d.severity && (
                      <span className="text-xs text-muted-foreground">{d.severity}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {d.onset_date && <span>Onset {fmt(d.onset_date)}</span>}
                    {d.diagnosed_date && <span>Diagnosed {fmt(d.diagnosed_date)}</span>}
                    {d.resolved_date && <span>Resolved {fmt(d.resolved_date)}</span>}
                    {d.provider && <span>By {d.provider}</span>}
                  </div>
                  {d.notes && (
                    <p className="mt-2 text-sm text-muted-foreground">{d.notes}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(d.id)}
                  aria-label="Delete diagnosis"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DxDialog({
  submitting,
  onSubmit,
}: {
  submitting: boolean;
  onSubmit: (v: DxForm) => void;
}) {
  const [form, setForm] = useState<DxForm>(emptyForm);
  const set = (k: keyof DxForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add diagnosis</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="dx-condition">Condition</Label>
          <Input
            id="dx-condition"
            value={form.condition}
            onChange={(e) => set("condition", e.target.value)}
            placeholder="e.g. Type 2 diabetes"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="dx-icd">ICD-10 code</Label>
          <Input
            id="dx-icd"
            value={form.icd10_code}
            onChange={(e) => set("icd10_code", e.target.value)}
            placeholder="e.g. E11.9"
            className="font-mono uppercase"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Optional. Standard diagnosis code used by clinicians and insurers.
          </p>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="chronic">Chronic</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Severity</Label>
          <Select value={form.severity} onValueChange={(v) => set("severity", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Mild">Mild</SelectItem>
              <SelectItem value="Moderate">Moderate</SelectItem>
              <SelectItem value="Severe">Severe</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="dx-onset">Symptom onset</Label>
          <Input
            id="dx-onset"
            type="date"
            value={form.onset_date}
            onChange={(e) => set("onset_date", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="dx-start">Date of diagnosis</Label>
          <Input
            id="dx-start"
            type="date"
            value={form.diagnosed_date}
            onChange={(e) => set("diagnosed_date", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="dx-end">Resolved on</Label>
          <Input
            id="dx-end"
            type="date"
            value={form.resolved_date}
            onChange={(e) => set("resolved_date", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="dx-provider">Diagnosed by</Label>
          <Input
            id="dx-provider"
            value={form.provider}
            onChange={(e) => set("provider", e.target.value)}
            placeholder="e.g. Dr. Amina Rahman"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="dx-notes">Notes</Label>
          <Textarea
            id="dx-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={submitting || !form.condition.trim()}
          onClick={() => onSubmit(form)}
        >
          {submitting ? "Saving…" : "Save diagnosis"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
