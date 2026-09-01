import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  BookHeart,
  Calendar,
  ClipboardCheck,
  CreditCard,
  FileHeart,
  FlaskConical,
  Leaf,
  Mail,
  Pencil,
  Pill,
  QrCode,
  Stethoscope,
  Watch,
} from "lucide-react";
import { AppHeader, useRequirePatient, useAuthUser } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  seedDemoData,
  getMyConsent,
  updateMyConsent,
  getMyProfile,
  listAllergies,
  listMedications,
  listAccessLogs,
} from "@/lib/patient.functions";
import { toast } from "sonner";
import { ShieldOff } from "lucide-react";

// In-memory guard so demo seeding runs at most once per session (no browser storage).
const seededUsers = new Set<string>();

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard · HayatBridge" },
      { name: "description", content: "Your HayatBridge patient dashboard: appointments, messages, results, billing, allergies, medications, and secure QR sharing." },
      { property: "og:title", content: "Dashboard · HayatBridge" },
      { property: "og:description", content: "Everything you need from your HayatBridge patient portal in one place." },
    ],
  }),
});

const tiles = [
  { to: "/appointments", icon: Calendar, label: "Appointments" },
  { to: "/messages", icon: Mail, label: "Messages" },
  { to: "/test-results", icon: FlaskConical, label: "Test Results" },
  { to: "/medications", icon: Pill, label: "Medications" },
  { to: "/allergies", icon: AlertTriangle, label: "Allergies" },
  { to: "/billing", icon: CreditCard, label: "Billing Summary" },
  { to: "/health-info", icon: BookHeart, label: "Health Summary" },
  { to: "/questionnaire", icon: ClipboardCheck, label: "Questionnaire" },
  { to: "/diagnoses", icon: Stethoscope, label: "Diagnoses" },

];

