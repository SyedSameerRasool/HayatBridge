import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy,
  RefreshCw,
  Share2,
  ShieldCheck,
  Stethoscope,
  Pill,
  Building2,
  Ban,
  Timer,
} from "lucide-react";
import { AppHeader, useRequirePatient } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  createShareToken,
  listMyShareTokens,
  revokeShareToken,
} from "@/lib/patient.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/qr")({
  component: QrPage,
  head: () => ({
    meta: [
      { title: "Share via QR · HayatBridge" },
      { name: "description", content: "Generate a single-use, time-limited QR code to share your health record with your provider." },
      { property: "og:title", content: "Share via QR · HayatBridge" },
      { property: "og:description", content: "Single-use, expiring QR codes for secure health-record sharing." },
    ],
  }),
});

const TTL_OPTIONS = [
  { label: "15 min", ms: 15 * 60 * 1000 },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "8 hours", ms: 8 * 60 * 60 * 1000 },
];

function QrPage() {
  const patient = useRequirePatient();
  const [role, setRole] = useState<"doctor" | "pharmacist" | "hospital">("doctor");
  const [ttl, setTtl] = useState<number>(60 * 60 * 1000);
  const [now, setNow] = useState(Date.now());
  const qc = useQueryClient();

  const list = useServerFn(listMyShareTokens);
  const create = useServerFn(createShareToken);
  const revoke = useServerFn(revokeShareToken);

  const tokensQuery = useQuery({
    queryKey: ["shareTokens"],
    queryFn: () => list(),
    refetchInterval: 4000,
  });

  const activeToken = useMemo(() => {
    const rows = tokensQuery.data ?? [];
    return rows.find(
      (t) => !t.revoked && !t.used_at && new Date(t.expires_at).getTime() > now && t.role === role,
    );
  }, [tokensQuery.data, role, now]);

  const createMut = useMutation({
    mutationFn: async () => create({ data: { role, ttl_ms: ttl } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shareTokens"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Auto-generate a token when none is active for the chosen role.
  useEffect(() => {
    if (!patient || tokensQuery.isLoading) return;
    if (!activeToken && !createMut.isPending) {
      createMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id, role, activeToken, tokensQuery.isLoading]);

  // Live countdown tick
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Detect that the previously active token has just been used (or expired) — regenerate.
  const [lastActiveId, setLastActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (activeToken) {
      setLastActiveId(activeToken.id);
      return;
    }
    if (lastActiveId && !createMut.isPending) {
      const rows = tokensQuery.data ?? [];
      const prev = rows.find((r) => r.id === lastActiveId);
      if (prev?.used_at) {
        toast.success("QR was scanned. A fresh single-use code has been generated.");
      }
      setLastActiveId(null);
      createMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToken, tokensQuery.data]);

  const shareUrl = useMemo(() => {
    if (!patient || !activeToken || typeof window === "undefined") return "";
    return `${window.location.origin}/view/${patient.id}?token=${activeToken.token_value}&role=${activeToken.role}`;
  }, [patient, activeToken]);

  const secondsLeft = activeToken
    ? Math.max(0, Math.floor((new Date(activeToken.expires_at).getTime() - now) / 1000))
    : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (!patient) return null;

  const regenerate = () => {
    if (activeToken) {
      revoke({ data: { id: activeToken.id } })
        .then(() => createMut.mutate())
        .catch((e) => toast.error((e as Error).message));
    } else {
      createMut.mutate();
    }
  };

  const revokeOnly = () => {
    if (!activeToken) return;
    revoke({ data: { id: activeToken.id } })
      .then(() => {
        toast.success("Previous code revoked.");
        qc.invalidateQueries({ queryKey: ["shareTokens"] });
      })
      .catch((e) => toast.error((e as Error).message));
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Share via QR code
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Each code is <span className="font-medium text-foreground">single-use</span> and
          <span className="font-medium text-foreground"> time-limited</span> — once a provider
          scans it, or when the timer runs out, this QR expires and a fresh one is generated.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex justify-center rounded-xl border border-border bg-white p-6">
              <QRCodeCanvas
                value={shareUrl || "hayatbridge"}
                size={256}
                level="H"
                includeMargin
                fgColor="#0d3b8f"
              />
            </div>
            <div className="mt-4 rounded-xl bg-surface p-3 text-center">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Patient
              </div>
              <div className="mt-1 text-base font-semibold text-foreground">
                {patient.health.fullName || patient.email}
              </div>
              <div className="text-xs tabular-nums text-muted-foreground">
                Record ID · {patient.id.slice(0, 8).toUpperCase()}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3 rounded-xl border border-border bg-surface p-3">
              <Timer className="h-4 w-4 text-primary" />
              <div className="text-center">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Expires in
                </div>
                <div className="text-lg font-semibold tabular-nums text-foreground">
                  {activeToken ? `${mm}:${ss}` : "—"}
                </div>
              </div>
            </div>

            {activeToken && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                <span className="font-medium text-success">Single-use</span>
                <span className="text-muted-foreground">
                  · token {activeToken.token_value.slice(0, 8).toUpperCase()}
                </span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={!shareUrl}
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast.success("Share link copied.");
                }}
              >
                <Copy className="h-4 w-4" />
                Copy link
              </Button>
              <Button
                disabled={!shareUrl}
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: "HayatBridge record", url: shareUrl });
                  } else {
                    navigator.clipboard.writeText(shareUrl);
                    toast.success("Share link copied.");
                  }
                }}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button variant="outline" onClick={regenerate} disabled={createMut.isPending}>
                <RefreshCw className="h-4 w-4" />
                New code
              </Button>
              <Button variant="outline" onClick={revokeOnly} disabled={!activeToken}>
                <Ban className="h-4 w-4" />
                Revoke
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Viewer role
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select who is scanning — the summary is tailored to their workflow.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <RoleChip active={role === "doctor"} onClick={() => setRole("doctor")} icon={Stethoscope} label="Doctor" />
                <RoleChip active={role === "pharmacist"} onClick={() => setRole("pharmacist")} icon={Pill} label="Pharmacist" />
                <RoleChip active={role === "hospital"} onClick={() => setRole("hospital")} icon={Building2} label="Hospital staff" />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Code validity
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Backend-enforced. When the timer hits zero, scans stop working.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {TTL_OPTIONS.map((o) => (
                  <button
                    key={o.ms}
                    type="button"
                    onClick={() => {
                      setTtl(o.ms);
                      if (activeToken) {
                        revoke({ data: { id: activeToken.id } })
                          .then(() => createMut.mutate())
                          .catch((e) => toast.error((e as Error).message));
                      }
                    }}
                    className={`rounded-xl border p-3 text-sm font-medium transition-colors ${
                      ttl === o.ms
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-surface text-foreground hover:bg-secondary"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-primary-soft/40 p-6">
              <div className="text-sm font-semibold text-foreground">How it works</div>
              <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>1. Provider scans this QR code.</li>
                <li>2. They enter their name + license/staff ID.</li>
                <li>
                  3. Your record opens for them, this code is burned server-side, and the scan
                  appends to your access log — append-only.
                </li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function RoleChip({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Stethoscope;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-border bg-card text-foreground hover:bg-secondary"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
