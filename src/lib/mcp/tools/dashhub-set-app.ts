import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

type App = { css?: string; body?: string; js?: string };

export default defineTool({
  name: "dashhub_set_app",
  title: "Editar o painel da Sala de Comando (HTML/CSS/JS)",
  description:
    "Reescreve o painel da página /dashhub. Envie css, body e/ou js — o que não for enviado permanece igual. body é o HTML interno da página (sem <html>/<head>/<body>), css é CSS puro (sem <style>) e js é JavaScript puro (sem <script>), que pode ler os números em window.__HUB_DADOS. A versão anterior é sempre salva no histórico.",
  inputSchema: {
    css: z.string().max(400000).optional().describe("CSS puro, sem a tag <style>."),
    body: z.string().max(400000).optional().describe("HTML interno da página, sem <html>/<body>."),
    js: z.string().max(400000).optional().describe("JavaScript puro, sem a tag <script>."),
    origem: z.string().max(200).optional().describe("Quem alterou (ex: claude-mcp)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ css, body, js, origem }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    if (css === undefined && body === undefined && js === undefined) {
      return {
        content: [{ type: "text", text: "Nada enviado — informe css, body e/ou js." }],
        isError: true,
      };
    }

    const sb = supabaseForUser(ctx);
    const { data: cur, error: readErr } = await sb
      .from("hub_dados")
      .select("dados")
      .eq("id", 1)
      .maybeSingle();
    if (readErr) return { content: [{ type: "text", text: readErr.message }], isError: true };

    const prev = (cur?.dados ?? {}) as Record<string, unknown>;
    const prevApp = (prev["APP"] ?? {}) as App;

    if (cur) {
      await sb
        .from("hub_dados_hist")
        .insert({ dados: prev as never, origem: origem ?? "mcp" } as never);
    }

    const nextApp: App = {
      css: css ?? prevApp.css ?? "",
      body: body ?? prevApp.body ?? "",
      js: js ?? prevApp.js ?? "",
    };
    const next = { ...prev, APP: nextApp };

    const { error } = await sb.from("hub_dados").upsert(
      {
        id: 1,
        dados: next as never,
        origem: origem ?? "mcp",
        atualizado_em: new Date().toISOString(),
      } as never,
      { onConflict: "id" },
    );
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const resumo = {
      ok: true,
      css: nextApp.css?.length ?? 0,
      body: nextApp.body?.length ?? 0,
      js: nextApp.js?.length ?? 0,
      alterado: [
        css !== undefined && "css",
        body !== undefined && "body",
        js !== undefined && "js",
      ].filter(Boolean),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(resumo, null, 2) }],
      structuredContent: resumo,
    };
  },
});
