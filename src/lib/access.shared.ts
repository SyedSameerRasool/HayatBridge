// Client-safe constants/helpers for the clinician access-request workflow.
export type ClinicianRole = "doctor" | "pharmacist" | "nurse" | "emergency_physician";

export const CLINICIAN_ROLES: { value: ClinicianRole; label: string }[] = [
  { value: "doctor", label: "Doctor" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "nurse", label: "Nurse" },
  { value: "emergency_physician", label: "Emergency Physician" },
];

export const CLINICIAN_ROLE_LABEL: Record<string, string> = {
  doctor: "Doctor",
  pharmacist: "Pharmacist",
  nurse: "Nurse",
  emergency_physician: "Emergency Physician",
};

export const ALL_CONSENT_FIELDS = [
  "fullName",
  "dateOfBirth",
  "bloodType",
  "phone",
  "emergencyContact",
  "allergies",
  "medications",
  "diagnoses",
  "recentReports",
  "notes",
] as const;

// Role-based permissions: which consent fields each professional role may see.
export const ROLE_FIELD_PERMISSIONS: Record<string, readonly string[]> = {
  doctor: ALL_CONSENT_FIELDS,
  emergency_physician: ALL_CONSENT_FIELDS,
  pharmacist: ["fullName", "dateOfBirth", "allergies", "medications"],
  nurse: [
    "fullName",
    "dateOfBirth",
    "bloodType",
    "emergencyContact",
    "allergies",
    "medications",
  ],
};

export function fieldsForRole(role: string, approved: string[]): string[] {
  const allowed = ROLE_FIELD_PERMISSIONS[role] ?? ROLE_FIELD_PERMISSIONS["doctor"]!;
  return approved.filter((f) => allowed.includes(f));
}

export const ACCESS_GRANT_MINUTES = 30;

export type AccessGrantStatus =
  | "pending"
  | "approved"
  | "denied"
  | "revoked"
  | "expired"
  | "unknown";

export const UNVERIFIED_MESSAGE =
  "Access denied. Only verified healthcare professionals may access patient records.";