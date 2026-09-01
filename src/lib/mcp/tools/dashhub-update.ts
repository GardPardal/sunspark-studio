import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "dashhub_update",
  title: "Editar dados da Sala de Comando",
  description:
    "Atualiza o pacote de dados da página /dashhub. Por padrão faz merge no primeiro nível (chaves ausentes são preservadas); use mode='replace' para substituir tudo. A versão anterior é sempre salva no histórico.",
  inputSchema: {
    dados: z
      .record(z.string(), z.unknown())
      .describe("Objeto JSON com as chaves a gravar. Objeto vazio não altera nada."),
    mode: z.enum(["merge", "replace"]).optional().describe("merge (padrão) ou replace."),
    origem: z.string().max(200).optional().describe("Quem fez a alteração (ex: claude-mcp)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ dados, mode, origem }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const sb = supabaseForUser(ctx);

    const { data: cur, error: readErr } = await sb
      .from("hub_dados")
      .select("dados")
      .eq("id", 1)
      .maybeSingle();
    if (readErr) return { content: [{ type: "text", text: readErr.message }], isError: true };

    const prev = (cur?.dados ?? {}) as Record<string, unknown>;

    if (Object.keys(dados).length === 0) {
      return {
        content: [{ type: "text", text: "Nenhuma chave enviada — nada foi alterado." }],
        structuredContent: { noop: true, dados: prev },
      };
    }

    if (cur) {
      await sb
        .from("hub_dados_hist")
        .insert({ dados: prev as never, origem: origem ?? "mcp" } as never);
    }

    const next = (mode ?? "merge") === "merge" ? { ...prev, ...dados } : dados;

    const { data, error } = await sb
      .from("hub_dados")
      .upsert(
        {
          id: 1,
          dados: next as never,
          origem: origem ?? "mcp",
          atualizado_em: new Date().toISOString(),
        } as never,
        { onConflict: "id" },
      )
      .select("dados, origem, atualizado_em")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: (data ?? { dados: next }) as Record<string, unknown>,
    };
  },
});
