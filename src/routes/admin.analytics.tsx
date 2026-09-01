import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, QrCode, UserCheck, LogIn } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SectionCard, StatCard, MiniBarChart } from "@/components/admin/AdminUI";
import { adminAnalytics } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
  head: () => ({
    meta: [
      { title: "Analytics · HayatBridge Admin" },
      { name: "description", content: "Registration trends, active users, QR usage and login statistics for HayatBridge." },
      { property: "og:title", content: "Analytics · HayatBridge Admin" },
      { property: "og:description", content: "Usage analytics for the HayatBridge patient network." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminAnalytics() {
  const fn = useServerFn(adminAnalytics);
  const { data } = useQuery({ queryKey: ["admin", "analytics"], queryFn: () => fn() });

  return (
    <AdminLayout title="Analytics" subtitle="Trends across the last 30 days.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={UserCheck} label="Active users (7 days)" value={data?.activeLast7 ?? "—"} tone="green" />
        <StatCard icon={LogIn} label="Active users (30 days)" value={data?.activeLast30 ?? "—"} />
        <StatCard icon={QrCode} label="QR profiles generated" value={data?.qrUsage.reduce((a, b) => a + b.count, 0) ?? "—"} />
        <StatCard icon={BarChart3} label="Record views logged" value={data?.totalScans ?? "—"} tone="green" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Registration trend">
          <MiniBarChart data={data?.registrations ?? []} label="New patient registrations" />
        </SectionCard>
        <SectionCard title="QR code usage">
          <MiniBarChart data={data?.qrUsage ?? []} label="Share links generated" />
        </SectionCard>
        <SectionCard title="Login statistics">
          <MiniBarChart data={data?.logins ?? []} label="Most recent logins" />
        </SectionCard>
        <SectionCard title="Record views by viewer role">
          {(data?.scansByRole ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No scans recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {(data?.scansByRole ?? []).map((r) => (
                <li key={r.role} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                  <span className="capitalize">{r.role}</span>
                  <span className="font-semibold">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </AdminLayout>
  );
}
