import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "dashhub_get",
  title: "Ler dados da Sala de Comando",
  description:
    "Retorna o pacote de dados atual exibido na página /dashhub (Sala de Comando), com origem e data da última atualização.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("hub_dados")
      .select("dados, origem, atualizado_em")
      .eq("id", 1)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const row = data ?? { dados: {}, origem: null, atualizado_em: null };
    return {
      content: [{ type: "text", text: JSON.stringify(row, null, 2) }],
      structuredContent: row as Record<string, unknown>,
    };
  },
});
