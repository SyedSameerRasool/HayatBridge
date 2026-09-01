import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SectionCard } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { adminUpdateOwnProfile, adminRecordEvent } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
  head: () => ({
    meta: [
      { title: "Settings · HayatBridge Admin" },
      { name: "description", content: "Update your administrator profile, password, two-factor and notification settings." },
      { property: "og:title", content: "Settings · HayatBridge Admin" },
      { property: "og:description", content: "Administrator account and security settings for HayatBridge." },
      { name: "robots", content: "noindex" },
    ],
  }),
});


function AdminSettings() {
  const updateProfile = useServerFn(adminUpdateOwnProfile);
  const recordEvent = useServerFn(adminRecordEvent);
  const [profile, setProfile] = useState({ full_name: "", phone: "" });
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [prefs, setPrefs] = useState({ twoFactor: false, emailNotifications: true });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: row } = await supabase.from("profiles").select("full_name, phone").eq("id", data.user.id).maybeSingle();
      setProfile({ full_name: row?.full_name ?? "", phone: row?.phone ?? "" });
      const { data: savedPrefs } = await supabase
        .from("admin_preferences")
        .select("two_factor, email_notifications")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (savedPrefs)
        setPrefs({
          twoFactor: savedPrefs.two_factor,
          emailNotifications: savedPrefs.email_notifications,
        });
    });
  }, []);

  const savePrefs = async (next: typeof prefs) => {
    setPrefs(next);
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from("admin_preferences").upsert({
      user_id: data.user.id,
      two_factor: next.twoFactor,
      email_notifications: next.emailNotifications,
    });
    if (error) toast.error(error.message);
  };

  const saveProfile = useMutation({
    mutationFn: () => updateProfile({ data: { full_name: profile.full_name.trim(), phone: profile.phone.trim() } }),
    onSuccess: () => toast.success("Profile updated"),
    onError: (e: Error) => toast.error(e.message),
  });

  const changePassword = async () => {
    if (pw.next.length < 8) return toast.error("Password must be at least 8 characters.");
    if (pw.next !== pw.confirm) return toast.error("Passwords do not match.");
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    if (error) return toast.error(error.message);
    setPw({ next: "", confirm: "" });
    toast.success("Password changed");
    recordEvent({ data: { action: "admin.password_changed" } }).catch(() => {});
  };

  return (
    <AdminLayout title="Settings" subtitle="Manage your administrator account and security preferences.">
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Administrator profile">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-name">Full name</Label>
              <Input id="s-name" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-phone">Phone</Label>
              <Input id="s-phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} maxLength={40} />
            </div>
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>Save profile</Button>
          </div>
        </SectionCard>

        <SectionCard title="Change password" description="Passwords are hashed by the authentication service — never stored in the app database.">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-pw">New password</Label>
              <Input id="s-pw" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-pw2">Confirm password</Label>
              <Input id="s-pw2" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
            </div>
            <Button onClick={changePassword}>Update password</Button>
          </div>
        </SectionCard>

        <SectionCard title="Security" description="Additional protection for the admin console.">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Two-factor authentication</p>
                <p className="text-xs text-muted-foreground">Require a second factor at each admin sign-in.</p>
              </div>
              <Switch
                checked={prefs.twoFactor}
                onCheckedChange={(v) => {
                  savePrefs({ ...prefs, twoFactor: v });
                  recordEvent({ data: { action: v ? "admin.2fa_enabled" : "admin.2fa_disabled" } }).catch(() => {});
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Email notifications</p>
                <p className="text-xs text-muted-foreground">Receive alerts for new feedback and registrations.</p>
              </div>
              <Switch checked={prefs.emailNotifications} onCheckedChange={(v) => savePrefs({ ...prefs, emailNotifications: v })} />
            </div>
            <p className="flex items-start gap-2 rounded-lg bg-success/10 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              Admin routes are role-gated in the database, all input is validated server-side, and sessions end after 15
              minutes of inactivity.
            </p>
          </div>
        </SectionCard>
      </div>
    </AdminLayout>
  );
}
