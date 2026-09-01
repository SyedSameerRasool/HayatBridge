import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ShieldCheck, QrCode, FileHeart, ClipboardList, Lock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <AppHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border bg-card">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary-soft blur-3xl opacity-70" />
            <div className="absolute -left-32 top-40 h-96 w-96 rounded-full bg-accent blur-3xl opacity-60" />
          </div>
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
            <div className="flex flex-col justify-center">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                HIPAA-minded design · Patient controlled
              </span>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Your health record, ready when your care team needs it.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                HayatBridge is a patient-centered medical record system. Store your essential
                health information in one secure place and share it with doctors, pharmacists,
                and hospitals through a consent-based QR code — you decide what is shown and
                for how long.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/auth">Create patient account</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth">Sign in</Link>
                </Button>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-6 text-sm">
                <Stat label="Encrypted" value="AES-256" />
                <Stat label="Consent based" value="Per-scan" />
                <Stat label="Audit trail" value="Every view" />
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-border bg-background p-6 shadow-[var(--shadow-elevated)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Patient summary
                    </div>
                    <div className="mt-1 text-lg font-semibold text-foreground">
                      Aisha Rahman
                    </div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <QrCode className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <MiniCard label="Blood type" value="O+" />
                  <MiniCard label="Allergies" value="Penicillin" />
                  <MiniCard label="Medications" value="3 active" />
                  <MiniCard label="Diagnoses" value="Type 2 diabetes" />
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-primary-soft/50 p-3 text-xs text-primary">
                  <Lock className="h-4 w-4" />
                  Consent expires in 23h 42m. Access can be revoked anytime.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              Built for real clinical workflows
            </h2>
            <p className="mt-3 text-muted-foreground">
              Designed for patients, doctors, pharmacists, and hospital staff — with strong
              privacy controls at every step.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={FileHeart}
              title="Unified health record"
              body="Allergies, medications, diagnoses, and recent reports in one calm, organized dashboard."
            />
            <Feature
              icon={QrCode}
              title="QR-based sharing"
              body="Generate a scannable code your provider can use on the spot — no printouts, no fax."
            />
            <Feature
              icon={ShieldCheck}
              title="Granular consent"
              body="Choose which sections are visible per role, set an expiration window, and revoke instantly."
            />
            <Feature
              icon={ClipboardList}
              title="Access logs"
              body="Every scan is recorded. See who viewed what, when, and from which role."
            />
            <Feature
              icon={Activity}
              title="Role-aware views"
              body="Doctors, pharmacists, and hospital staff see summaries tailored to their workflow."
            />
            <Feature
              icon={Lock}
              title="You stay in control"
              body="Your record never leaves your account without a consent you approved."
            />
          </div>
        </section>

        <footer className="border-t border-border bg-card">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:px-6">
            <div>© {new Date().getFullYear()} HayatBridge Health Systems</div>
            <div>Prototype for demonstration — not for clinical use.</div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Activity;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
