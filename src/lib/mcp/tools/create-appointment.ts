import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function supabaseAs(ctx: ToolContext) {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_appointment",
  title: "Criar compromisso na agenda",
  description:
    "Agenda um novo compromisso (visita, ligação, reunião) para o consultor autenticado. Datas em ISO 8601.",
  inputSchema: {
    title: z.string().min(1),
    starts_at: z.string().describe("Início em ISO 8601 (ex: 2026-07-21T14:00:00-03:00)"),
    ends_at: z.string().describe("Fim em ISO 8601"),
    type: z.enum(["visita", "ligacao", "reuniao", "outros"]).optional(),
    lead_id: z.string().uuid().optional(),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const uid = ctx.getUserId()!;
    const { data, error } = await supabaseAs(ctx)
      .from("agenda_appointments")
      .insert({
        consultor_id: uid,
        created_by: uid,
        title: input.title,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        type: (input.type ?? "outros") as Database["public"]["Enums"]["agenda_appointment_type"],
        lead_id: input.lead_id ?? null,
        notes: input.notes ?? null,
      })
      .select("id,title,starts_at,ends_at,type,status")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Compromisso criado: ${data.id}` }],
      structuredContent: { appointment: data },
    };
  },
});
