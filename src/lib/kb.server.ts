// Base de conhecimento: chunking, embeddings e recuperação (server-only).

import { waAdminClient } from "@/lib/wa.server";

const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const MAX_BATCH = 64;
const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 150;

export function chunkText(text: string): string[] {
  const clean = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let buf = "";

  const push = () => {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = "";
  };

  for (const p of paragraphs) {
    if (p.length > CHUNK_CHARS) {
      push();
      for (let i = 0; i < p.length; i += CHUNK_CHARS - CHUNK_OVERLAP) {
        chunks.push(p.slice(i, i + CHUNK_CHARS).trim());
      }
      continue;
    }
    if ((buf + "\n\n" + p).length > CHUNK_CHARS) push();
    buf = buf ? `${buf}\n\n${p}` : p;
  }
  push();
  return chunks.filter(Boolean);
}

/** Gera embeddings respeitando o limite de lote do provedor. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH);
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
    });
    if (!res.ok) {
      throw new Error(`embeddings [${res.status}]: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ index: number; embedding: number[] }>;
    };
    const sorted = (json.data ?? []).sort((a, b) => a.index - b.index);
    for (const d of sorted) out.push(d.embedding);
  }
  return out;
}

/** Indexa (ou reindexa) um documento inteiro. */
export async function indexDocument(documentId: string) {
  const supabase = waAdminClient();
  const { data: doc, error } = await supabase
    .from("kb_documents")
    .select("id, org_id, title, content")
    .eq("id", documentId)
    .maybeSingle();
  if (error || !doc) throw new Error(error?.message ?? "Documento não encontrado");

  await supabase.from("kb_documents").update({ status: "indexando", error: null }).eq("id", doc.id);
  await supabase.from("kb_chunks").delete().eq("document_id", doc.id);

  try {
    const chunks = chunkText(`${doc.title}\n\n${doc.content}`);
    if (!chunks.length) throw new Error("Documento vazio");

    const vectors = await embedTexts(chunks);
    const rows = chunks.map((content, idx) => ({
      org_id: doc.org_id,
      document_id: doc.id,
      chunk_index: idx,
      content,
      token_estimate: Math.ceil(content.length / 4),
      embedding: JSON.stringify(vectors[idx]),
      model_version: EMBED_MODEL,
    }));

    for (let i = 0; i < rows.length; i += 100) {
      const { error: insErr } = await supabase.from("kb_chunks").insert(rows.slice(i, i + 100));
      if (insErr) throw new Error(insErr.message);
    }

    await supabase
      .from("kb_documents")
      .update({ status: "indexado", chunk_count: chunks.length, error: null })
      .eq("id", doc.id);
    return { ok: true as const, chunks: chunks.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("kb_documents").update({ status: "erro", error: message }).eq("id", doc.id);
    throw new Error(message);
  }
}

export type KbHit = { id: string; document_id: string; content: string; similarity: number };

/** Busca semântica restrita à organização. */
export async function searchKnowledge(
  orgId: string,
  query: string,
  matchCount = 6,
): Promise<KbHit[]> {
  if (!query.trim()) return [];
  const supabase = waAdminClient();
  const [vector] = await embedTexts([query.slice(0, 4000)]);
  if (!vector) return [];

  const { data, error } = await supabase.rpc("match_kb_chunks", {
    _org_id: orgId,
    _query_embedding: JSON.stringify(vector),
    _match_count: matchCount,
  });
  if (error) {
    console.error("[kb search]", error.message);
    return [];
  }
  return (data ?? []) as KbHit[];
}
