import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, CheckCircle2, ShieldCheck } from "lucide-react";
import { AppHeader, useRequirePatient } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { getLatestQuestionnaire, saveQuestionnaire } from "@/lib/patient.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/questionnaire")({
  component: QuestionnairePage,
  head: () => ({
    meta: [
      { title: "Comprehensive Health Questionnaire · HayatBridge" },
      { name: "description", content: "Complete a full HayatBridge intake: personal details, symptoms, medical history, medications, allergies, lifestyle, preventive care, PHQ-9 and GAD-7 screening." },
      { property: "og:title", content: "Comprehensive Health Questionnaire · HayatBridge" },
      { property: "og:description", content: "Full patient intake including PHQ-9 and GAD-7 mental-health screenings." },
    ],
  }),
});

const SYMPTOMS = [
  "Fever or chills",
  "Cough",
  "Shortness of breath",
  "Chest pain",
  "Headache",
  "Fatigue",
  "Nausea or vomiting",
  "Abdominal pain",
  "Dizziness",
  "Skin rash",
  "Joint or muscle pain",
  "Vision changes",
];

const CONDITIONS = [
  "Hypertension",
  "Diabetes",
  "Asthma",
  "Heart disease",
  "Kidney disease",
  "Cancer",
  "Thyroid disorder",
  "Depression / anxiety",
  "Autoimmune disease",
];

const PHQ9 = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling / staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself, or that you're a failure",
  "Trouble concentrating on things",
  "Moving or speaking so slowly others noticed — or the opposite, restless",
  "Thoughts of self-harm or that you'd be better off gone",
];

const GAD7 = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen",
];

const SCALE = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