function Dashboard() {
  const patient = useRequirePatient();
  const user = useAuthUser();
  const seed = useServerFn(seedDemoData);
  const consentFn = useServerFn(getMyConsent);
  const updateConsentFn = useServerFn(updateMyConsent);
  const profileFn = useServerFn(getMyProfile);
  const allergiesFn = useServerFn(listAllergies);
  const medsFn = useServerFn(listMedications);
  const logsFn = useServerFn(listAccessLogs);
  const qc = useQueryClient();
  const consentQuery = useQuery({
    queryKey: ["consent"],
    queryFn: () => consentFn(),
    enabled: !!user,
  });
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: () => profileFn(), enabled: !!user });
  const allergiesQuery = useQuery({ queryKey: ["allergies"], queryFn: () => allergiesFn(), enabled: !!user });
  const medsQuery = useQuery({ queryKey: ["medications"], queryFn: () => medsFn(), enabled: !!user });
  const logsQuery = useQuery({ queryKey: ["accessLogs"], queryFn: () => logsFn(), enabled: !!user });

  const revokeMut = useMutation({
    mutationFn: () => updateConsentFn({ data: { consent_revoked: true } }),
    onSuccess: () => {
      toast.success("All access revoked. Providers can no longer scan your record.");
      qc.invalidateQueries({ queryKey: ["consent"] });
      qc.invalidateQueries({ queryKey: ["shareTokens"] });
      qc.invalidateQueries({ queryKey: ["accessLogs"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const restoreMut = useMutation({
    mutationFn: () =>
      updateConsentFn({
        data: {
          consent_revoked: false,
          consent_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      }),
    onSuccess: () => {
      toast.success("Sharing restored for the next 24 hours.");
      qc.invalidateQueries({ queryKey: ["consent"] });
    },
  });

  useEffect(() => {
    if (!user) return;
    if (seededUsers.has(user.id)) return;
    seededUsers.add(user.id);
    seed().catch(() => {});
  }, [user, seed]);
  if (!patient) return null;

  const profile = profileQuery.data;
  const firstName = (profile?.full_name || patient.email).split(" ")[0];
  const allergyList = allergiesQuery.data ?? [];
  const medList = medsQuery.data ?? [];
  const activeMeds = medList.filter((m) => m.active);
  const logs = logsQuery.data ?? [];
  const consent = consentQuery.data;
  const consentActive = !!consent && !consent.consent_revoked && (!consent.consent_expires_at || new Date(consent.consent_expires_at).getTime() > Date.now());

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        {/* Welcome header with edit pencil */}
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Welcome, {firstName}!
          </h1>
          <button
            aria-label="Edit profile"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-primary transition-colors hover:bg-primary-soft"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
            <span className={`h-2 w-2 rounded-full ${consentActive ? "bg-success" : "bg-muted-foreground"}`} />
            <span className="font-medium text-foreground">
              Sharing {consentActive ? "active" : consent?.consent_revoked ? "revoked" : "paused"}
            </span>
          </div>
          {consent?.consent_revoked ? (
            <Button size="sm" variant="outline" onClick={() => restoreMut.mutate()} disabled={restoreMut.isPending}>
              Restore sharing
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Revoke all future access? Any active QR codes will stop working immediately.")) {
                  revokeMut.mutate();
                }
              }}
              disabled={revokeMut.isPending}
            >
              <ShieldOff className="h-3.5 w-3.5" />
              Revoke all access
            </Button>
          )}
        </div>


        {/* 6-tile grid */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {tiles.map((t) => (
            <Link
              key={t.label}
              to={t.to}
              className="flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <t.icon className="h-8 w-8" strokeWidth={2} />
              </div>
              <div className="text-center text-sm font-medium text-foreground">
                {t.label}
              </div>
            </Link>
          ))}
        </div>

        {/* Primary share action */}
        <div className="mt-6 rounded-2xl border border-primary/20 bg-primary p-5 text-primary-foreground shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <QrCode className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-semibold">Share via QR code</div>
                <div className="text-xs text-primary-foreground/80">
                  Generate a single-use code for your provider
                </div>
              </div>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link to="/qr">Open QR</Link>
            </Button>
          </div>
        </div>

        {/* Clinical summary chips (backend-sourced, RLS-scoped) */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={AlertTriangle}
            label="Allergies"
            value={
              allergyList.length > 0
                ? allergyList.slice(0, 3).map((a) => a.substance).join(", ")
                : profile?.allergies || "None recorded"
            }
            tone="warning"
          />
          <SummaryCard
            icon={Pill}
            label="Medications"
            value={
              activeMeds.length > 0
                ? activeMeds.slice(0, 3).map((m) => m.name).join(", ")
                : profile?.medications || "None recorded"
            }
          />
          <SummaryCard icon={Stethoscope} label="Diagnoses" value={profile?.diagnoses || "None recorded"} />
          <SummaryCard icon={FileHeart} label="Blood type" value={profile?.blood_type || "—"} />
        </div>

        {/* Your Updates */}
        <h2 className="mt-10 text-lg font-semibold text-foreground">Your Updates</h2>
        <div className="mt-3 space-y-3">
          <UpdateCard
            icon={ClipboardCheck}
            iconTone="warning"
            title="Complete your comprehensive health questionnaire."
            body="Includes symptoms, history, lifestyle, and PHQ-9 / GAD-7 screening."
            action={
              <Button asChild size="sm">
                <Link to="/questionnaire">Open questionnaire</Link>
              </Button>
            }
          />

          <UpdateCard
            icon={Watch}
            iconTone="destructive"
            title="Link HayatBridge to your Apple Watch!"
            action={
              <div className="flex gap-2">
                <Button size="sm">Link now!</Button>
                <Button variant="outline" size="sm">
                  Dismiss
                </Button>
              </div>
            }
          />

          <UpdateCard
            icon={Leaf}
            iconTone="success"
            title="Paperless Billing"
            body="HayatBridge is transitioning to paperless billing. If you have a bill, you can manage your paperless preferences at any time. From the Balances page, select 'Paperless preferences' (look for the green leaf icon) or click 'Manage preferences' now."
          />

          <UpdateCard
            icon={Bell}
            iconTone="primary"
            title="Recent access"
            body={
              logs.length === 0
                ? "No provider has scanned your record yet. Every scan will appear here — this log is append-only."
                : undefined
            }
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/access-log">View access log</Link>
              </Button>
            }
          >
            {logs.length > 0 && (
              <ul className="mt-3 space-y-2 text-sm">
                {logs.slice(0, 3).map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2"
                  >
                    <div>
                      <div className="font-medium text-foreground">{log.viewer}</div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {new Date(log.at).toLocaleString()} · {log.fields_viewed.length} sections
                      </div>
                    </div>
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                      {log.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </UpdateCard>
        </div>

      </main>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Bell;
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            tone === "warning"
              ? "bg-warning/15 text-warning-foreground"
              : "bg-primary-soft text-primary"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="mt-3 line-clamp-2 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function UpdateCard({
  icon: Icon,
  iconTone,
  title,
  body,
  action,
  children,
}: {
  icon: typeof Bell;
  iconTone: "primary" | "warning" | "success" | "destructive";
  title: string;
  body?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning/15 text-warning-foreground",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/10 text-destructive",
  }[iconTone];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
          {children}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}
