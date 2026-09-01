import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SectionCard } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { adminListAnnouncements, adminSaveAnnouncement, adminDeleteAnnouncement } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/announcements")({
  component: AdminAnnouncements,
  head: () => ({
    meta: [
      { title: "Announcements · HayatBridge Admin" },
      { name: "description", content: "Create, edit and publish announcements to HayatBridge portal users." },
      { property: "og:title", content: "Announcements · HayatBridge Admin" },
      { property: "og:description", content: "Broadcast hospital notices to patients from one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminAnnouncements() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListAnnouncements);
  const saveFn = useServerFn(adminSaveAnnouncement);
  const deleteFn = useServerFn(adminDeleteAnnouncement);

  const [form, setForm] = useState({ id: "", title: "", body: "", published: false });
  const { data: items = [] } = useQuery({ queryKey: ["admin", "announcements"], queryFn: () => listFn() });

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          ...(form.id ? { id: form.id } : {}),
          title: form.title,
          body: form.body,
          audience: "all" as const,
          published: form.published,
        },
      }),
    onSuccess: () => {
      toast.success(form.id ? "Announcement updated" : "Announcement created");
      setForm({ id: "", title: "", body: "", published: false });
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Announcement deleted");
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminLayout title="Announcements" subtitle="Publish hospital notices to everyone using the portal.">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <SectionCard title={form.id ? "Edit announcement" : "Create announcement"}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.title.trim().length < 3 || form.body.trim().length < 3) {
                toast.error("Title and message are required.");
                return;
              }
              save.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="a-title">Title</Label>
              <Input id="a-title" value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-body">Message</Label>
              <Textarea id="a-body" rows={5} maxLength={4000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v === true })} />
              Publish to users immediately
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending}>
                <Plus className="mr-1.5 h-4 w-4" /> {form.id ? "Save changes" : "Create"}
              </Button>
              {form.id && (
                <Button type="button" variant="outline" onClick={() => setForm({ id: "", title: "", body: "", published: false })}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </SectionCard>

        <SectionCard title="All announcements" description={`${items.length} item(s)`}>
          <ul className="divide-y divide-border">
            {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing published yet.</p>}
            {items.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{a.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.published ? "Published" : "Draft"} · {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="icon" aria-label="Edit" onClick={() => setForm({ id: a.id, title: a.title, body: a.body, published: a.published })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" aria-label="Delete" className="text-destructive" onClick={() => remove.mutate(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </AdminLayout>
  );
}
