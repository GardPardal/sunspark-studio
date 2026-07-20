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
  name: "list_my_appointments",
  title: "Listar meus compromissos",
  description: "Lista compromissos da agenda do usuário autenticado em uma janela de datas.",
  inputSchema: {
    from: z.string().describe("Data inicial ISO (ex: 2026-07-20)."),
    to: z.string().describe("Data final ISO (ex: 2026-07-27)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const { data, error } = await supabaseAs(ctx)
      .from("agenda_appointments")
      .select("id,title,type,status,starts_at,ends_at,lead_id,notes")
      .eq("consultor_id", ctx.getUserId()!)
      .gte("starts_at", from)
      .lte("starts_at", to)
      .order("starts_at", { ascending: true });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { appointments: data ?? [] },
    };
  },
});
