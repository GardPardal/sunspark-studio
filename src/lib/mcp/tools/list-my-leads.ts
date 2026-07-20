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
  name: "list_my_leads",
  title: "Listar meus leads",
  description:
    "Lista os leads atribuídos ao consultor autenticado. Suporta filtro por estágio e limite.",
  inputSchema: {
    stage: z
      .enum(["novo", "atendimento", "nao_atendido", "venda", "faturado", "perdido"])
      .optional()
      .describe("Filtrar por estágio do funil (opcional)."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de leads (padrão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ stage, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const sb = supabaseAs(ctx);
    let q = sb
      .from("leads")
      .select(
        "id,nome,telefone,email,cidade,estado,valor_conta,stage,origem,created_at,updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (stage) q = q.eq("stage", stage);
    const { data, error } = await q;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { leads: data ?? [] },
    };
  },
});
