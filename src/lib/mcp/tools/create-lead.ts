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
  name: "create_lead",
  title: "Criar lead",
  description:
    "Cria um novo lead no CRM, atribuído ao usuário autenticado. Use quando o consultor informar um contato novo.",
  inputSchema: {
    nome: z.string().min(1),
    telefone: z.string().min(1),
    email: z.string().email().optional(),
    cidade: z.string().optional(),
    estado: z.string().optional(),
    valor_conta: z.string().optional().describe("Valor médio da conta de luz, em reais (texto)."),
    mensagem: z.string().optional(),
    origem: z.string().optional().describe("Ex: indicação, whatsapp, mcp"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const uid = ctx.getUserId()!;
    const { data, error } = await supabaseAs(ctx)
      .from("leads")
      .insert({
        nome: input.nome,
        telefone: input.telefone,
        email: input.email ?? null,
        cidade: input.cidade ?? null,
        estado: input.estado ?? null,
        valor_conta: input.valor_conta ?? null,
        mensagem: input.mensagem ?? null,
        origem: input.origem ?? "mcp",
        assigned_to: uid,
        created_by: uid,
      })
      .select("id,nome,telefone,stage,created_at")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Lead criado: ${data.id}` }],
      structuredContent: { lead: data },
    };
  },
});
