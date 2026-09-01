import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, CreditCard, Leaf } from "lucide-react";
import { toast } from "sonner";
import { AppHeader, useAuthUser } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getBillingPreferences,
  listBillingStatements,
  updateBillingPreferences,
} from "@/lib/patient.functions";

export const Route = createFileRoute("/billing")({
  component: BillingPage,
});

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function BillingPage() {
  const user = useAuthUser();
  const qc = useQueryClient();
  const listBills = useServerFn(listBillingStatements);
  const getPrefs = useServerFn(getBillingPreferences);
  const updatePrefs = useServerFn(updateBillingPreferences);

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ["billing-statements"],
    queryFn: () => listBills(),
    enabled: !!user,
  });

  const { data: prefs } = useQuery({
    queryKey: ["billing-preferences"],
    queryFn: () => getPrefs(),
    enabled: !!user,
  });

  const prefMut = useMutation({
    mutationFn: (data: { paperless: boolean; delivery_email: string | null }) =>
      updatePrefs({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-preferences"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [confirm, setConfirm] = useState<null | boolean>(null);

  if (!user) return null;

  const totalOwed = bills
    .filter((b) => b.status !== "paid")
    .reduce((s, b) => s + b.amount_cents, 0);
  const paperless = !!prefs?.paperless;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Financial
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Billing summary</h1>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <SummaryTile
            label="Balance"
            value={money(totalOwed)}
            tone={totalOwed > 0 ? "warning" : "success"}
          />
          <SummaryTile
            label="Statements"
            value={String(bills.length)}
            tone="default"
          />
          <SummaryTile
            label="Delivery"
            value={paperless ? "Paperless" : "Mail"}
            tone={paperless ? "success" : "default"}
          />
        </div>

        {/* Paperless preference */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
              <Leaf className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-foreground">Paperless billing</div>
                  <div className="text-sm text-muted-foreground">
                    Receive statements by email only. Reduces mailings and reaches you faster.
                  </div>
                </div>
                <Switch
                  checked={paperless}
                  onCheckedChange={(next) => setConfirm(next)}
                  aria-label="Toggle paperless billing"
                />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                <span
                  className={`h-2 w-2 rounded-full ${paperless ? "bg-success" : "bg-muted-foreground"}`}
                />
                <span>
                  {paperless ? "Active" : "Inactive"}
                  {prefs?.updated_at
                    ? ` · updated ${format(new Date(prefs.updated_at), "MMM d, yyyy")}`
                    : ""}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Statements list */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : bills.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <CreditCard className="h-6 w-6" />
              </div>
              <div className="mt-3 text-sm font-medium text-foreground">No statements</div>
              <p className="mt-1 text-sm text-muted-foreground">
                You have no billing statements yet.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Statement</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Due</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{b.description}</div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        Issued {format(new Date(b.issued_at), "MMM d, yyyy")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                      {money(b.amount_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={b.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {b.due_date ? format(new Date(b.due_date), "MMM d, yyyy") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Paperless confirmation */}
      <AlertDialog open={confirm !== null} onOpenChange={() => setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm ? "Enable paperless billing?" : "Disable paperless billing?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm
                ? `Statements will be sent by email to ${user.email} instead of mailed. You can switch back any time.`
                : "Statements will be sent by physical mail again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm === null) return;
                prefMut.mutate(
                  { paperless: confirm, delivery_email: confirm ? user.email : null },
                  {
                    onSuccess: () => {
                      toast.success(confirm ? "Paperless billing enabled" : "Paperless billing disabled");
                      setConfirm(null);
                    },
                  },
                );
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "success" | "warning";
}) {
  const cls =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning-foreground"
        : "bg-primary-soft text-primary";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-3 inline-block rounded-lg px-2.5 py-1 text-xl font-semibold tabular-nums ${cls}`}>
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "bg-success/15 text-success"
      : status === "overdue"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning/15 text-warning-foreground";
  const Icon = status === "paid" ? CheckCircle2 : AlertCircle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}
