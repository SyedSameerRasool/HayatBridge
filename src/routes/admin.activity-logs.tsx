import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SectionCard } from "@/components/admin/AdminUI";
import { Input } from "@/components/ui/input";
import { adminActivityLogs } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/activity-logs")({
  component: AdminActivityLogs,
  head: () => ({
    meta: [
      { title: "Activity Logs · HayatBridge Admin" },
      { name: "description", content: "Immutable audit trail of administrator actions, logins and account changes." },
      { property: "og:title", content: "Activity Logs · HayatBridge Admin" },
      { property: "og:description", content: "Every admin action recorded with a timestamp." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminActivityLogs() {
  const fn = useServerFn(adminActivityLogs);
  const [filter, setFilter] = useState("");
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin", "activity-logs", filter],
    queryFn: () => fn({ data: filter ? { action: filter } : {} }),
  });

  const logins = logs.filter((l) => l.action === "admin.login");

  return (
    <AdminLayout title="Activity Logs" subtitle="Every administrator action is recorded with a timestamp.">
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <SectionCard title="Audit trail" description={`${logs.length} entries`}>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by action (e.g. patient, announcement)" className="pl-9" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Admin</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>}
                {!isLoading && logs.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No activity recorded.</td></tr>
                )}
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2.5 font-medium">{l.action}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{l.admin_email ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{l.details ?? l.target_type ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Login history" description="Recent administrator sign-ins.">
          {logins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sign-ins recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {logins.slice(0, 15).map((l) => (
                <li key={l.id} className="rounded-lg bg-muted px-3 py-2 text-sm">
                  <p className="font-medium">{l.admin_email ?? "admin"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </AdminLayout>
  );
}
