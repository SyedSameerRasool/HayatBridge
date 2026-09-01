import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  Pill,
  ShieldOff,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getShareTokenStatus, type ShareStatus } from "@/lib/patient.functions";
import {
  getAccessGrant,
  getMyClinicianProfile,
  requestPatientAccess,
  saveMyClinicianProfile,
} from "@/lib/access.functions";
import {
  ACCESS_GRANT_MINUTES,
  CLINICIAN_ROLES,
  CLINICIAN_ROLE_LABEL,
  UNVERIFIED_MESSAGE,
  type ClinicianRole,
} from "@/lib/access.shared";
import { toast } from "sonner";

type Search = { role?: "doctor" | "pharmacist" | "hospital"; token?: string };

export const Route = createFileRoute("/view/$patientId")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    role:
      s.role === "pharmacist" || s.role === "hospital" || s.role === "doctor"
        ? s.role
        : "doctor",
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: ProviderView,
  head: () => ({
    meta: [
      { title: "Provider view · HayatBridge" },
      { name: "description", content: "Verified clinicians request patient-approved, time-limited access to a HayatBridge health summary." },
      { property: "og:title", content: "Provider view · HayatBridge" },
      { property: "og:description", content: "Verified provider access to a patient's shared health record." },
    ],
  }),
});

const ROLE_ICON = {
  doctor: Stethoscope,
  emergency_physician: Stethoscope,
  pharmacist: Pill,
  nurse: UserRound,
} as const;

const FIELD_LABELS: Record<string, string> = {
  full_name: "Full name",
  date_of_birth: "Date of birth",
  blood_type: "Blood type",
  phone: "Phone",
  emergency_contact: "Emergency contact",
  allergies: "Allergies",
  medications: "Medications",
  diagnoses: "Diagnoses",
  recent_reports: "Recent reports",
  notes: "Notes",
};

const CONSENT_TO_COL: Record<string, string> = {
  fullName: "full_name",
  dateOfBirth: "date_of_birth",
  bloodType: "blood_type",
  phone: "phone",
  emergencyContact: "emergency_contact",
  allergies: "allergies",
  medications: "medications",
  diagnoses: "diagnoses",
  recentReports: "recent_reports",
  notes: "notes",
};

