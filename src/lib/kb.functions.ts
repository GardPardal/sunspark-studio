import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listKbDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("kb_documents")
      .select("id, title, source_type, source_ref, tags, status, chunk_count, error, updated_at")
      .eq("org_id", data.orgId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveKbDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        orgId: z.string().uuid(),
        title: z.string().trim().min(2).max(200),
        content: z.string().trim().min(20).max(200_000),
        tags: z.array(z.string().trim().max(40)).max(15).default([]),
        sourceType: z.enum(["manual", "faq", "produto", "politica", "script"]).default("manual"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      org_id: data.orgId,
      title: data.title,
      content: data.content,
      tags: data.tags,
      source_type: data.sourceType,
      status: "pendente",
      error: null,
      created_by: context.userId,
    };

    const { data: row, error } = data.id
      ? await context.supabase
          .from("kb_documents")
          .update(payload)
          .eq("id", data.id)
          .select("id")
          .single()
      : await context.supabase.from("kb_documents").insert(payload).select("id").single();
    if (error) throw new Error(error.message);

    const { indexDocument } = await import("@/lib/kb.server");
    const result = await indexDocument(row.id);
    return { id: row.id, ...result };
  });

export const deleteKbDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kb_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reindexKbDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("kb_documents")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Documento não encontrado");
    const { indexDocument } = await import("@/lib/kb.server");
    return indexDocument(data.id);
  });

/** Teste de recuperação: mostra os trechos que a IA usaria para responder. */
export const testKbRetrieval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ orgId: z.string().uuid(), query: z.string().trim().min(3).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("org_members")
      .select("id")
      .eq("org_id", data.orgId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) throw new Error("Sem acesso a esta organização");

    const { searchKnowledge } = await import("@/lib/kb.server");
    const hits = await searchKnowledge(data.orgId, data.query, 6);

    const titles = new Map<string, string>();
    if (hits.length) {
      const { data: docs } = await context.supabase
        .from("kb_documents")
        .select("id, title")
        .in("id", [...new Set(hits.map((h) => h.document_id))]);
      for (const d of docs ?? []) titles.set(d.id, d.title);
    }
    return hits.map((h) => ({ ...h, title: titles.get(h.document_id) ?? "Documento" }));
  });
