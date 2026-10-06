/**
 * Atribuição de leads que chegam pelo WhatsApp a partir de anúncios (Click-to-WhatsApp).
 *
 * Quando alguém clica num anúncio de WhatsApp, a 1ª mensagem chega pela Z-API com `externalAdReply`
 * ({ sourceType: "ad", sourceId: <ID do anúncio>, ctwaClid, title, body, sourceUrl }). O webhook inteiro
 * já fica gravado em `wa_events.payload`, então basta procurar pelo telefone — vale também para
 * conversas antigas (histórico).
 *
 * Com o ID do anúncio, a Graph API devolve campanha, conjunto e anúncio: o lead vai ao Ploomes com a
 * origem exata (e não mais o "Meta WhatsApp" padrão do formulário da SDR para todo mundo).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AtribuicaoWhatsApp = {
  ad_id: string;
  ctwa_clid: string | null;
  titulo: string | null;
  texto: string | null;
  url: string | null;
  em: string | null;
  campanha: string | null;
  campanha_id: string | null;
  conjunto: string | null;
  conjunto_id: string | null;
  anuncio: string | null;
  conta_id: string | null;
};

const JANELA_DIAS = 60;
const cacheAnuncio = new Map<string, Promise<Partial<AtribuicaoWhatsApp>>>();

/** Variantes do telefone como a Z-API costuma mandar (com e sem o 9 depois do DDD). */
function variantes(e164: string): string[] {
  const d = e164.replace(/\D/g, "");
  const out = new Set([d]);
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") out.add(d.slice(0, 4) + d.slice(5));
  if (d.startsWith("55") && d.length === 12) out.add(d.slice(0, 4) + "9" + d.slice(4));
  return [...out];
}

async function nomesDoAnuncio(adId: string): Promise<Partial<AtribuicaoWhatsApp>> {
  if (!cacheAnuncio.has(adId)) {
    cacheAnuncio.set(
      adId,
      (async () => {
        const token = process.env.META_SYSTEM_USER_TOKEN || process.env.META_CAPI_ACCESS_TOKEN;
        if (!token) return {};
        const url =
          `https://graph.facebook.com/v21.0/${encodeURIComponent(adId)}` +
          `?fields=name,account_id,adset{id,name},campaign{id,name}&access_token=${encodeURIComponent(token)}`;
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) return {};
          const j: any = await r.json();
          return {
            anuncio: j?.name ?? null,
            conjunto: j?.adset?.name ?? null,
            conjunto_id: j?.adset?.id ?? null,
            campanha: j?.campaign?.name ?? null,
            campanha_id: j?.campaign?.id ?? null,
            conta_id: j?.account_id ?? null,
          };
        } catch {
          return {};
        }
      })(),
    );
  }
  return cacheAnuncio.get(adId)!;
}

/**
 * Último anúncio de WhatsApp que trouxe este telefone (até 60 dias). `null` = chegou sem anúncio
 * (orgânico, indicação, etc.).
 */
export async function atribuicaoWhatsApp(
  e164: string | null | undefined,
): Promise<AtribuicaoWhatsApp | null> {
  if (!e164) return null;
  const desde = new Date(Date.now() - JANELA_DIAS * 86400_000).toISOString();
  const tels = variantes(e164);
  const { data, error } = await (supabaseAdmin as any)
    .from("wa_events")
    .select("payload, received_at")
    .in("payload->>phone", tels)
    .not("payload->externalAdReply->>sourceId", "is", null)
    .gte("received_at", desde)
    .order("received_at", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  const ad = data[0].payload?.externalAdReply ?? {};
  const adId = String(ad.sourceId ?? "").trim();
  if (!adId) return null;
  const nomes = await nomesDoAnuncio(adId);
  return {
    ad_id: adId,
    ctwa_clid: ad.ctwaClid ?? null,
    titulo: ad.title ?? null,
    texto: ad.body ?? null,
    url: ad.sourceUrl ?? null,
    em: data[0].received_at ?? null,
    campanha: nomes.campanha ?? null,
    campanha_id: nomes.campanha_id ?? null,
    conjunto: nomes.conjunto ?? null,
    conjunto_id: nomes.conjunto_id ?? null,
    anuncio: nomes.anuncio ?? null,
    conta_id: nomes.conta_id ?? null,
  };
}

/** Produto pelo nome da campanha (só sugere; não sobrescreve escolha da SDR). */
export function produtoPelaCampanha(campanha: string | null | undefined): string | null {
  const c = (campanha ?? "").toLowerCase();
  if (/h[ií]brid|bateria/.test(c)) return "Sistema híbrido";
  if (/mob|mobilidade|el[eé]tric[oa]s?\b.*ve[ií]cul|scooter/.test(c)) return "Mobilidade elétrica";
  if (/eletroposto|recarga/.test(c)) return "Eletroposto";
  if (/energia|solar/.test(c)) return "Energia solar";
  return null;
}

/**
 * Campos de atribuição para gravar no lead quando ele chegou por anúncio de WhatsApp.
 * Não mexe em lead que já tem UTM (site/quiz): esses já sabem a origem pelo link.
 */
export async function camposDeAtribuicao(
  input: Record<string, any>,
  e164: string,
): Promise<{
  campos: Record<string, unknown>;
  atribuicao: AtribuicaoWhatsApp | null;
}> {
  if (input.utm_source || input.utm_campaign || input.fbclid || input.meta_lead_id)
    return { campos: {}, atribuicao: null };
  const at = await atribuicaoWhatsApp(e164);
  if (!at) {
    // Sem anúncio: o "Meta WhatsApp" padrão do formulário da SDR deixa de marcar orgânico como tráfego pago.
    const origem = String(input.origem_principal ?? input.origem ?? "");
    if (/^meta whatsapp$/i.test(origem.trim()) && /whats/i.test(String(input.canal ?? "whatsapp")))
      return {
        campos: { origem: "WhatsApp (sem anúncio)", origem_principal: "WhatsApp" },
        atribuicao: null,
      };
    return { campos: {}, atribuicao: null };
  }
  const campos: Record<string, unknown> = {
    utm_source: "meta",
    utm_medium: "whatsapp_ads",
    utm_campaign: at.campanha ?? `ad_${at.ad_id}`,
    utm_term: at.conjunto ?? undefined,
    utm_content: at.anuncio ?? at.ad_id,
    campanha: at.campanha ?? undefined,
    conjunto_anuncio: at.conjunto ?? undefined,
    anuncio: at.anuncio ? `${at.anuncio} [${at.ad_id}]` : at.ad_id,
    origem_principal: "Meta ADS",
  };
  const produto = produtoPelaCampanha(at.campanha);
  if (produto && !input.produto_interesse) campos.produto_interesse = produto;
  for (const k of Object.keys(campos)) if (campos[k] === undefined) delete campos[k];
  return { campos, atribuicao: at };
}
