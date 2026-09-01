import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Download, Search } from "lucide-react";
import { AppHeader, useAuthUser } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FIELD_LABELS, type HealthInfo } from "@/lib/health-fields";
import { listAccessLogs } from "@/lib/patient.functions";

export const Route = createFileRoute("/access-log")({
  component: AccessLogPage,
});

const ROLES = ["all", "doctor", "pharmacist", "hospital"] as const;

type LogRow = {
  id: string;
  role: string;
  viewer: string;
  token_id: string | null;
  device: string | null;
  fields_viewed: string[];
  at: string;
};

function AccessLogPage() {
  const user = useAuthUser();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLES)[number]>("all");
  const list = useServerFn(listAccessLogs);
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["access-logs"],
    queryFn: () => list() as Promise<LogRow[]>,
    enabled: !!user,
    refetchInterval: 5000,
  });

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (roleFilter !== "all" && l.role !== roleFilter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        l.viewer.toLowerCase().includes(q) ||
        (l.token_id?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [logs, query, roleFilter]);

  if (!user) return null;

  const exportCsv = () => {
    const header = ["When", "Role", "Viewer", "Token", "Device", "Sections"];
    const rows = filtered.map((l) => [
      new Date(l.at).toISOString(),
      l.role,
      l.viewer,
      l.token_id ? l.token_id.slice(0, 8).toUpperCase() : "",
      l.device ?? "",
      (l.fields_viewed ?? [])
        .map((f) => FIELD_LABELS[f as keyof HealthInfo] ?? f)
        .join("; "),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hayatbridge-access-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Access history
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              A permanent, append-only record of every provider who viewed your data,
              stored securely in the backend and scoped to your account.
            </p>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by viewer name or token"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  roleFilter === r
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatCard label="Total scans" value={logs.length} />
          <StatCard
            label="Unique viewers"
            value={new Set(logs.map((l) => l.viewer)).size}
          />
          <StatCard
            label="Last scan"
            value={
              logs[0]
                ? new Date(logs[0].at).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"
            }
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <ClipboardList className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-foreground">
                {logs.length === 0 ? "No access recorded yet" : "No entries match your filters"}
              </h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {logs.length === 0
                  ? "When a provider scans your QR code, their visit will appear here with a timestamp and the sections they saw."
                  : "Try clearing the search or role filter."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">When</th>
                  <th className="px-5 py-3 text-left font-medium">Role</th>
                  <th className="px-5 py-3 text-left font-medium">Viewer</th>
                  <th className="px-5 py-3 text-left font-medium">Token</th>
                  <th className="px-5 py-3 text-left font-medium">Sections</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-surface/60">
                    <td className="px-5 py-3 text-foreground">
                      <div>{new Date(log.at).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.device ?? "—"}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                        {log.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-foreground">{log.viewer}</td>
                    <td className="px-5 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                      {log.token_id ? log.token_id.slice(0, 8).toUpperCase() : "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {(log.fields_viewed ?? []).length}
                      </span>{" "}
                      · {(log.fields_viewed ?? [])
                        .slice(0, 3)
                        .map((f) => FIELD_LABELS[f as keyof HealthInfo] ?? f)
                        .join(", ")}
                      {(log.fields_viewed ?? []).length > 3 && "…"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
