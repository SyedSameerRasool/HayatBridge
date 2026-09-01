import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { Calendar, MapPin, Plus, Stethoscope, X } from "lucide-react";
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
import {
  createAppointment,
  deleteAppointment,
  listAppointments,
  updateAppointmentStatus,
} from "@/lib/patient.functions";

export const Route = createFileRoute("/appointments")({
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const user = useAuthUser();
  const qc = useQueryClient();
  const list = useServerFn(listAppointments);
  const create = useServerFn(createAppointment);
  const setStatus = useServerFn(updateAppointmentStatus);
  const remove = useServerFn(deleteAppointment);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => list(),
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: (data: {
      provider_name: string;
      specialty: string;
      location: string;
      scheduled_at: string;
      duration_minutes: number;
      notes: string;
    }) => create({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Appointment booked");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: "scheduled" | "completed" | "cancelled" }) =>
      setStatus({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Appointment removed");
    },
  });

  const [open, setOpen] = useState(false);

  if (!user) return null;

  const now = Date.now();
  const upcoming = rows.filter((r) => new Date(r.scheduled_at).getTime() >= now && r.status === "scheduled");
  const past = rows.filter((r) => !(new Date(r.scheduled_at).getTime() >= now && r.status === "scheduled"));

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Care schedule
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">Appointments</h1>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Book appointment
              </Button>
            </DialogTrigger>
            <BookDialog
              onSubmit={(v) => {
                createMut.mutate(v, { onSuccess: () => setOpen(false) });
              }}
              submitting={createMut.isPending}
            />
          </Dialog>
        </div>

        <Section title="Upcoming" count={upcoming.length} loading={isLoading}>
          {upcoming.length === 0 ? (
            <Empty text="No upcoming appointments. Book one above." />
          ) : (
            upcoming.map((a) => (
              <AppointmentCard
                key={a.id}
                appt={a}
                onCancel={() => statusMut.mutate({ id: a.id, status: "cancelled" })}
                onDelete={() => delMut.mutate(a.id)}
              />
            ))
          )}
        </Section>

        <Section title="Past & cancelled" count={past.length} loading={false}>
          {past.length === 0 ? (
            <Empty text="No past appointments yet." />
          ) : (
            past.map((a) => (
              <AppointmentCard key={a.id} appt={a} onDelete={() => delMut.mutate(a.id)} />
            ))
          )}
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  count,
  loading,
  children,
}: {
  title: string;
  count: number;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {loading ? "…" : count}
        </span>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

type Appt = {
  id: string;
  provider_name: string;
  specialty: string | null;
  location: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
};

function AppointmentCard({
  appt,
  onCancel,
  onDelete,
}: {
  appt: Appt;
  onCancel?: () => void;
  onDelete: () => void;
}) {
  const when = new Date(appt.scheduled_at);
  const tone =
    appt.status === "cancelled"
      ? "bg-destructive/10 text-destructive"
      : appt.status === "completed"
        ? "bg-success/15 text-success"
        : "bg-primary-soft text-primary";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-foreground">{appt.provider_name}</div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}>
              {appt.status}
            </span>
          </div>
          {appt.specialty && (
            <div className="text-sm text-muted-foreground">{appt.specialty}</div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(when, "EEE, MMM d · h:mm a")} · {appt.duration_minutes} min
            </span>
            {appt.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {appt.location}
              </span>
            )}
          </div>
          {appt.notes && <p className="mt-2 text-sm text-muted-foreground">{appt.notes}</p>}
        </div>
        <div className="flex gap-2">
          {onCancel && appt.status === "scheduled" && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function BookDialog({
  onSubmit,
  submitting,
}: {
  onSubmit: (v: {
    provider_name: string;
    specialty: string;
    location: string;
    scheduled_at: string;
    duration_minutes: number;
    notes: string;
  }) => void;
  submitting: boolean;
}) {
  const [providerName, setProviderName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [location, setLocation] = useState("");
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Book appointment</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label>Provider name</Label>
          <Input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="Dr. Sarah Ahmed" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Specialty</Label>
            <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Cardiology" />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main clinic" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Date & time</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Duration (min)</Label>
            <Input
              type="number"
              min={5}
              max={480}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 30)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for visit" />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!providerName || !when || submitting}
          onClick={() =>
            onSubmit({
              provider_name: providerName,
              specialty,
              location,
              scheduled_at: new Date(when).toISOString(),
              duration_minutes: duration,
              notes,
            })
          }
        >
          {submitting ? "Booking…" : "Confirm"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
