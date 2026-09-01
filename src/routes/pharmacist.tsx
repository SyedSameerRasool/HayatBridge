import { createFileRoute, redirect } from "@tanstack/react-router";

// Pharmacists use the same verified-clinician workspace as doctors; the portal
// scopes visible fields by professional_role (see ROLE_FIELD_PERMISSIONS).
export const Route = createFileRoute("/pharmacist")({
  beforeLoad: () => {
    throw redirect({ to: "/doctor" });
  },
  component: () => null,
});
