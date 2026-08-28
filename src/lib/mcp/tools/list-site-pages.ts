import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_site_pages",
  title: "Listar páginas do site",
  description:
    "Lista as páginas editáveis do site público (CMS): slug, título, se está publicada e data de atualização.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de páginas (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("site_pages")
      .select("id, slug, title, subtitle, published, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { pages: data ?? [] },
    };
  },
});
