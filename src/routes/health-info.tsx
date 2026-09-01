import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader, useRequirePatient } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getMyProfile, getMyConsent, updateMyProfile } from "@/lib/patient.functions";
import { downloadHealthSummaryPdf } from "@/lib/pdf-export";
import { toast } from "sonner";

export const Route = createFileRoute("/health-info")({
  component: HealthInfoPage,
  head: () => ({
    meta: [
      { title: "Health Summary · HayatBridge" },
      { name: "description", content: "Manage your medical record and download a shareable PDF containing only the fields you have approved." },
      { property: "og:title", content: "Health Summary · HayatBridge" },
      { property: "og:description", content: "Manage your health record and export a consent-scoped PDF." },
    ],
  }),
});

function HealthInfoPage() {
  const patient = useRequirePatient();
  const navigate = useNavigate();
  const [form, setForm] = useState(patient?.health);

  const profileFn = useServerFn(getMyProfile);
  const consentFn = useServerFn(getMyConsent);
  const updateFn = useServerFn(updateMyProfile);

  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const consentQuery = useQuery({ queryKey: ["consent"], queryFn: () => consentFn() });

  // Prime form from backend profile when it loads (backend is source of truth).
  useEffect(() => {
    const p = profileQuery.data;
    if (!p || !form) return;
    setForm({
      fullName: p.full_name ?? form.fullName,
      dateOfBirth: p.date_of_birth ?? form.dateOfBirth,
      bloodType: p.blood_type ?? form.bloodType,
      phone: p.phone ?? form.phone,
      emergencyContact: p.emergency_contact ?? form.emergencyContact,
      allergies: p.allergies ?? form.allergies,
      medications: p.medications ?? form.medications,
      diagnoses: p.diagnoses ?? form.diagnoses,
      recentReports: p.recent_reports ?? form.recentReports,
      notes: p.notes ?? form.notes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQuery.data]);

  const saveMut = useMutation({
    mutationFn: async (payload: NonNullable<typeof form>) =>
      updateFn({
        data: {
          full_name: payload.fullName || undefined,
          date_of_birth: payload.dateOfBirth || null,
          blood_type: payload.bloodType || null,
          phone: payload.phone || null,
          emergency_contact: payload.emergencyContact || null,
          allergies: payload.allergies || null,
          medications: payload.medications || null,
          diagnoses: payload.diagnoses || null,
          recent_reports: payload.recentReports || null,
          notes: payload.notes || null,
        },
      }),
  });

  const locked = profileQuery.data?.initial_setup_completed === true;

  if (!patient || !form) return null;

  const set = <K extends keyof typeof form>(k: K, v: string) => setForm({ ...form, [k]: v });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveMut.mutateAsync(form);
      toast.success("Health information updated.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const downloadPdf = () => {
    const profile = profileQuery.data;
    const consent = consentQuery.data;
    if (!profile) {
      toast.error("Profile still loading, try again in a moment.");
      return;
    }
    const approved = (consent?.consent_fields ?? []) as string[];
    if (approved.length === 0) {
      toast.error("No fields are approved in Consent. Approve fields first.");
      return;
    }
    if (consent?.consent_revoked) {
      toast.error("Consent is currently revoked. Restore consent to export.");
      return;
    }
    downloadHealthSummaryPdf(
      {
        full_name: profile.full_name,
        date_of_birth: profile.date_of_birth,
        blood_type: profile.blood_type,
        phone: profile.phone,
        emergency_contact: profile.emergency_contact,
        allergies: profile.allergies,
        medications: profile.medications,
        diagnoses: profile.diagnoses,
        recent_reports: profile.recent_reports,
        notes: profile.notes,
      },
      approved,
    );
    toast.success("PDF ready — check your downloads.");
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Your health information
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Backed by your HayatBridge record. Downloads only include sections you have
              approved on the Consent page.
            </p>
          </div>
          <Button variant="outline" onClick={downloadPdf}>
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>

        <form
          onSubmit={save}
          className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
        >
          <Section title="Identity">
            <Field label={locked ? "Full name (locked)" : "Full name"}>
              <Input readOnly={locked} disabled={locked} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
            </Field>
            <Field label={locked ? "Date of birth (locked)" : "Date of birth"}>
              <Input readOnly={locked} disabled={locked} type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
            </Field>
            <Field label="Blood type">
              <Input placeholder="e.g. O+" value={form.bloodType} onChange={(e) => set("bloodType", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Emergency contact" full>
              <Input
                placeholder="Name, relationship, phone"
                value={form.emergencyContact}
                onChange={(e) => set("emergencyContact", e.target.value)}
              />
            </Field>
          </Section>

          <Section title="Clinical">
            <Field label={locked ? "Known allergies (locked)" : "Known allergies"} full>
              <Textarea readOnly={locked} disabled={locked} rows={2} placeholder="e.g. Penicillin, peanuts" value={form.allergies} onChange={(e) => set("allergies", e.target.value)} />
            </Field>
            <Field label="Current medications" full>
              <Textarea rows={3} placeholder="Name · dose · frequency" value={form.medications} onChange={(e) => set("medications", e.target.value)} />
            </Field>
            <Field label={locked ? "Active diagnoses (locked)" : "Active diagnoses"} full>
              <Textarea readOnly={locked} disabled={locked} rows={2} value={form.diagnoses} onChange={(e) => set("diagnoses", e.target.value)} />
            </Field>
            <Field label="Recent reports" full>
              <Textarea rows={4} placeholder="Lab results, imaging summaries, discharge notes" value={form.recentReports} onChange={(e) => set("recentReports", e.target.value)} />
            </Field>
            <Field label="Additional notes" full>
              <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </Section>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-2 ${full ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