function QuestionnairePage() {
  const patient = useRequirePatient();
  const navigate = useNavigate();
  const loadFn = useServerFn(getLatestQuestionnaire);
  const saveFn = useServerFn(saveQuestionnaire);

  const latest = useQuery({ queryKey: ["questionnaire"], queryFn: () => loadFn() });

  // Personal
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [pregnancyStatus, setPregnancyStatus] = useState("not-applicable");
  const [occupation, setOccupation] = useState("");

  // Symptoms
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [otherSymptoms, setOtherSymptoms] = useState("");
  const [symptomDuration, setSymptomDuration] = useState("");

  // Medical history
  const [conditions, setConditions] = useState<string[]>([]);
  const [otherConditions, setOtherConditions] = useState("");
  const [surgeries, setSurgeries] = useState("");
  const [familyHistory, setFamilyHistory] = useState("");

  // Medications
  const [medications, setMedications] = useState("");
  const [adherence, setAdherence] = useState("mostly");
  const [supplements, setSupplements] = useState("");

  // Allergies
  const [allergies, setAllergies] = useState("");

  // Lifestyle
  const [smoking, setSmoking] = useState("never");
  const [alcohol, setAlcohol] = useState("occasional");
  const [substanceUse, setSubstanceUse] = useState("no");
  const [exercise, setExercise] = useState("1-2");
  const [diet, setDiet] = useState("mixed");
  const [sleepHours, setSleepHours] = useState("7");
  const [stressLevel, setStressLevel] = useState("moderate");

  // Preventive care
  const [lastPhysical, setLastPhysical] = useState("");
  const [lastDental, setLastDental] = useState("");
  const [lastEye, setLastEye] = useState("");
  const [immunizations, setImmunizations] = useState<string[]>([]);
  const [screenings, setScreenings] = useState("");

  // Mental health
  const [phq, setPhq] = useState<number[]>(Array(9).fill(-1));
  const [gad, setGad] = useState<number[]>(Array(7).fill(-1));

  // Notes
  const [additionalNotes, setAdditionalNotes] = useState("");

  useEffect(() => {
    const d = latest.data?.responses as Record<string, unknown> | undefined;
    if (!d) return;
    setHeightCm(String(d.heightCm ?? ""));
    setWeightKg(String(d.weightKg ?? ""));
    setPregnancyStatus((d.pregnancyStatus as string) ?? "not-applicable");
    setOccupation((d.occupation as string) ?? "");
    setSymptoms((d.symptoms as string[]) ?? []);
    setOtherSymptoms((d.otherSymptoms as string) ?? "");
    setSymptomDuration((d.symptomDuration as string) ?? "");
    setConditions((d.conditions as string[]) ?? []);
    setOtherConditions((d.otherConditions as string) ?? "");
    setSurgeries((d.surgeries as string) ?? "");
    setFamilyHistory((d.familyHistory as string) ?? "");
    setMedications((d.medications as string) ?? "");
    setAdherence((d.adherence as string) ?? "mostly");
    setSupplements((d.supplements as string) ?? "");
    setAllergies((d.allergies as string) ?? "");
    setSmoking((d.smoking as string) ?? "never");
    setAlcohol((d.alcohol as string) ?? "occasional");
    setSubstanceUse((d.substanceUse as string) ?? "no");
    setExercise((d.exercise as string) ?? "1-2");
    setDiet((d.diet as string) ?? "mixed");
    setSleepHours((d.sleepHours as string) ?? "7");
    setStressLevel((d.stressLevel as string) ?? "moderate");
    setLastPhysical((d.lastPhysical as string) ?? "");
    setLastDental((d.lastDental as string) ?? "");
    setLastEye((d.lastEye as string) ?? "");
    setImmunizations((d.immunizations as string[]) ?? []);
    setScreenings((d.screenings as string) ?? "");
    setPhq((d.phq as number[]) ?? Array(9).fill(-1));
    setGad((d.gad as number[]) ?? Array(7).fill(-1));
    setAdditionalNotes((d.additionalNotes as string) ?? "");
  }, [latest.data]);

  const phqScore = phq.reduce((s, v) => s + (v > 0 ? v : 0), 0);
  const gadScore = gad.reduce((s, v) => s + (v > 0 ? v : 0), 0);
  const phqComplete = phq.every((v) => v >= 0);
  const gadComplete = gad.every((v) => v >= 0);

  const saveMut = useMutation({
    mutationFn: async () =>
      saveFn({
        data: {
          responses: {
            heightCm, weightKg, pregnancyStatus, occupation,
            symptoms, otherSymptoms, symptomDuration,
            conditions, otherConditions, surgeries, familyHistory,
            medications, adherence, supplements,
            allergies,
            smoking, alcohol, substanceUse, exercise, diet, sleepHours, stressLevel,
            lastPhysical, lastDental, lastEye, immunizations, screenings,
            phq, phqScore, gad, gadScore,
            additionalNotes,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Questionnaire saved to your secure record.");
      navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!patient) return null;

  const toggle = (list: string[], setList: (v: string[]) => void, item: string) =>
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Comprehensive health questionnaire
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your responses are encrypted and stored in your secure medical record — only you can view them.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary-soft/40 px-4 py-3 text-sm text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Protected by row-level security. No third party can read this data.
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate();
          }}
          className="mt-6 space-y-6"
        >
          <Card title="Personal details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Height (cm)">
                <Input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
              </Field>
              <Field label="Weight (kg)">
                <Input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
              </Field>
              <Field label="Occupation">
                <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
              </Field>
              <Field label="Pregnancy status">
                <RadioRow
                  name="pregnancy"
                  value={pregnancyStatus}
                  onChange={setPregnancyStatus}
                  options={[
                    { value: "not-applicable", label: "N/A" },
                    { value: "not-pregnant", label: "Not pregnant" },
                    { value: "pregnant", label: "Pregnant" },
                    { value: "trying", label: "Trying" },
                  ]}
                />
              </Field>
            </div>
          </Card>

          <Card title="Current symptoms" subtitle="Anything you've experienced in the last 7 days.">
            <div className="grid gap-2 sm:grid-cols-2">
              {SYMPTOMS.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:bg-secondary">
                  <Checkbox checked={symptoms.includes(s)} onCheckedChange={() => toggle(symptoms, setSymptoms, s)} />
                  <span className="text-sm font-medium text-foreground">{s}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="How long?">
                <Input placeholder="e.g. 3 days, 2 weeks" value={symptomDuration} onChange={(e) => setSymptomDuration(e.target.value)} />
              </Field>
              <Field label="Other symptoms">
                <Input placeholder="Anything not listed" value={otherSymptoms} onChange={(e) => setOtherSymptoms(e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card title="Medical history" subtitle="Chronic conditions, surgeries, and family history.">
            <div className="grid gap-2 sm:grid-cols-2">
              {CONDITIONS.map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:bg-secondary">
                  <Checkbox checked={conditions.includes(c)} onCheckedChange={() => toggle(conditions, setConditions, c)} />
                  <span className="text-sm font-medium text-foreground">{c}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Other conditions">
                <Input value={otherConditions} onChange={(e) => setOtherConditions(e.target.value)} />
              </Field>
              <Field label="Past surgeries or hospitalizations">
                <Textarea rows={2} value={surgeries} onChange={(e) => setSurgeries(e.target.value)} placeholder="Procedure · year" />
              </Field>
              <Field label="Family medical history">
                <Textarea rows={2} value={familyHistory} onChange={(e) => setFamilyHistory(e.target.value)} placeholder="e.g. Father — diabetes; Mother — hypertension" />
              </Field>
            </div>
          </Card>

          <Card title="Medications" subtitle="What are you currently taking?">
            <Field label="Current medications">
              <Textarea rows={3} placeholder="Name · dose · frequency" value={medications} onChange={(e) => setMedications(e.target.value)} />
            </Field>
            <div className="mt-4 space-y-2">
              <Label>How often do you take them as prescribed?</Label>
              <RadioRow
                name="adherence"
                value={adherence}
                onChange={setAdherence}
                options={[
                  { value: "always", label: "Always" },
                  { value: "mostly", label: "Mostly" },
                  { value: "sometimes", label: "Sometimes" },
                  { value: "rarely", label: "Rarely" },
                ]}
              />
            </div>
            <div className="mt-4">
              <Field label="Supplements or over-the-counter">
                <Textarea rows={2} value={supplements} onChange={(e) => setSupplements(e.target.value)} placeholder="Vitamins, herbal, OTC" />
              </Field>
            </div>
          </Card>

          <Card title="Allergies" subtitle="Include drug, food, and environmental allergies.">
            <Textarea rows={3} placeholder="e.g. Penicillin (rash), peanuts (anaphylaxis)" value={allergies} onChange={(e) => setAllergies(e.target.value)} />
          </Card>

          <Card title="Lifestyle">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Smoking">
                <RadioRow name="smoking" value={smoking} onChange={setSmoking} options={[
                  { value: "never", label: "Never" }, { value: "former", label: "Former" }, { value: "current", label: "Current" },
                ]} />
              </Field>
              <Field label="Alcohol">
                <RadioRow name="alcohol" value={alcohol} onChange={setAlcohol} options={[
                  { value: "none", label: "None" }, { value: "occasional", label: "Occasional" }, { value: "weekly", label: "Weekly" }, { value: "daily", label: "Daily" },
                ]} />
              </Field>
              <Field label="Recreational substance use">
                <RadioRow name="substance" value={substanceUse} onChange={setSubstanceUse} options={[
                  { value: "no", label: "No" }, { value: "past", label: "Past" }, { value: "current", label: "Current" },
                ]} />
              </Field>
              <Field label="Exercise (days per week)">
                <RadioRow name="exercise" value={exercise} onChange={setExercise} options={[
                  { value: "0", label: "0" }, { value: "1-2", label: "1–2" }, { value: "3-4", label: "3–4" }, { value: "5+", label: "5+" },
                ]} />
              </Field>
              <Field label="Diet">
                <RadioRow name="diet" value={diet} onChange={setDiet} options={[
                  { value: "mixed", label: "Mixed" }, { value: "vegetarian", label: "Vegetarian" }, { value: "vegan", label: "Vegan" }, { value: "other", label: "Other" },
                ]} />
              </Field>
              <Field label="Average hours of sleep">
                <Input type="number" min={0} max={16} value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} />
              </Field>
              <Field label="Stress level" full>
                <RadioRow name="stress" value={stressLevel} onChange={setStressLevel} options={[
                  { value: "low", label: "Low" }, { value: "moderate", label: "Moderate" }, { value: "high", label: "High" }, { value: "severe", label: "Severe" },
                ]} />
              </Field>
            </div>
          </Card>

          <Card title="Preventive care" subtitle="Recent checkups and screenings.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Last physical exam">
                <Input type="date" value={lastPhysical} onChange={(e) => setLastPhysical(e.target.value)} />
              </Field>
              <Field label="Last dental visit">
                <Input type="date" value={lastDental} onChange={(e) => setLastDental(e.target.value)} />
              </Field>
              <Field label="Last eye exam">
                <Input type="date" value={lastEye} onChange={(e) => setLastEye(e.target.value)} />
              </Field>
            </div>
            <div className="mt-4">
              <Label>Immunizations up to date</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {["Influenza (annual)", "COVID-19", "Tetanus / Tdap", "Hepatitis B", "MMR", "HPV"].map((v) => (
                  <label key={v} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:bg-secondary">
                    <Checkbox checked={immunizations.includes(v)} onCheckedChange={() => toggle(immunizations, setImmunizations, v)} />
                    <span className="text-sm font-medium text-foreground">{v}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <Field label="Cancer screenings (mammogram, colonoscopy, Pap smear, etc.)">
                <Textarea rows={2} value={screenings} onChange={(e) => setScreenings(e.target.value)} placeholder="Type · date · result" />
              </Field>
            </div>
          </Card>

          <ScreenerCard
            title="Mood — PHQ-9"
            subtitle="Over the last 2 weeks, how often have you been bothered by any of the following?"
            questions={PHQ9}
            values={phq}
            setValues={setPhq}
            score={phqScore}
            complete={phqComplete}
            severity={phqScoreSeverity(phqScore)}
          />

          <ScreenerCard
            title="Anxiety — GAD-7"
            subtitle="Over the last 2 weeks, how often have you been bothered by any of the following?"
            questions={GAD7}
            values={gad}
            setValues={setGad}
            score={gadScore}
            complete={gadComplete}
            severity={gadScoreSeverity(gadScore)}
          />

          <Card title="Additional notes" subtitle="Anything else your care team should know.">
            <Textarea rows={3} value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} />
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : "Save responses"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-2 ${full ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function RadioRow({
  name, value, onChange, options,
}: {
  name: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={selected}
            aria-label={`${name}: ${o.label}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-secondary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ScreenerCard({
  title, subtitle, questions, values, setValues, score, complete, severity,
}: {
  title: string; subtitle: string; questions: string[]; values: number[]; setValues: (v: number[]) => void;
  score: number; complete: boolean; severity: string;
}) {
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q} className="rounded-xl border border-border bg-surface p-4">
            <div className="text-sm font-medium text-foreground">{i + 1}. {q}</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {SCALE.map((opt) => {
                const selected = values[i] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setValues(values.map((v, idx) => (idx === i ? opt.value : v)))}
                    className={`rounded-lg border p-2 text-xs font-medium transition-colors ${
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-secondary"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {complete && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft/50 p-4">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <div className="text-sm">
              <div className="font-semibold text-foreground">{title.split(" — ")[0]} score: {score} · {severity}</div>
              <div className="text-muted-foreground">For guidance only — not a diagnosis. Please discuss with your provider.</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function phqScoreSeverity(s: number): string {
  if (s <= 4) return "Minimal";
  if (s <= 9) return "Mild";
  if (s <= 14) return "Moderate";
  if (s <= 19) return "Moderately severe";
  return "Severe";
}

function gadScoreSeverity(s: number): string {
  if (s <= 4) return "Minimal";
  if (s <= 9) return "Mild";
  if (s <= 14) return "Moderate";
  return "Severe";
}
