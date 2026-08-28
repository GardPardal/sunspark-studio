import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "admin_query",
  title: "Consultar banco (admin)",
  description:
    "Executa uma consulta SELECT/WITH em qualquer tabela do Solar OS e retorna JSON. Disponível apenas para usuários com papel admin. Toda chamada é auditada.",
  inputSchema: {
    sql: z
      .string()
      .min(6)
      .describe("Consulta SQL somente leitura (SELECT ou WITH), sem ponto e vírgula final."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ sql }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.rpc("mcp_admin_query" as never, { _sql: sql } as never);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
