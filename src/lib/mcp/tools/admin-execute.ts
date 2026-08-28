import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "admin_execute",
  title: "Alterar dados (admin)",
  description:
    "Executa INSERT/UPDATE/DELETE (ou DDL) no banco do Solar OS. Disponível apenas para usuários com papel admin. Toda chamada é auditada. Use com cuidado: as alterações são permanentes.",
  inputSchema: {
    sql: z
      .string()
      .min(6)
      .describe("Comando SQL de escrita. Sempre inclua WHERE em UPDATE/DELETE."),
    confirm: z
      .literal(true)
      .describe("Confirmação explícita de que a alteração deve ser aplicada."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ sql, confirm }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    if (!confirm)
      return { content: [{ type: "text", text: "Confirmação ausente." }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.rpc("mcp_admin_execute" as never, { _sql: sql } as never);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { result: data },
    };
  },
});
