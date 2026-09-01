import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { completeInitialSetup, getMyProfile } from "@/lib/patient.functions";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
  head: () => ({
    meta: [
      { title: "Set up your record · HayatBridge" },
      {
        name: "description",
        content:
          "Complete your one-time HayatBridge patient setup: name, date of birth, allergies and diagnoses.",
      },
      { property: "og:title", content: "Set up your record · HayatBridge" },
      {
        property: "og:description",
        content: "One-time patient profile setup for your HayatBridge health record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SetupPage() {
  const navigate = useNavigate();
  const profileFn = useServerFn(getMyProfile);
  const completeFn = useServerFn(completeInitialSetup);

  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: () => profileFn(), retry: false });

  const [form, setForm] = useState({
    full_name: "",
    date_of_birth: "",
    allergies: "",
    diagnoses: "",
  });

  useEffect(() => {
    const p = profileQuery.data;
    if (!p) return;
    if (p.initial_setup_completed) {
      navigate({ to: "/dashboard" });
      return;
    }
    setForm((f) => ({
      full_name: f.full_name || p.full_name || "",
      date_of_birth: f.date_of_birth || p.date_of_birth || "",
      allergies: f.allergies || p.allergies || "",
      diagnoses: f.diagnoses || p.diagnoses || "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQuery.data]);

  const save = useMutation({
    mutationFn: () => completeFn({ data: form }),
    onSuccess: () => {
      toast.success("Setup complete. These details are now locked on your record.");
      navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Complete your record
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This one-time setup creates your medical record. Once saved, these details become
          read-only — later clinical updates are added by your verified providers.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
        >
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Date of birth</Label>
            <Input
              required
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Known allergies</Label>
            <Textarea
              rows={2}
              placeholder="e.g. Penicillin, peanuts — write None if not applicable"
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Existing diagnoses</Label>
            <Textarea
              rows={2}
              placeholder="e.g. Type 2 diabetes — write None if not applicable"
              value={form.diagnoses}
              onChange={(e) => setForm({ ...form, diagnoses: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
            <Lock className="h-4 w-4 text-primary" />
            After saving, these four fields are locked in the database and cannot be edited from
            the app.
          </div>

          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save and continue"}
          </Button>
        </form>
      </main>
    </div>
  );
}
