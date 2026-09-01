import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Mail, MailOpen, Send } from "lucide-react";
import { toast } from "sonner";
import { AppHeader, useAuthUser } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { listMessages, markMessageRead, sendMessage } from "@/lib/patient.functions";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const user = useAuthUser();
  const qc = useQueryClient();
  const list = useServerFn(listMessages);
  const send = useServerFn(sendMessage);
  const markRead = useServerFn(markMessageRead);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["messages"],
    queryFn: () => list(),
    enabled: !!user,
  });

  const sendMut = useMutation({
    mutationFn: (data: { subject: string; body: string; provider_name: string | null }) =>
      send({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Message sent");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const readMut = useMutation({
    mutationFn: (id: string) => markRead({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Secure inbox
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">Messages</h1>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="h-4 w-4" /> New message
              </Button>
            </DialogTrigger>
            <ComposeDialog
              submitting={sendMut.isPending}
              onSubmit={(v) => sendMut.mutate(v, { onSuccess: () => setOpen(false) })}
            />
          </Dialog>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No messages yet. Send one to your care team.
            </div>
          ) : (
            rows.map((m) => {
              const unread = !m.read_at && m.sender === "provider";
              return (
                <button
                  key={m.id}
                  onClick={() => unread && readMut.mutate(m.id)}
                  className={`flex w-full items-start gap-4 rounded-2xl border p-5 text-left shadow-[var(--shadow-card)] transition-colors ${
                    unread ? "border-primary/40 bg-primary-soft/40" : "border-border bg-card"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      unread ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {unread ? <Mail className="h-5 w-5" /> : <MailOpen className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-semibold text-foreground">{m.subject}</div>
                      <div className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.sender === "patient" ? "You" : m.provider_name || "Care team"}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{m.body}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

function ComposeDialog({
  onSubmit,
  submitting,
}: {
  onSubmit: (v: { subject: string; body: string; provider_name: string | null }) => void;
  submitting: boolean;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [provider, setProvider] = useState("");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New message</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>To (provider)</Label>
          <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Dr. Ahmed" />
        </div>
        <div className="space-y-1.5">
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Message</Label>
          <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!subject || !body || submitting}
          onClick={() =>
            onSubmit({ subject, body, provider_name: provider || null })
          }
        >
          {submitting ? "Sending…" : "Send"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
