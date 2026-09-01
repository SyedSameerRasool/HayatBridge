import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { signInWithCnic } from "@/lib/cnic.functions";
import { logAuditEvent } from "@/lib/audit.functions";
import { toast } from "sonner";
import logoUrl from "@/assets/hayatbridge-logo.jpeg";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const CNIC_RE = /^\d{5}-?\d{7}-?\d$/;
const formatCnic = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
};

/** Maps auth API errors to clear, non-technical messages (no UI change). */
function friendlyAuthError(err: unknown): string {
  const raw = (err as Error)?.message ?? "Something went wrong. Please try again.";
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid cnic or password"))
    return "Incorrect credentials. Please check your email/CNIC and password.";
  if (m.includes("email not confirmed"))
    return "Your email is not confirmed yet. Please confirm it, then sign in again.";
  if (m.includes("weak") || m.includes("pwned"))
    return "That password is too easy to guess. Please choose a stronger password.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Please sign in instead.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a moment and try again.";
  return raw;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState<"email" | "cnic">("email");
  const [email, setEmail] = useState("");
  const [cnic, setCnic] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const sendReset = async () => {
    if (!email.trim()) {
      toast.error("Enter your email above, then tap 'Forgot password'.");
      return;
    }
    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      toast.success("Password reset link sent. Check your inbox.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const go = (user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }) => {
      if (cancelled) return;
      navigate({ to: "/dashboard", replace: true });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) go(data.session.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        go(session.user);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (mode === "signup" && !CNIC_RE.test(cnic.trim())) {
      toast.error("Enter a valid 13-digit CNIC (e.g. 35202-1234567-1).");
      return;
    }
    if (mode === "login" && identifier === "cnic" && !CNIC_RE.test(cnic.trim())) {
      toast.error("Enter a valid 13-digit CNIC (e.g. 35202-1234567-1).");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: {
              full_name: fullName || email.split("@")[0],
              cnic: cnic.replace(/\D/g, ""),
            },
          },
        });
        if (error) throw error;
        toast.success("Account created. Welcome to HayatBridge.");
      } else if (identifier === "cnic") {
        const tokens = await signInWithCnic({
          data: { cnic: cnic.trim(), password },
        });
        const { error } = await supabase.auth.setSession(tokens);
        if (error) throw error;
        toast.success("Signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
        toast.success("Signed in.");
      }
      // Signup may require email confirmation, in which case there is no
      // session yet: skip auditing and stay on this page.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.info("Check your inbox to confirm your email, then sign in.");
        setMode("login");
        return;
      }
      try {
        await logAuditEvent({ data: { action: "LOGIN", table_name: "auth" } });
      } catch {
        /* auditing must never block sign-in */
      }
      navigate({ to: "/dashboard" });

    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
        <div className="hidden flex-col justify-center lg:flex">
          <img
            src={logoUrl}
            alt="HayatBridge logo: medical cross with ECG heartbeat line"
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
          />
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">
            Secure access to your medical record
          </h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            HayatBridge stores your health record in an encrypted database and only
            shares it with providers you explicitly authorize.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              Row-level security scopes every query to your account
            </li>
            <li className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 text-primary" />
              Every access is logged and reviewable
            </li>
            <li className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-primary" />
              Verified accounts for patients and providers
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          <div className="flex rounded-xl bg-secondary p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Create account
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-6 w-full"
            disabled={loading}
            onClick={async () => {
              try {
                setLoading(true);
                const result = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin + "/auth",
                });
                if (result.error) {
                  throw new Error(result.error.message ?? "Google sign-in failed");
                }
                if (result.redirected) return;
                // Popup flow: session set inside helper — onAuthStateChange navigates.
              } catch (err) {
                toast.error((err as Error).message || "Google sign-in failed. Please try again.");
              } finally {
                setLoading(false);
              }
            }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.96l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or with {mode === "login" && identifier === "cnic" ? "CNIC" : "email"}
            <div className="h-px flex-1 bg-border" />
          </div>

          {mode === "login" && (
            <div className="mt-5 flex rounded-xl bg-secondary p-1">
              <button
                type="button"
                onClick={() => setIdentifier("email")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  identifier === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setIdentifier("cnic")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  identifier === "cnic" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                CNIC
              </button>
            </div>
          )}

          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  autoComplete="name"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}
            {(mode === "signup" || identifier === "cnic") && (
              <div className="space-y-2">
                <Label htmlFor="cnic">
                  CNIC {mode === "signup" && <span className="text-muted-foreground">(required)</span>}
                </Label>
                <Input
                  id="cnic"
                  inputMode="numeric"
                  placeholder="35202-1234567-1"
                  required
                  value={cnic}
                  onChange={(e) => setCnic(formatCnic(e.target.value))}
                />
                {mode === "signup" && (
                  <p className="text-xs text-muted-foreground">
                    Your national ID is required to create an account. It is stored encrypted and
                    lets you sign in with CNIC. Signing in only needs your CNIC or email.
                  </p>
                )}
              </div>
            )}
            {!(mode === "login" && identifier === "cnic") && (
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="At least 6 characters"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Please wait…" : mode === "signup" ? "Create secure account" : "Sign in"}
            </Button>

            {mode === "login" && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={sendReset}
                  disabled={resetting}
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60"
                >
                  {resetting ? "Sending…" : "Forgot your password?"}
                </button>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Protected by row-level security. Your record is only visible to you.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
