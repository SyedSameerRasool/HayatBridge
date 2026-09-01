import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoUrl from "@/assets/hayatbridge-logo.jpeg";
import { AccessRequestGate } from "@/components/AccessRequestGate";
import { logAuditEvent } from "@/lib/audit.functions";

const nav = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/appointments", label: "Appointments" },
  { to: "/messages", label: "Messages" },
  { to: "/test-results", label: "Results" },
  { to: "/billing", label: "Billing" },
  { to: "/health-info", label: "Health info" },
  { to: "/qr", label: "QR code" },
];

type SessionUser = { id: string; email: string; fullName: string } | null;

export function AppHeader() {
  const [user, setUser] = useState<SessionUser>(null);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!data.user) {
        setUser(null);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", data.user.id)
        .maybeSingle();
      setUser({
        id: data.user.id,
        email: data.user.email ?? "",
        fullName: profile?.full_name || data.user.email?.split("@")[0] || "",
      });
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [path]);

  const signOut = async () => {
    try {
      await logAuditEvent({ data: { action: "LOGOUT", table_name: "auth" } });
    } catch {
      /* never block sign-out on logging */
    }
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
  <div className="mx-auto flex h-24 max-w-7xl items-center gap-6 px-4 sm:px-6">
    <Link to="/" className="flex items-center">
      <img
        src={logoUrl}
        alt="HayatBridge logo"
        className="h-20 w-auto max-w-[160px] object-contain py-1"
      />
    </Link>

        {user && (
          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((n) => {
              const active = path === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium text-foreground">
                  {user.fullName || user.email}
                </div>
                <div className="text-xs text-muted-foreground">Patient · ID {user.id.slice(0, 6)}</div>
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
              <Button size="sm" onClick={() => navigate({ to: "/auth" })}>
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
    {user && <AccessRequestGate />}
    </>
  );
}

// Hook: ensure user is authenticated (Supabase). Returns basic profile info.
export function useAuthUser(): { id: string; email: string; fullName: string; profile: Record<string, unknown> | null } | null {
  const [state, setState] = useState<{
    id: string;
    email: string;
    fullName: string;
    profile: Record<string, unknown> | null;
  } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!data.user) {
        navigate({ to: "/auth" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();
      setState({
        id: data.user.id,
        email: data.user.email ?? "",
        fullName: (profile?.full_name as string) || data.user.email?.split("@")[0] || "",
        profile: profile ?? null,
      });
    }
    load();
  }, [navigate]);

  return state;
}

// Authenticated patient session, hydrated from the database (no browser storage).
import { emptyHealth, type HealthInfo } from "@/lib/health-fields";

export type SessionPatient = { id: string; email: string; health: HealthInfo };

export function useRequirePatient(): SessionPatient | null {
  const [patient, setPatient] = useState<SessionPatient | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!data.user) {
        navigate({ to: "/auth" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "full_name, email, date_of_birth, blood_type, phone, emergency_contact, allergies, medications, diagnoses, recent_reports, notes, initial_setup_completed",
        )
        .eq("id", data.user.id)
        .maybeSingle();
      if (!mounted) return;
      // One-time patient setup must be completed before the portal is usable.
      if (
        profile &&
        !profile.initial_setup_completed &&
        typeof window !== "undefined" &&
        window.location.pathname !== "/setup"
      ) {
        navigate({ to: "/setup" });
        return;
      }

      const base = emptyHealth();
      setPatient({
        id: data.user.id,
        email: profile?.email || data.user.email || "",
        health: {
          ...base,
          fullName: profile?.full_name ?? base.fullName,
          dateOfBirth: profile?.date_of_birth ?? base.dateOfBirth,
          bloodType: profile?.blood_type ?? base.bloodType,
          phone: profile?.phone ?? base.phone,
          emergencyContact: profile?.emergency_contact ?? base.emergencyContact,
          allergies: profile?.allergies ?? base.allergies,
          medications: profile?.medications ?? base.medications,
          diagnoses: profile?.diagnoses ?? base.diagnoses,
          recentReports: profile?.recent_reports ?? base.recentReports,
          notes: profile?.notes ?? base.notes,
        },
      });
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);
  return patient;
}