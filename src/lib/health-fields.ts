// Client-safe field metadata for the patient health record.
// (The record itself lives in the database; nothing here touches browser storage.)
export type HealthInfo = {
  fullName: string;
  dateOfBirth: string;
  bloodType: string;
  phone: string;
  emergencyContact: string;
  allergies: string;
  medications: string;
  diagnoses: string;
  recentReports: string;
  notes: string;
};

export const FIELD_LABELS: Record<keyof HealthInfo, string> = {
  fullName: "Full name",
  dateOfBirth: "Date of birth",
  bloodType: "Blood type",
  phone: "Phone",
  emergencyContact: "Emergency contact",
  allergies: "Allergies",
  medications: "Medications",
  diagnoses: "Diagnoses",
  recentReports: "Recent reports",
  notes: "Notes",
};

export function emptyHealth(): HealthInfo {
  return {
    fullName: "",
    dateOfBirth: "",
    bloodType: "",
    phone: "",
    emergencyContact: "",
    allergies: "",
    medications: "",
    diagnoses: "",
    recentReports: "",
    notes: "",
  };
}
