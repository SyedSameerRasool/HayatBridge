import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, MessageSquare, QrCode, UserPlus, Users, UserCheck } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatCard, SectionCard } from "@/components/admin/AdminUI";
import { adminOverview, adminRecordEvent } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
  head: () => ({
    meta: [
      { title: "Admin Dashboard · HayatBridge" },
      { name: "description", content: "Hospital administration overview: patients, registrations, QR profiles and feedback." },
      { property: "og:title", content: "Admin Dashboard · HayatBridge" },
      { property: "og:description", content: "Operational overview of the HayatBridge patient network." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminDashboard() {
  const overviewFn = useServerFn(adminOverview);
  const recordEvent = useServerFn(adminRecordEvent);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "overview"], queryFn: () => overviewFn() });

  useEffect(() => {
    const key = "hayatbridge:admin-login-logged";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    recordEvent({ data: { action: "admin.login", details: "Administrator signed in" } }).catch(() => {});
  }, [recordEvent]);

  return (
    <AdminLayout title="Dashboard" subtitle="Live overview of the HayatBridge patient network.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Users} label="Total registered patients" value={isLoading ? "—" : data?.totalPatients ?? 0} />
        <StatCard icon={UserCheck} label="Active patients" value={isLoading ? "—" : data?.activePatients ?? 0} tone="green" />
        <StatCard icon={UserPlus} label="New registrations today" value={isLoading ? "—" : data?.newToday ?? 0} tone="green" />
        <StatCard icon={QrCode} label="Total QR profiles generated" value={isLoading ? "—" : data?.qrProfiles ?? 0} />
        <StatCard
          icon={MessageSquare}
          label="Feedback received"
          value={isLoading ? "—" : data?.feedbackCount ?? 0}
          hint={`${data?.openFeedback ?? 0} awaiting response`}
        />
        <div className="rounded-xl border border-border bg-primary p-5 text-primary-foreground shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">Quick actions</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link to="/admin/patients" className="rounded-lg bg-white/15 px-3 py-2 hover:bg-white/25">Manage patient accounts</Link>
            <Link to="/admin/announcements" className="rounded-lg bg-white/15 px-3 py-2 hover:bg-white/25">Publish an announcement</Link>
            <Link to="/admin/reports" className="rounded-lg bg-white/15 px-3 py-2 hover:bg-white/25">Export reports</Link>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <SectionCard title="Recent admin activity" description="The latest actions recorded in the audit trail.">
          {(data?.recentActivity ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(data?.recentActivity ?? []).map((row) => (
                <li key={row.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <Activity className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{row.action}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.admin_email ?? "admin"} · {row.details ?? row.target_type ?? "—"}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </AdminLayout>
  );
}
