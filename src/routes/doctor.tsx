import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  ClipboardList,
  Clock,
  FileText,
  FlaskConical,
  History,
  Pill,
  QrCode,
  ShieldCheck,
  ShieldOff,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getMyClinicianProfile, requestPatientAccess } from "@/lib/access.functions";
import { getAccessGrant } from "@/lib/access.functions";
import {
  doctorAddClinicalNote,
  doctorAddDiagnosis,
  doctorAddMedication,
  getPatientClinicalRecord,
  listMyClinicianAccessRequests,
  listMyClinicianAudit,
} from "@/lib/doctor.functions";
import { ACCESS_GRANT_MINUTES, CLINICIAN_ROLE_LABEL, UNVERIFIED_MESSAGE } from "@/lib/access.shared";

export const Route = createFileRoute("/doctor")({
  component: DoctorPortal,
  head: () => ({
    meta: [
      { title: "Doctor portal · HayatBridge" },
      {
        name: "description",
        content:
          "Verified clinicians scan a patient QR code, view consented records and add diagnoses, medications and clinical notes.",
      },
      { property: "og:title", content: "Doctor portal · HayatBridge" },
      {
        property: "og:description",
        content: "Consent-based clinician workspace for HayatBridge patient records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function extractToken(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const t = url.searchParams.get("token");
    if (t) return t;
  } catch {
    /* not a URL — treat as a raw code */
  }
  const match = value.match(/token=([A-Za-z0-9_-]+)/);
  if (match?.[1]) return match[1];
  return value.length >= 8 ? value : null;
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Pill;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="mt-3 space-y-2 text-sm">{children}</div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-sm text-muted-foreground">No {label} recorded.</div>;
}

function DoctorPortal() {
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const profileFn = useServerFn(getMyClinicianProfile);
  const requestFn = useServerFn(requestPatientAccess);
  const grantFn = useServerFn(getAccessGrant);
  const recordFn = useServerFn(getPatientClinicalRecord);
  const requestsFn = useServerFn(listMyClinicianAccessRequests);
  const auditFn = useServerFn(listMyClinicianAudit);
  const addDxFn = useServerFn(doctorAddDiagnosis);
  const addRxFn = useServerFn(doctorAddMedication);
  const addNoteFn = useServerFn(doctorAddClinicalNote);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => mounted && setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s?.user));
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const profileQuery = useQuery({
    enabled: signedIn === true,
    queryKey: ["clinicianProfile"],
    queryFn: () => profileFn(),
    retry: false,
  });

  const grantQuery = useQuery({
    enabled: !!requestId,
    queryKey: ["accessGrant", requestId],
    queryFn: () => grantFn({ data: { requestId: requestId! } }),
    refetchInterval: 3000,
  });

  const approved = grantQuery.data?.status === "approved";

  const recordQuery = useQuery({
    enabled: !!requestId && approved,
    queryKey: ["doctorRecord", requestId],
    queryFn: () => recordFn({ data: { requestId: requestId! } }),
    retry: false,
  });

  const requestsQuery = useQuery({
    enabled: signedIn === true,
    queryKey: ["clinicianRequests"],
    queryFn: () => requestsFn(),
    refetchInterval: 8000,
    retry: false,
  });

  const auditQuery = useQuery({
    enabled: signedIn === true,
    queryKey: ["clinicianAudit"],
    queryFn: () => auditFn(),
    refetchInterval: 15000,
    retry: false,
  });

  const requestMut = useMutation({
    mutationFn: (token: string) => requestFn({ data: { token } }),
    onSuccess: (res) => {
      if (res.ok) {
        setRequestId(res.requestId);
        setScanOpen(false);
        setCodeInput("");
        toast.success("Request sent. Waiting for the patient to approve.");
        qc.invalidateQueries({ queryKey: ["clinicianRequests"] });
      } else if (res.reason === "unverified") {
        toast.error(UNVERIFIED_MESSAGE);
      } else if (res.reason === "no_profile") {
        toast.error("Complete your clinician profile from a patient QR link first.");
      } else {
        toast.error("This share code is no longer valid. Ask the patient for a new QR code.");
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const refreshRecord = () => {
    qc.invalidateQueries({ queryKey: ["doctorRecord", requestId] });
    qc.invalidateQueries({ queryKey: ["clinicianAudit"] });
  };

  const addDx = useMutation({
    mutationFn: (v: { condition: string; severity: string; notes: string }) =>
      addDxFn({
        data: {
          requestId: requestId!,
          condition: v.condition,
          status: "active",
          severity: v.severity || null,
          notes: v.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Diagnosis added.");
      refreshRecord();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addRx = useMutation({
    mutationFn: (v: { name: string; dose: string; frequency: string }) =>
      addRxFn({
        data: {
          requestId: requestId!,
          name: v.name,
          dose: v.dose || null,
          frequency: v.frequency || null,
        },
      }),
    onSuccess: () => {
      toast.success("Medication added.");
      refreshRecord();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addNote = useMutation({
    mutationFn: (note: string) =>
      addNoteFn({ data: { requestId: requestId!, note, note_type: "consultation" } }),
    onSuccess: () => {
      toast.success("Clinical note saved.");
      refreshRecord();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (signedIn === false) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <Stethoscope className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-3 text-xl font-semibold text-foreground">Doctor portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your clinician account to continue.
          </p>
          <Button className="mt-5 w-full" asChild>
            <a href="/auth">Sign in</a>
          </Button>
        </main>
      </div>
    );
  }

  const clinician = profileQuery.data;
  const record = recordQuery.data;
  const secondsLeft =
    record?.grant.expires_at
      ? Math.max(0, Math.floor((new Date(record.grant.expires_at).getTime() - now) / 1000))
      : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-foreground">Doctor portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consent-based access to patient records. Every view and edit is audited.
        </p>

        {/* 1. Doctor profile */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] lg:col-span-2">
            {profileQuery.isPending ? (
              <div className="text-sm text-muted-foreground">Loading your profile…</div>
            ) : clinician ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-foreground">
                    {clinician.full_name}
                  </span>
                  {clinician.verified ? (
                    <span className="flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
                      <ShieldOff className="h-3.5 w-3.5" />
                      Pending verification
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-primary">
                  {CLINICIAN_ROLE_LABEL[clinician.professional_role] ??
                    clinician.professional_role}
                </div>
                <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                  <div>
                    Hospital ·{" "}
                    <span className="font-medium text-foreground">{clinician.hospital || "—"}</span>
                  </div>
                  <div>
                    Department ·{" "}
                    <span className="font-medium text-foreground">
                      {clinician.department || "—"}
                    </span>
                  </div>
                  <div>
                    License ·{" "}
                    <span className="font-medium text-foreground">
                      {clinician.license_no || "—"}
                    </span>
                  </div>
                  <div>
                    Work email ·{" "}
                    <span className="font-medium text-foreground">
                      {clinician.work_email || "—"}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                No clinician profile on file yet. Open a patient QR link to register your
                professional details, then wait for administrator verification.
              </div>
            )}
          </div>

          {/* 2. Scan Patient QR */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <QrCode className="h-4 w-4 text-primary" />
              Patient access
            </div>
            <Button
              className="mt-3 w-full"
              size="lg"
              disabled={!clinician?.verified}
              onClick={() => setScanOpen((v) => !v)}
            >
              Scan Patient QR
            </Button>
            {!clinician?.verified && (
              <p className="mt-2 text-xs text-muted-foreground">{UNVERIFIED_MESSAGE}</p>
            )}
            {scanOpen && (
              <div className="mt-3 space-y-2">
                <Label htmlFor="qr-code" className="text-xs">
                  Scanned QR link or share code
                </Label>
                <Input
                  id="qr-code"
                  value={codeInput}
                  placeholder="https://…/view/…?token=… or code"
                  onChange={(e) => setCodeInput(e.target.value)}
                />
                <Button
                  className="w-full"
                  disabled={requestMut.isPending}
                  onClick={() => {
                    const token = extractToken(codeInput);
                    if (!token) {
                      toast.error("Enter the scanned QR link or share code.");
                      return;
                    }
                    requestMut.mutate(token);
                  }}
                >
                  {requestMut.isPending ? "Requesting…" : "Request access"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Approved access lasts {ACCESS_GRANT_MINUTES} minutes and can be revoked by the
                  patient at any time.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 7. Consent / access status */}
        {requestId && (
          <div className="mt-6 rounded-2xl border border-border bg-surface p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Consent status
            </div>
            <div className="mt-1 text-muted-foreground">
              {approved ? (
                <span className="flex items-center gap-2 text-success">
                  <Clock className="h-4 w-4" />
                  Patient approved · expires in {mm}:{ss}
                </span>
              ) : grantQuery.data?.status === "pending" || !grantQuery.data ? (
                "Waiting for the patient to approve on their device…"
              ) : (
                `Access ${grantQuery.data.status}. Ask the patient to approve a new request.`
              )}
            </div>
          </div>
        )}

        {/* 3. Patient record */}
        {approved && (
          <>
            {recordQuery.isPending ? (
              <div className="mt-6 text-sm text-muted-foreground">Loading patient record…</div>
            ) : record ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <Card title="Drug allergies" icon={TriangleAlert}>
                  {record.allergies.length === 0 && <Empty label="allergies" />}
                  {record.allergies.map((a) => (
                    <div key={a.id} className="text-foreground">
                      <span className="font-medium">{a.substance}</span>
                      <span className="text-muted-foreground">
                        {a.severity ? ` · ${a.severity}` : ""}
                        {a.reaction ? ` · ${a.reaction}` : ""}
                      </span>
                    </div>
                  ))}
                </Card>

                <Card title="Current medications" icon={Pill}>
                  {record.medications.length === 0 && <Empty label="medications" />}
                  {record.medications.map((m) => (
                    <div key={m.id} className="text-foreground">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground">
                        {m.dose ? ` · ${m.dose}` : ""}
                        {m.frequency ? ` · ${m.frequency}` : ""}
                        {m.active ? "" : " · stopped"}
                      </span>
                    </div>
                  ))}
                </Card>

                <Card title="Diagnoses" icon={ClipboardList}>
                  {record.diagnoses.length === 0 && <Empty label="diagnoses" />}
                  {record.diagnoses.map((d) => (
                    <div key={d.id} className="text-foreground">
                      <span className="font-medium">{d.condition}</span>
                      <span className="text-muted-foreground">
                        {d.status ? ` · ${d.status}` : ""}
                        {d.severity ? ` · ${d.severity}` : ""}
                      </span>
                    </div>
                  ))}
                </Card>

                <Card title="Lab reports" icon={FlaskConical}>
                  {record.lab_reports.length === 0 && <Empty label="lab reports" />}
                  {record.lab_reports.map((t) => (
                    <div key={t.id} className="text-foreground">
                      <span className="font-medium">{t.test_name}</span>
                      <span className="text-muted-foreground">
                        {` · ${t.value}${t.unit ? ` ${t.unit}` : ""}`}
                        {t.flag ? ` · ${t.flag}` : ""}
                      </span>
                    </div>
                  ))}
                </Card>

                <Card title="Medical history" icon={History}>
                  {record.medical_history.length === 0 && <Empty label="history" />}
                  {record.medical_history.map((h) => (
                    <div key={h.id} className="text-foreground">
                      <span className="font-medium">{h.item}</span>
                      <span className="text-muted-foreground">
                        {h.category ? ` · ${h.category}` : ""}
                        {h.occurred_on ? ` · ${h.occurred_on}` : ""}
                      </span>
                    </div>
                  ))}
                </Card>

                <Card title="Clinical notes" icon={FileText}>
                  {record.clinical_notes.length === 0 && <Empty label="notes" />}
                  {record.clinical_notes.map((n) => (
                    <div key={n.id}>
                      <div className="text-xs text-muted-foreground">
                        {new Date(n.encounter_date).toLocaleString()} · {n.author_name}
                      </div>
                      <div className="whitespace-pre-line text-foreground">{n.note}</div>
                    </div>
                  ))}
                </Card>
              </div>
            ) : (
              <div className="mt-6 text-sm text-destructive">
                {(recordQuery.error as Error | null)?.message ?? "Record unavailable."}
              </div>
            )}

            {/* 4-6. Clinical entry forms */}
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <AddDiagnosisForm
                pending={addDx.isPending}
                onSubmit={(v) => addDx.mutate(v)}
              />
              <AddMedicationForm pending={addRx.isPending} onSubmit={(v) => addRx.mutate(v)} />
              <AddNoteForm pending={addNote.isPending} onSubmit={(v) => addNote.mutate(v)} />
            </div>
          </>
        )}

        {/* 7. Access history + audit */}
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card title="My access requests" icon={ShieldCheck}>
            {(requestsQuery.data ?? []).length === 0 && <Empty label="requests" />}
            {(requestsQuery.data ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  {new Date(r.requested_at).toLocaleString()}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium capitalize text-foreground">{r.status}</span>
                  {r.status === "approved" &&
                    r.expires_at &&
                    new Date(r.expires_at).getTime() > now && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => setRequestId(r.id)}
                      >
                        Open
                      </Button>
                    )}
                </span>
              </div>
            ))}
          </Card>

          <Card title="Audit trail (my actions)" icon={History}>
            {(auditQuery.data ?? []).length === 0 && <Empty label="audit entries" />}
            {(auditQuery.data ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3">
                <span className="font-medium text-foreground">{a.action}</span>
                <span className="text-muted-foreground">
                  {a.table_name} · {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </main>
    </div>
  );
}

function AddDiagnosisForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (v: { condition: string; severity: string; notes: string }) => void;
}) {
  const [condition, setCondition] = useState("");
  const [severity, setSeverity] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Card title="Add diagnosis" icon={ClipboardList}>
      <Input placeholder="Condition" value={condition} onChange={(e) => setCondition(e.target.value)} />
      <Input placeholder="Severity (optional)" value={severity} onChange={(e) => setSeverity(e.target.value)} />
      <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button
        className="w-full"
        disabled={pending || condition.trim().length < 2}
        onClick={() => {
          onSubmit({ condition, severity, notes });
          setCondition("");
          setSeverity("");
          setNotes("");
        }}
      >
        {pending ? "Saving…" : "Add diagnosis"}
      </Button>
    </Card>
  );
}

function AddMedicationForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (v: { name: string; dose: string; frequency: string }) => void;
}) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  return (
    <Card title="Add medication" icon={Pill}>
      <Input placeholder="Medication name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Dose (e.g. 500 mg)" value={dose} onChange={(e) => setDose(e.target.value)} />
      <Input placeholder="Frequency (e.g. twice daily)" value={frequency} onChange={(e) => setFrequency(e.target.value)} />
      <Button
        className="w-full"
        disabled={pending || name.trim().length < 1}
        onClick={() => {
          onSubmit({ name, dose, frequency });
          setName("");
          setDose("");
          setFrequency("");
        }}
      >
        {pending ? "Saving…" : "Add medication"}
      </Button>
    </Card>
  );
}

function AddNoteForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (v: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Card title="Add clinical note" icon={FileText}>
      <Textarea
        placeholder="Consultation note…"
        rows={5}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button
        className="w-full"
        disabled={pending || note.trim().length < 2}
        onClick={() => {
          onSubmit(note);
          setNote("");
        }}
      >
        {pending ? "Saving…" : "Save note"}
      </Button>
    </Card>
  );
}
