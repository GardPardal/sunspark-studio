/**
 * Cliques da página-ponte do anúncio de WhatsApp (/whatsapp), gravados por /api/public/wa-clique em
 * lead_events (event "wa.clique", step = código de 5 caracteres que vai na 1ª mensagem do cliente).
 */
/** Clique da página-ponte pelo código (até 14 dias). Usado no cadastro da SDR. */
export async function cliquePeloCodigo(codigo: string): Promise<Record<string, any> | null> {
  const c = codigo.trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(c)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const desde = new Date(Date.now() - 14 * 86400_000).toISOString();
  const { data } = await (supabaseAdmin as any)
    .from("lead_events")
    .select("id, detail, created_at, lead_id")
    .eq("event", "wa.clique")
    .eq("step", c)
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

/** Acha o código "(cód. ABC12)" nas mensagens do cliente; o mais recente vale. */
export function codigoNasMensagens(textos: string[]): string | null {
  for (let i = textos.length - 1; i >= 0; i--) {
    const m = /c[oó]d(?:igo)?\.?\s*:?\s*([A-Z0-9]{5})\b/i.exec(textos[i] ?? "");
    if (m) return m[1].toUpperCase();
  }
  return null;
}
