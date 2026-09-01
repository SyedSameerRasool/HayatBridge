import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Send } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SectionCard, StatusBadge } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { adminListFeedback, adminUpdateFeedback } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/feedback")({
  component: AdminFeedback,
  head: () => ({
    meta: [
      { title: "Feedback · HayatBridge Admin" },
      { name: "description", content: "Review, reply to and resolve patient feedback submitted to HayatBridge." },
      { property: "og:title", content: "Feedback · HayatBridge Admin" },
      { property: "og:description", content: "Patient feedback queue for HayatBridge administrators." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminFeedback() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListFeedback);
  const updateFn = useServerFn(adminUpdateFeedback);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const { data: items = [], isLoading } = useQuery({ queryKey: ["admin", "feedback"], queryFn: () => listFn() });

  const update = useMutation({
    mutationFn: (vars: { id: string; admin_reply?: string; status?: "open" | "in_progress" | "resolved" }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Feedback updated");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminLayout title="Feedback" subtitle="Respond to patient feedback and close resolved items.">
      <div className="grid gap-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading feedback…</p>}
        {!isLoading && items.length === 0 && (
          <SectionCard title="No feedback yet">
            <p className="text-sm text-muted-foreground">Patient feedback submitted from the portal appears here.</p>
          </SectionCard>
        )}
        {items.map((f) => (
          <SectionCard key={f.id} title={f.subject} description={`${f.category} · ${new Date(f.created_at).toLocaleString()}`}>
            <div className="mb-3 flex items-center gap-2">
              <StatusBadge status={f.status} />
              {f.replied_at && <span className="text-xs text-muted-foreground">Replied {new Date(f.replied_at).toLocaleDateString()}</span>}
            </div>
            <p className="rounded-lg bg-muted p-3 text-sm">{f.message}</p>
            {f.admin_reply && (
              <p className="mt-3 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
                <span className="font-semibold text-success">Admin reply: </span>
                {f.admin_reply}
              </p>
            )}
            <div className="mt-4 space-y-2">
              <Textarea
                rows={2}
                placeholder="Write a reply to this patient…"
                value={replies[f.id] ?? ""}
                onChange={(e) => setReplies((r) => ({ ...r, [f.id]: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!(replies[f.id] ?? "").trim()}
                  onClick={() => {
                    update.mutate({ id: f.id, admin_reply: (replies[f.id] ?? "").trim(), status: "in_progress" });
                    setReplies((r) => ({ ...r, [f.id]: "" }));
                  }}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" /> Send reply
                </Button>
                {f.status !== "resolved" && (
                  <Button variant="outline" size="sm" onClick={() => update.mutate({ id: f.id, status: "resolved" })}>
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Mark resolved
                  </Button>
                )}
                {f.status === "resolved" && (
                  <Button variant="outline" size="sm" onClick={() => update.mutate({ id: f.id, status: "open" })}>
                    Reopen
                  </Button>
                )}
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </AdminLayout>
  );
}
