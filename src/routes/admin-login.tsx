import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import logoUrl from "@/assets/hayatbridge-logo.jpeg";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin-login")({
  component: AdminLogin,
  head: () => ({
    meta: [
      { title: "Admin Login · HayatBridge" },
      { name: "description", content: "Secure administrator sign-in for the HayatBridge hospital portal." },
      { property: "og:title", content: "Admin Login · HayatBridge" },
      { property: "og:description", content: "Restricted access. Authorised HayatBridge administrators only." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email or username").email("Enter a valid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(200),
});

// Tab-scoped only: nothing is persisted to long-lived browser storage.
const REMEMBER_KEY = "hayatbridge:admin-remember";

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({ email: flat.email?.[0], password: flat.password?.[0] });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error || !data.user) {
        setErrors({ form: "Incorrect credentials. Please check your email and password." });
        return;
      }
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
      if (!isAdmin) {
        await supabase.auth.signOut();
        setErrors({ form: "This account does not have administrator access." });
        return;
      }
      if (remember) sessionStorage.setItem(REMEMBER_KEY, parsed.data.email);
      else sessionStorage.removeItem(REMEMBER_KEY);
      toast.success("Signed in as administrator");
      navigate({ to: "/admin", replace: true });
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    const parsed = z.string().email().safeParse(email.trim());
    if (!parsed.success) {
      setErrors({ email: "Enter your email address first, then select Forgot password." });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent to your email.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-soft to-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={logoUrl} alt="HayatBridge logo" width={64} height={64} className="h-16 w-16 object-contain" />
          <p className="mt-2 text-sm font-semibold tracking-tight text-primary">HayatBridge</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-elevated sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Admin Login</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Restricted area — authorised hospital administrators only.
            </p>
          </div>

          {errors.form && (
            <div role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {errors.form}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">Email or username</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
                placeholder="admin@hospital.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(errors.password)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                Remember me
              </label>
              <button type="button" onClick={forgotPassword} className="text-sm font-medium text-primary hover:underline">
                Forgot password?
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Secure login
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-2 rounded-lg bg-success/10 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <p>
              Credentials are hashed and verified by the authentication service. Sessions expire automatically after
              15 minutes of inactivity.
            </p>
          </div>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Patient?{" "}
            <Link to="/auth" className="font-medium text-primary hover:underline">
              Go to the patient portal
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
