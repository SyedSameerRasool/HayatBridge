import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { useState } from "react";
import { FlaskConical, Upload, X, FileImage } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import {
  addPatientTestResult,
  deletePatientTestResult,
  getReportSignedUrl,
  listTestResults,
} from "@/lib/patient.functions";

export const Route = createFileRoute("/test-results")({
  component: TestResultsPage,
  head: () => ({
    meta: [
      { title: "Test Results · HayatBridge" },
      {
        name: "description",
        content:
          "View provider-released lab and imaging results, and upload photos of your own lab reports to your secure HayatBridge record.",
      },
      { property: "og:title", content: "Test Results · HayatBridge" },
      {
        property: "og:description",
        content: "Lab results and patient-uploaded reports in HayatBridge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  test_name: string;
  category: string | null;
  value: string | null;
  unit: string | null;
  flag: string | null;
  reference_range: string | null;
  ordering_provider: string | null;
  resulted_at: string;
  report_url: string | null;
  patient_notes: string | null;
  source: string | null;
};

function TestResultsPage() {
  const user = useAuthUser();
  const qc = useQueryClient();
  const list = useServerFn(listTestResults);
  const addUpload = useServerFn(addPatientTestResult);
  const removeUpload = useServerFn(deletePatientTestResult);
  const signUrl = useServerFn(getReportSignedUrl);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["test-results"],
    queryFn: () => list(),
    enabled: !!user,
  });

  const [open, setOpen] = useState(false);
  const [testName, setTestName] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!file || !user) throw new Error("Choose a report image or PDF first");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("lab-reports")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw new Error(upErr.message);
      return addUpload({
        data: {
          test_name: testName.trim(),
          category: category.trim() || null,
          resulted_at: new Date(date).toISOString(),
          report_url: path,
          patient_notes: notes.trim() || null,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-results"] });
      toast.success("Report uploaded to your record");
      setOpen(false);
      setTestName("");
      setCategory("");
      setNotes("");
      setFile(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => removeUpload({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-results"] });
      toast.success("Upload removed");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  async function openReport(path: string) {
    try {
      const { url } = await signUrl({ data: { path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!user) return null;

  const all = rows as unknown as Row[];
  const provider = all.filter((r) => r.source !== "patient_upload");
  const uploads = all.filter((r) => r.source === "patient_upload");

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Lab & imaging
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">Test results</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Provider-released results are read-only. You can also upload photos or PDFs of
              outside lab reports to keep everything in one record.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4" /> Upload lab report
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload a lab report</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="tr-name">Test name</Label>
                  <Input
                    id="tr-name"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="e.g. Complete Blood Count"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="tr-cat">Category</Label>
                    <Input
                      id="tr-cat"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Hematology"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tr-date">Report date</Label>
                    <Input
                      id="tr-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="tr-file">Report image or PDF</Label>
                  <Input
                    id="tr-file"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Stored privately — only you can open it. Automatic reading of uploaded
                    reports is coming soon.
                  </p>
                </div>
                <div>
                  <Label htmlFor="tr-notes">Notes</Label>
                  <Textarea
                    id="tr-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Where it was done, what it was for…"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={uploadMut.isPending || !testName.trim() || !file}
                  onClick={() => uploadMut.mutate()}
                >
                  {uploadMut.isPending ? "Uploading…" : "Upload report"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Released by your provider
        </h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : provider.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <FlaskConical className="h-6 w-6" />
              </div>
              <div className="mt-3 text-sm font-medium text-foreground">No results yet</div>
              <p className="mt-1 text-sm text-muted-foreground">
                When your provider releases lab or imaging results, they'll show up here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Test</th>
                    <th className="px-4 py-3 text-left">Result</th>
                    <th className="px-4 py-3 text-left">Reference</th>
                    <th className="px-4 py-3 text-left">Provider</th>
                    <th className="px-4 py-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {provider.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{r.test_name}</div>
                        {r.category && (
                          <div className="text-xs text-muted-foreground">{r.category}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold tabular-nums text-foreground">
                          {r.value}
                          {r.unit ? ` ${r.unit}` : ""}
                        </span>
                        {r.flag && r.flag !== "normal" && (
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                              r.flag === "critical"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-warning/15 text-warning-foreground"
                            }`}
                          >
                            {r.flag}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {r.reference_range || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.ordering_provider || "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {format(new Date(r.resulted_at), "MMM d, yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your uploaded reports
        </h2>
        <div className="mt-3 space-y-3">
          {uploads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No uploads yet. Add a photo of an outside lab report to keep it with your record.
            </div>
          ) : (
            uploads.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <FileImage className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-foreground">{r.test_name}</div>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Uploaded by you
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    {r.category && <span>{r.category}</span>}
                    <span>{format(new Date(r.resulted_at), "MMM d, yyyy")}</span>
                  </div>
                  {r.patient_notes && (
                    <p className="mt-2 text-sm text-muted-foreground">{r.patient_notes}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {r.report_url && (
                    <Button variant="outline" size="sm" onClick={() => openReport(r.report_url!)}>
                      View report
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => delMut.mutate(r.id)}
                    aria-label="Delete upload"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
