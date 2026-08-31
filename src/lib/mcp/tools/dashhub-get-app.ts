import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

type App = { css?: string; body?: string; js?: string };

export default defineTool({
  name: "dashhub_get_app",
  title: "Ler o painel da Sala de Comando (HTML/CSS/JS)",
  description:
    "Retorna o painel atual da página /dashhub: as partes css, body e js guardadas em dados.APP. Use parte='css'|'body'|'js' para pegar só um pedaço (evita respostas gigantes). Sem parte, retorna apenas o tamanho de cada pedaço.",
  inputSchema: {
    parte: z
      .enum(["css", "body", "js"])
      .optional()
      .describe("Qual pedaço retornar. Omita para ver só os tamanhos."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ parte }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("hub_dados")
      .select("dados")
      .eq("id", 1)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const dados = ((data?.dados ?? {}) as Record<string, unknown>) ?? {};
    const app = (dados["APP"] ?? {}) as App;

    if (parte) {
      const txt = app[parte] ?? "";
      return {
        content: [{ type: "text", text: txt }],
        structuredContent: { parte, tamanho: txt.length, conteudo: txt },
      };
    }

    const resumo = {
      css: (app.css ?? "").length,
      body: (app.body ?? "").length,
      js: (app.js ?? "").length,
      outras_chaves: Object.keys(dados).filter((k) => k !== "APP"),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(resumo, null, 2) }],
      structuredContent: resumo,
    };
  },
});
