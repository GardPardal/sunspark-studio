import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import listMyLeads from "./tools/list-my-leads";
import getLead from "./tools/get-lead";
import createLead from "./tools/create-lead";
import listMyAppointments from "./tools/list-my-appointments";
import createAppointment from "./tools/create-appointment";

// Direct Supabase issuer (not the .lovable.cloud proxy) — required for RFC 8414
// issuer matching. VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "lz7-crm-mcp",
  title: "LZ7 Energia CRM",
  version: "0.1.0",
  instructions:
    "Ferramentas do CRM LZ7 Energia. Cada chamada roda como o consultor autenticado (RLS aplicada). Use whoami para descobrir o usuário, list_my_leads/get_lead/create_lead para leads, e list_my_appointments/create_appointment para a agenda.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, listMyLeads, getLead, createLead, listMyAppointments, createAppointment],
});
