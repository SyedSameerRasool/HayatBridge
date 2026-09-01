import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
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
  createAllergy,
  deleteAllergy,
  listAllergies,
} from "@/lib/patient.functions";

export const Route = createFileRoute("/allergies")({
  component: AllergiesPage,
  head: () => ({
    meta: [
      { title: "Allergies · HayatBridge" },
      { name: "description", content: "Manage your allergies securely: substance, reaction, and severity — stored with row-level security." },
      { property: "og:title", content: "Allergies · HayatBridge" },
      { property: "og:description", content: "Track allergies and reactions in your HayatBridge medical record." },
    ],
  }),
});

const SEVERITY_TONE: Record<string, string> = {
  mild: "bg-primary-soft text-primary",
  moderate: "bg-warning/15 text-warning-foreground",
  severe: "bg-destructive/10 text-destructive",
  "life-threatening": "bg-destructive text-destructive-foreground",
};

function AllergiesPage() {
  const user = useAuthUser();
  const qc = useQueryClient();
  const list = useServerFn(listAllergies);
  const create = useServerFn(createAllergy);
  const remove = useServerFn(deleteAllergy);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["allergies"],
    queryFn: () => list(),
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: (data: { substance: string; reaction: string; severity: "mild" | "moderate" | "severe" | "life-threatening"; notes: string }) => create({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allergies"] });
      toast.success("Allergy added");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allergies"] });
      toast.success("Allergy removed");
    },
  });

  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Clinical record
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">Allergies</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Stored securely in your account. Only you can see this list.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Add allergy
              </Button>
            </DialogTrigger>
            <AllergyDialog
              submitting={createMut.isPending}
              onSubmit={(v) => createMut.mutate(v, { onSuccess: () => setOpen(false) })}
            />
          </Dialog>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading ? (
            <Empty text="Loading…" />
          ) : rows.length === 0 ? (
            <Empty text="No allergies recorded. Add one above." />
          ) : (
            rows.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning-foreground">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-foreground">{a.substance}</div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${SEVERITY_TONE[a.severity] ?? SEVERITY_TONE.mild}`}>
                        {a.severity}
                      </span>
                    </div>
                    {a.reaction && (
                      <div className="mt-1 text-sm text-muted-foreground">Reaction: {a.reaction}</div>
                    )}
                    {a.notes && <p className="mt-2 text-sm text-muted-foreground">{a.notes}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => delMut.mutate(a.id)} aria-label="Delete allergy">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function AllergyDialog({
  submitting,
  onSubmit,
}: {
  submitting: boolean;
  onSubmit: (v: { substance: string; reaction: string; severity: "mild" | "moderate" | "severe" | "life-threatening"; notes: string }) => void;
}) {
  const [substance, setSubstance] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState<"mild" | "moderate" | "severe" | "life-threatening">("mild");
  const [notes, setNotes] = useState("");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add allergy</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label>Substance</Label>
          <Input value={substance} onChange={(e) => setSubstance(e.target.value)} placeholder="Penicillin" />
        </div>
        <div className="space-y-1.5">
          <Label>Reaction</Label>
          <Input value={reaction} onChange={(e) => setReaction(e.target.value)} placeholder="Rash, hives, anaphylaxis…" />
        </div>
        <div className="space-y-1.5">
          <Label>Severity</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as typeof severity)}
          >
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="life-threatening">Life-threatening</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Onset, date first noticed, treatments…" />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={!substance || submitting} onClick={() => onSubmit({ substance, reaction, severity, notes })}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
