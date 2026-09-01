import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ShieldOff } from "lucide-react";
import { AppHeader, useRequirePatient } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FIELD_LABELS, type HealthInfo } from "@/lib/health-fields";
import { getMyConsent, updateMyConsent } from "@/lib/patient.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/consent")({
  component: ConsentPage,
});

const SHAREABLE: (keyof HealthInfo)[] = [
  "fullName",
  "dateOfBirth",
  "bloodType",
  "phone",
  "emergencyContact",
  "allergies",
  "medications",
  "diagnoses",
  "recentReports",
  "notes",
];

const DURATIONS = [
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
];

function ConsentPage() {
  const patient = useRequirePatient();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const consentFn = useServerFn(getMyConsent);
  const updateFn = useServerFn(updateMyConsent);
  const consentQuery = useQuery({
    queryKey: ["consent"],
    queryFn: () => consentFn(),
    enabled: !!patient,
  });
  const [fields, setFields] = useState<string[]>([]);
  const [duration, setDuration] = useState<number>(24 * 60 * 60 * 1000);

  useEffect(() => {
    const c = consentQuery.data;
    if (c) setFields(c.consent_fields ?? []);
  }, [consentQuery.data]);

  const saveMut = useMutation({
    mutationFn: (payload: {
      consent_fields?: string[];
      consent_expires_at?: string | null;
      consent_revoked?: boolean;
    }) => updateFn({ data: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consent"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  if (!patient) return null;

  const toggle = (f: string) =>
    setFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const save = async () => {
    await saveMut.mutateAsync({
      consent_fields: fields,
      consent_expires_at: new Date(Date.now() + duration).toISOString(),
      consent_revoked: false,
    });
    toast.success("Consent updated.");
    navigate({ to: "/dashboard" });
  };

  const revoke = async () => {
    await saveMut.mutateAsync({ consent_revoked: true });
    toast.success("All active access has been revoked.");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Consent & privacy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Decide what your care team sees when they scan your QR code, and for how long.
        </p>

        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Sections to share
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {SHAREABLE.map((f) => (
                <label
                  key={f}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:bg-secondary"
                >
                  <Checkbox
                    checked={fields.includes(f)}
                    onCheckedChange={() => toggle(f)}
                  />
                  <span className="text-sm font-medium text-foreground">{FIELD_LABELS[f]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Access duration
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              After this window, your QR code will stop granting access.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {DURATIONS.map((d) => (
                <button
                  key={d.ms}
                  type="button"
                  onClick={() => setDuration(d.ms)}
                  className={`rounded-xl border p-3 text-sm font-medium transition-colors ${
                    duration === d.ms
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface text-foreground hover:bg-secondary"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={save}>
              Save consent settings
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
              Cancel
            </Button>
          </div>

          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <Label className="text-base font-semibold text-foreground">
                  Emergency revoke
                </Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Immediately stop every provider from accessing your record. You can re-enable
                  sharing later from this page.
                </p>
              </div>
              <Button variant="destructive" onClick={revoke}>
                <ShieldOff className="h-4 w-4" />
                Revoke all access
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
