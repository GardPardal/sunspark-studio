import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "upsert_site_page",
  title: "Criar ou editar página do site",
  description:
    "Cria ou atualiza uma página do site público (CMS) pelo slug. Campos omitidos permanecem como estão quando a página já existe.",
  inputSchema: {
    slug: z.string().min(1).describe("Slug da página, ex: sobre"),
    title: z.string().min(1).optional(),
    subtitle: z.string().optional(),
    content: z.string().optional().describe("Conteúdo da página (markdown/HTML)."),
    published: z.boolean().optional(),
    seo: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Objeto de SEO (title, description...)"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ slug, title, subtitle, content, published, seo }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const sb = supabaseForUser(ctx);

    const { data: existing, error: readErr } = await sb
      .from("site_pages")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (readErr) return { content: [{ type: "text", text: readErr.message }], isError: true };

    if (!existing && !title)
      return {
        content: [{ type: "text", text: "Para criar uma página nova, informe o título." }],
        isError: true,
      };

    const payload = {
      slug,
      title: title ?? existing?.title ?? slug,
      subtitle: subtitle ?? existing?.subtitle ?? null,
      content: content ?? existing?.content ?? "",
      published: published ?? existing?.published ?? false,
      seo: (seo ?? existing?.seo ?? {}) as never,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await sb
      .from("site_pages")
      .upsert(payload as never, { onConflict: "slug" })
      .select("id, slug, title, published, updated_at")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { page: data },
    };
  },
});
