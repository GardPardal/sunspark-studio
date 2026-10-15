/**
 * Leitura inteligente de uma conversa do WhatsApp para o formulário da SDR — SEM Z-API.
 *
 * A extensão "LZ7 · WhatsApp → Ploomes" lê as mensagens na tela do WhatsApp Web (cliente × atendente) e as
 * imagens que o cliente mandou, e o formulário chama esta análise. Devolve o que o CLIENTE disse (nome,
 * cidade, conta de luz, padrão, interesse), a filial certa (unidade mais próxima da cidade), o valor da
 * fatura lido na foto quando ele não falou o valor, e o código do clique da página-ponte ("cód. 7K2QX").
 * Nada é presumido: o que não foi dito volta null e a SDR completa.
 */
import { extractFromConversation } from "./liz-qualify.server";
import { baseMaisProxima, type BaseLZ7 } from "@/lib/geo/cobertura";
import { codigoNasMensagens } from "./clique-whatsapp.server";

export type MensagemTela = { de: "cliente" | "atendente"; texto: string };

export type LeituraConversa = {
  mensagens: number;
  nome: string | null;
  cidade: string | null;
  estado: string | null;
  valor_conta: number | null;
  valor_da_fatura: boolean;
  padrao_eletrico: string | null;
  segmento: string | null;
  interesse: string | null;
  enviou_fatura: boolean;
  base: BaseLZ7 | null;
  codigo_clique: string | null;
};

/** Valor total da fatura de energia lido na imagem (Gemini via gateway Lovable). null se não der para ler. */
async function valorDaFatura(imagem: string): Promise<number | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  'Esta imagem é uma fatura de energia elétrica (conta de luz)? Se for, devolva SOMENTE {"valor": <total a pagar em reais, número>}. ' +
                  'Se não for fatura ou não der para ler o total, devolva {"valor": null}. Sem comentários.',
              },
              { type: "image_url", image_url: { url: imagem } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as any;
    const txt = String(j.choices?.[0]?.message?.content ?? "");
    const m = /"valor"\s*:\s*([\d.]+)/.exec(txt);
    const v = m ? Number(m[1]) : NaN;
    return Number.isFinite(v) && v > 20 && v < 100000 ? Math.round(v * 100) / 100 : null;
  } catch {
    return null;
  }
}

export async function analisarConversa(
  mensagens: MensagemTela[],
  imagens: string[],
): Promise<LeituraConversa> {
  const msgs = mensagens
    .filter((m) => m.texto?.trim())
    .slice(-80)
    .map((m) => ({
      role: m.de === "cliente" ? "user" : "assistant",
      content: m.texto.slice(0, 2000),
    }));
  const ex = msgs.length ? await extractFromConversation(msgs) : null;

  let valor = ex?.valor_conta ?? null;
  let daFatura = false;
  // tenta as imagens do cliente, da mais recente para a mais antiga, até achar uma fatura
  if (valor == null) {
    for (const img of imagens.slice(-3).reverse()) {
      valor = await valorDaFatura(img);
      if (valor != null) {
        daFatura = true;
        break;
      }
    }
  }

  const cidade = ex?.cidade ?? null;
  const uf = ex?.estado && ex.estado !== "OUTRO" ? ex.estado : null;
  const noPR = cidade && !uf ? baseMaisProxima(cidade, "PR") : null;
  const noSP = cidade && !uf && !noPR ? baseMaisProxima(cidade, "SP") : null;
  const base = cidade ? (uf ? baseMaisProxima(cidade, uf) : (noPR ?? noSP)) : null;
  const ufFinal = uf ?? (noPR ? "PR" : noSP ? "SP" : null);

  return {
    mensagens: msgs.length,
    nome: ex?.nome ?? null,
    cidade,
    estado: ufFinal,
    valor_conta: valor,
    valor_da_fatura: daFatura,
    padrao_eletrico: ex?.padrao_eletrico ?? null,
    segmento: ex?.segmento ?? null,
    interesse: ex?.interesse ?? null,
    enviou_fatura: Boolean(ex?.enviou_fatura || imagens.length),
    base,
    codigo_clique: codigoNasMensagens(
      mensagens.filter((m) => m.de === "cliente").map((m) => m.texto),
    ),
  };
}
