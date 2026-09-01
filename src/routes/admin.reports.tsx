import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SectionCard } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { adminListPatients, adminOverview, adminActivityLogs } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
  head: () => ({
    meta: [
      { title: "Reports · HayatBridge Admin" },
      { name: "description", content: "Export operational CSV reports for patients, accounts and admin activity." },
      { property: "og:title", content: "Reports · HayatBridge Admin" },
      { property: "og:description", content: "Downloadable operational reports for hospital administrators." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0] as object);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((r) => keys.map((k) => escape(r[k])).join(","))].join("\n");
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminReports() {
  const patientsFn = useServerFn(adminListPatients);
  const overviewFn = useServerFn(adminOverview);
  const logsFn = useServerFn(adminActivityLogs);

  const { data: overview } = useQuery({ queryKey: ["admin", "overview"], queryFn: () => overviewFn() });

  return (
    <AdminLayout title="Reports" subtitle="Download operational reports. Clinical records are excluded by design.">
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Patient account report" description="Names, emails, registration dates and account status.">
          <Button
            onClick={async () => {
              const rows = await patientsFn({ data: { status: "all" } });
              download("hayatbridge-patients.csv", toCsv(rows as unknown as Record<string, unknown>[]));
            }}
          >
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
        </SectionCard>

        <SectionCard title="Admin activity report" description="Full audit trail of administrator actions.">
          <Button
            variant="outline"
            onClick={async () => {
              const rows = await logsFn({ data: {} });
              download("hayatbridge-admin-activity.csv", toCsv(rows as unknown as Record<string, unknown>[]));
            }}
          >
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
        </SectionCard>

        <SectionCard title="Summary snapshot" description="Current network totals.">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Row label="Total patients" value={overview?.totalPatients} />
            <Row label="Active patients" value={overview?.activePatients} />
            <Row label="New today" value={overview?.newToday} />
            <Row label="QR profiles" value={overview?.qrProfiles} />
            <Row label="Feedback received" value={overview?.feedbackCount} />
            <Row label="Feedback open" value={overview?.openFeedback} />
          </dl>
        </SectionCard>
      </div>
    </AdminLayout>
  );
}

function Row({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{value ?? "—"}</dd>
    </div>
  );
}