function ProviderView() {
  const { token: tokenValue } = useSearch({ from: "/view/$patientId" });
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const statusFn = useServerFn(getShareTokenStatus);
  const profileFn = useServerFn(getMyClinicianProfile);
  const saveProfileFn = useServerFn(saveMyClinicianProfile);
  const requestFn = useServerFn(requestPatientAccess);
  const grantFn = useServerFn(getAccessGrant);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setSignedIn(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session?.user),
    );
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const statusQuery = useQuery({
    enabled: !!tokenValue && !requestId,
    queryKey: ["tokenStatus", tokenValue],
    retry: 1,
    queryFn: async () => {
      try {
        return await statusFn({ data: { token: tokenValue! } });
      } catch {
        // Never blank the page if the status lookup fails (stale client bundle,
        // network hiccup): treat it as an unresolvable token.
        return { status: "unknown" as ShareStatus };
      }
    },
  });


  const clinicianQuery = useQuery({
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

  const requestMut = useMutation({
    mutationFn: () => requestFn({ data: { token: tokenValue! } }),
    onSuccess: (res) => {
      if (res.ok) {
        setRequestId(res.requestId);
        setBlocked(null);
      } else if (res.reason === "unverified") {
        setBlocked(UNVERIFIED_MESSAGE);
      } else if (res.reason === "consent_revoked") {
        setBlocked("The patient has revoked sharing entirely. Please ask them to restore consent.");
      } else {
        setBlocked("This share code is no longer valid. Please ask the patient for a new QR code.");
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const grant = grantQuery.data;

  // 1. No token in the link.
  if (!tokenValue) {
    return (
      <Shell>
        <InvalidTokenState status="unknown" hasToken={false} />
      </Shell>
    );
  }

  // 2. Token must be live before we even ask the clinician to identify themselves.
  if (!requestId) {
    if (statusQuery.isPending) {
      return (
        <Shell>
          <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
            Verifying share link…
          </div>
        </Shell>
      );
    }
    if (statusQuery.data && statusQuery.data.status !== "valid") {
      return (
        <Shell>
          <InvalidTokenState status={statusQuery.data.status} hasToken />
        </Shell>
      );
    }
  }

  // 3. Clinician must be signed in.
  if (signedIn === null) {
    return (
      <Shell>
        <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
          Checking your clinician session…
        </div>
      </Shell>
    );
  }

  if (!signedIn) {
    return (
      <Shell>
        <Panel
          icon={Stethoscope}
          title="Sign in to request access"
          body="Patient records are only released to signed-in, verified healthcare professionals. Sign in with your clinician account to continue."
        >
          <Button asChild className="w-full" size="lg">
            <Link to="/auth">Sign in</Link>
          </Button>
        </Panel>
      </Shell>
    );
  }

  const clinician = clinicianQuery.data;

  // 4. Clinician identity on file (name, role, hospital, department).
  if (clinicianQuery.isPending) {
    return (
      <Shell>
        <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
          Loading your clinician profile…
        </div>
      </Shell>
    );
  }

  if (!clinician) {
    return (
      <Shell>
        <ClinicianRegistration
          onSave={async (values) => {
            await saveProfileFn({ data: values });
            await clinicianQuery.refetch();
          }}
        />
      </Shell>
    );
  }

  // 5. Verification gate.
  if (!clinician.verified) {
    return (
      <Shell>
        <Panel icon={ShieldOff} title="Access denied" body={UNVERIFIED_MESSAGE} destructive>
          <div className="rounded-xl border border-border bg-surface p-3 text-left text-xs text-muted-foreground">
            Your account ({clinician.full_name} ·{" "}
            {CLINICIAN_ROLE_LABEL[clinician.professional_role] ?? clinician.professional_role}) is
            <strong className="font-medium text-foreground"> Pending Verification</strong> by a
            HayatBridge administrator. Verified clinicians may scan QR codes, view records and update
            clinical information.
          </div>
        </Panel>
      </Shell>
    );
  }

  if (blocked) {
    return (
      <Shell>
        <Panel icon={ShieldOff} title="Access denied" body={blocked} destructive />
      </Shell>
    );
  }

  const RoleIcon =
    ROLE_ICON[(clinician.professional_role as ClinicianRole) ?? "doctor"] ?? Stethoscope;

  // 6. Ask the patient.
  if (!requestId) {
    return (
      <Shell>
        <Panel
          icon={RoleIcon}
          title="Request patient approval"
          body="The record stays sealed until the patient approves your request on their device. They will see your name, verified badge, role, hospital and department."
        >
          <div className="rounded-xl border border-border bg-surface p-3 text-left text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{clinician.full_name}</span>
              <span className="flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {CLINICIAN_ROLE_LABEL[clinician.professional_role] ?? clinician.professional_role}
              {clinician.hospital ? ` · ${clinician.hospital}` : ""}
              {clinician.department ? ` · ${clinician.department}` : ""}
            </div>
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={requestMut.isPending}
            onClick={() => requestMut.mutate()}
          >
            {requestMut.isPending ? "Sending request…" : "Request temporary access"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Approved access lasts {ACCESS_GRANT_MINUTES} minutes, shows only the fields allowed for
            your role, and is written to the patient's audit log.
          </p>
        </Panel>
      </Shell>
    );
  }

  // 7. Awaiting / refused / expired states.
  if (!grant || grant.status === "pending") {
    return (
      <Shell>
        <Panel
          icon={Clock}
          title="Waiting for patient approval"
          body="Ask the patient to tap “Allow Access” on their HayatBridge screen. This page opens automatically once they approve."
        >
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
        </Panel>
      </Shell>
    );
  }

  if (grant.status !== "approved") {
    const copy =
      grant.status === "denied"
        ? { title: "The patient denied access", body: "The patient declined this request. Please ask them directly if access is clinically required." }
        : grant.status === "revoked"
          ? { title: "The patient revoked access", body: "Temporary access to this record has been withdrawn by the patient." }
          : grant.status === "expired"
            ? { title: "Temporary access expired", body: "The consultation window has closed. Ask the patient to approve a new request." }
            : { title: "Request not found", body: "This access request is no longer available." };
    return (
      <Shell>
        <Panel icon={ShieldOff} title={copy.title} body={copy.body} destructive />
      </Shell>
    );
  }

  // 8. Approved — role-filtered record.
  const visibleFields = (grant.fields ?? [])
    .map((consentKey) => ({
      key: CONSENT_TO_COL[consentKey],
      label: FIELD_LABELS[CONSENT_TO_COL[consentKey] ?? ""],
    }))
    .filter((f) => !!f.key);

  const p = grant.profile ?? {};
  const secondsLeft = grant.expires_at
    ? Math.max(0, Math.floor((new Date(grant.expires_at).getTime() - now) / 1000))
    : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const roleLabel = CLINICIAN_ROLE_LABEL[grant.clinician_role ?? "doctor"] ?? "Clinician";

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <RoleIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-primary">
                {roleLabel} · patient-approved access
              </div>
              <h1 className="text-2xl font-semibold text-foreground">
                {p.full_name || "Patient record"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            <CheckCircle2 className="h-4 w-4" />
            Temporary access · expires in {mm}:{ss}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
          <span>Token · {(grant.token_id ?? "").slice(0, 8).toUpperCase()}</span>
          <span>·</span>
          <span>Viewer · {grant.clinician_name}</span>
          {grant.hospital && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {grant.hospital}
                {grant.department ? ` / ${grant.department}` : ""}
              </span>
            </>
          )}
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl border border-primary/20 bg-primary-soft/50 p-5 sm:grid-cols-4">
          <BannerField label="Patient" value={p.full_name || "—"} />
          <BannerField label="Date of birth" value={p.date_of_birth || "—"} />
          <BannerField label="Blood type" value={p.blood_type || "—"} />
          <BannerField label="Allergies" value={p.allergies || "None recorded"} emphasis={!!p.allergies} />
        </div>

        {grant.clinician_role === "pharmacist" && (
          <div className="mt-6 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <AlertTriangle className="h-4 w-4" />
              Cross-check allergies before dispensing
            </div>
            <div className="mt-1 text-muted-foreground">
              Always confirm active medications and allergies with the patient.
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {visibleFields.map((f) => (
            <div key={f.key} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {f.label}
              </div>
              <div className="mt-2 whitespace-pre-line text-sm font-medium text-foreground">
                {p[f.key!] || "—"}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-primary-soft/40 p-4 text-xs text-muted-foreground">
          This access was approved by the patient, is limited to the fields permitted for a{" "}
          {roleLabel.toLowerCase()}, expires automatically after the consultation, can be revoked by
          the patient at any moment, and is recorded in their audit log.
        </div>
      </main>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      {children}
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  body,
  destructive,
  children,
}: {
  icon: typeof Stethoscope;
  title: string;
  body: string;
  destructive?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            destructive ? "bg-destructive/10 text-destructive" : "bg-primary-soft text-primary"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        {children && <div className="mt-5 space-y-4">{children}</div>}
      </div>
    </div>
  );
}

function ClinicianRegistration({
  onSave,
}: {
  onSave: (values: {
    full_name: string;
    professional_role: ClinicianRole;
    hospital: string;
    department: string;
    license_no: string;
    work_email: string;
  }) => Promise<void>;
}) {
  const [full_name, setFullName] = useState("");
  const [professional_role, setRole] = useState<ClinicianRole>("doctor");
  const [hospital, setHospital] = useState("");
  const [department, setDepartment] = useState("");
  const [license_no, setLicense] = useState("");
  const [work_email, setWorkEmail] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Panel
      icon={Stethoscope}
      title="Register your clinician identity"
      body="Patients only approve requests from verified professionals. Submit your details once — the HayatBridge team verifies your licence before you can request records."
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (full_name.trim().length < 2) return;
          setSaving(true);
          try {
            await onSave({
              full_name: full_name.trim(),
              professional_role,
              hospital: hospital.trim(),
              department: department.trim(),
              license_no: license_no.trim(),
              work_email: work_email.trim().toLowerCase(),
            });
            toast.success("Submitted. Your account is Pending Verification.");
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="space-y-2">
          <Label>Full name</Label>
          <Input required value={full_name} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Rania Osman" />
        </div>
        <div className="space-y-2">
          <Label>Professional role</Label>
          <div className="grid grid-cols-2 gap-2">
            {CLINICIAN_ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`rounded-xl border p-2.5 text-sm font-medium transition-colors ${
                  professional_role === r.value
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-surface text-foreground hover:bg-secondary"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Hospital / clinic</Label>
          <Input required value={hospital} onChange={(e) => setHospital(e.target.value)} placeholder="Aga Khan University Hospital" />
        </div>
        <div className="space-y-2">
          <Label>Department</Label>
          <Input required value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Cardiology" />
        </div>
        <div className="space-y-2">
          <Label>Licence / registration number</Label>
          <Input required value={license_no} onChange={(e) => setLicense(e.target.value)} placeholder="Lic 44219" />
        </div>
        <div className="space-y-2">
          <Label>Official work email</Label>
          <Input
            required
            type="email"
            value={work_email}
            onChange={(e) => setWorkEmail(e.target.value)}
            placeholder="r.osman@hospital.org"
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={saving}>
          {saving ? "Submitting…" : "Submit for verification"}
        </Button>
      </form>
    </Panel>
  );
}

function BannerField({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 whitespace-pre-line text-sm font-semibold ${emphasis ? "text-destructive" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function InvalidTokenState({ status, hasToken }: { status: ShareStatus; hasToken: boolean }) {
  const msg = !hasToken
    ? { title: "This link is missing a share code", body: "Ask the patient to generate a fresh QR from their HayatBridge dashboard." }
    : status === "used"
      ? { title: "This QR code has already been used", body: "For security, each HayatBridge QR is single-use. Ask the patient to generate a new one." }
      : status === "expired"
        ? { title: "This QR code has expired", body: "The patient set a time limit for this code. Please ask them to issue a new one." }
        : status === "revoked"
          ? { title: "The patient revoked this code", body: "This code is no longer valid. Please ask the patient to generate a new one." }
          : status === "consent_revoked"
            ? { title: "The patient revoked all access", body: "The patient has disabled sharing entirely. Please ask them to restore consent." }
            : { title: "Unknown share code", body: "This link does not match any active code on this record." };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldOff className="h-7 w-7" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold text-foreground">{msg.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{msg.body}</p>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/">Return home</Link>
      </Button>
    </div>
  );
}
