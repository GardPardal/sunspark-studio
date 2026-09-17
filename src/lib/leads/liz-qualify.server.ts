/**
 * Extrai da conversa do WhatsApp APENAS o que o cliente disse, e alimenta a Central de Leads.
 * Nada é presumido: campo sem evidência = null.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { ingestLead, type PadraoEletrico, type Segmento } from "./lead-core.server";

export const extractionSchema = z.object({
  nome: z.string().nullable().describe("Nome que o próprio cliente informou. null se não disse."),
  cidade: z
    .string()
    .nullable()
    .describe("Cidade informada pelo cliente. null se não disse. Nunca deduzir pelo DDD."),
  estado: z
    .enum(["PR", "SP", "MG", "SC", "RS", "MS", "MT", "GO", "RJ", "ES", "BA", "DF", "OUTRO"])
    .nullable(),
  valor_conta: z
    .number()
    .nullable()
    .describe("Valor médio mensal da conta de energia em reais. null se não informou."),
  padrao_eletrico: z
    .enum(["monofasico", "bifasico", "trifasico"])
    .nullable()
    .describe("Só se o cliente disse explicitamente."),
  segmento: z.enum(["residencial", "comercial", "industrial", "rural"]).nullable(),
  email: z.string().nullable(),
  cpf_cnpj: z.string().nullable(),
  interesse: z
    .string()
    .nullable()
    .describe(
      "O que o cliente quer (ex.: energia solar residencial, aumento de sistema). null se não ficou claro.",
    ),
  enviou_fatura: z.boolean().describe("true se o cliente enviou foto/arquivo da conta de luz."),
  recusou_informar: z
    .boolean()
    .describe("true se o cliente se recusou a passar algum dado pedido."),
  pediu_humano: z.boolean(),
  sem_interesse: z
    .boolean()
    .describe("true se o cliente disse claramente que não quer / não tem interesse."),
  confianca: z.number().min(0).max(1),
});
export type Extraction = z.infer<typeof extractionSchema>;

const SYSTEM = `Você é um extrator de dados de atendimento comercial de energia solar.
Leia a conversa entre Cliente e Liz (assistente) e devolva SOMENTE um JSON com os campos pedidos.
REGRAS ABSOLUTAS:
- Só preencha um campo se o CLIENTE informou aquilo de forma explícita. Caso contrário use null.
- NUNCA deduza cidade pelo DDD, nunca chute valor de conta, nunca escolha tipo de ligação (monofásico/bifásico/trifásico) se o cliente não disse.
- Perguntas da Liz não contam como resposta. Só o que o cliente escreveu.
- valor_conta é número em reais (ex.: "uns 350" -> 350; "entre 300 e 400" -> 350; "R$ 1.200,00" -> 1200).
- nome: apenas se o cliente se apresentou ("sou o João", "meu nome é Maria"). Não use apelidos de perfil.
- Responda apenas o JSON, sem comentários.`;

function messagesToTranscript(msgs: Array<{ role: string; content: string }>) {
  return msgs.map((m) => `${m.role === "user" ? "Cliente" : "Liz"}: ${m.content}`).join("\n");
}

export async function extractFromConversation(
  msgs: Array<{ role: string; content: string }>,
): Promise<Extraction | null> {
  const transcript = messagesToTranscript(msgs).slice(-12000);
  const skeleton = {
    nome: null,
    cidade: null,
    estado: null,
    valor_conta: null,
    padrao_eletrico: null,
    segmento: null,
    email: null,
    cpf_cnpj: null,
    interesse: null,
    enviou_fatura: false,
    recusou_informar: false,
    pediu_humano: false,
    sem_interesse: false,
    confianca: 0,
  };
  const prompt = `CONVERSA:\n${transcript}\n\nFormato de saída (JSON): ${JSON.stringify(skeleton)}`;
  let text = "";
  // Gateway Lovable primeiro (sem cota diária); a chave Google direta é free-tier (20 req/dia) e fica como reserva.
  const viaGateway = async () => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return "";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      console.warn("[liz-qualify] gateway falhou", res.status, (await res.text()).slice(0, 200));
      return "";
    }
    const j = (await res.json()) as any;
    return String(j.choices?.[0]?.message?.content ?? "");
  };
  try {
    text = await viaGateway();
  } catch (e) {
    console.warn("[liz-qualify] gateway erro", e instanceof Error ? e.message : e);
  }
  if (!text) {
    try {
      const { getResolvedAiModel } = await import("@/lib/ai-provider.server");
      const { generateText } = await import("ai");
      const r = await generateText({
        model: getResolvedAiModel(),
        system: SYSTEM,
        prompt,
        temperature: 0,
        maxRetries: 1,
      });
      text = r.text ?? "";
    } catch (e) {
      console.warn("[liz-qualify] modelo reserva falhou", e instanceof Error ? e.message : e);
      return null;
    }
  }
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) {
    console.warn("[liz-qualify] resposta sem JSON:", text.slice(0, 200));
    return null;
  }
  try {
    const raw = JSON.parse(m[0]) as Record<string, unknown>;
    // Tolerância a variações do modelo (sem inventar dado): número em string, UF fora da lista, enum em caixa alta, "" => null.
    const str = (v: unknown) =>
      typeof v === "string" &&
      v.trim() &&
      !/^(null|não informado|nao informado|n\/a)$/i.test(v.trim())
        ? v.trim()
        : null;
    const num = (v: unknown) => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") {
        const n = Number(
          v
            .replace(/[^\d,.]/g, "")
            .replace(/\.(?=\d{3}(\D|$))/g, "")
            .replace(",", "."),
        );
        return Number.isFinite(n) && v.trim() ? n : null;
      }
      return null;
    };
    const bool = (v: unknown) => v === true || v === "true";
    const lower = (v: unknown) =>
      typeof v === "string"
        ? v
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
        : null;
    const uf = typeof raw.estado === "string" ? raw.estado.trim().toUpperCase() : null;
    const normalized = {
      nome: str(raw.nome),
      cidade: str(raw.cidade),
      estado:
        uf && ["PR", "SP", "MG", "SC", "RS", "MS", "MT", "GO", "RJ", "ES", "BA", "DF"].includes(uf)
          ? uf
          : uf
            ? "OUTRO"
            : null,
      valor_conta: num(raw.valor_conta),
      padrao_eletrico: ["monofasico", "bifasico", "trifasico"].includes(
        lower(raw.padrao_eletrico) ?? "",
      )
        ? lower(raw.padrao_eletrico)
        : null,
      segmento: ["residencial", "comercial", "industrial", "rural"].includes(
        lower(raw.segmento) ?? "",
      )
        ? lower(raw.segmento)
        : null,
      email: str(raw.email),
      cpf_cnpj: str(raw.cpf_cnpj),
      interesse: str(raw.interesse),
      enviou_fatura: bool(raw.enviou_fatura),
      recusou_informar: bool(raw.recusou_informar),
      pediu_humano: bool(raw.pediu_humano),
      sem_interesse: bool(raw.sem_interesse),
      confianca: Math.min(1, Math.max(0, num(raw.confianca) ?? 0)),
    };
    const parsed = extractionSchema.safeParse(normalized);
    if (!parsed.success)
      console.warn(
        "[liz-qualify] JSON fora do esquema:",
        parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; "),
      );
    return parsed.success ? parsed.data : null;
  } catch (e) {
    console.warn(
      "[liz-qualify] JSON inválido:",
      e instanceof Error ? e.message : e,
      text.slice(0, 200),
    );
    return null;
  }
}

/**
 * Chamado após cada turno da Liz (e pela reconciliação). Idempotente.
 */
export async function qualifyLeadFromConversation(args: {
  conversationId: string;
  contactId: string;
  phone: string;
  messages?: Array<{ role: string; content: string }>;
  source?: string;
}) {
  const { data: contact } = await supabaseAdmin
    .from("wa_contacts")
    .select("id, phone_e164, profile_name, lead_id")
    .eq("id", args.contactId)
    .maybeSingle();
  const phone = contact?.phone_e164 || args.phone;
  if (!phone) return { skipped: "sem telefone" as const };

  let msgs = args.messages;
  if (!msgs) {
    const { data } = await supabaseAdmin
      .from("wa_messages")
      .select("direction, body, msg_type, occurred_at")
      .eq("conversation_id", args.conversationId)
      .order("occurred_at", { ascending: true })
      .limit(80);
    msgs = (data ?? [])
      .map((m: any) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: String(
          m.body || (m.msg_type && m.msg_type !== "text" ? `[${m.msg_type}]` : ""),
        ).trim(),
      }))
      .filter((t) => t.content);
  }
  const hasInbound = msgs.some((m) => m.role === "user");
  if (!hasInbound) return { skipped: "sem mensagem do cliente" as const };

  const ex = await extractFromConversation(msgs);
  if (!ex) return { skipped: "extração falhou" as const };

  // Fatura anexada: procura mídia recebida (imagem/documento) na conversa
  let faturaUrl: string | null = null;
  if (ex.enviou_fatura) {
    const { data: media } = await supabaseAdmin
      .from("wa_messages")
      .select("media_url, msg_type")
      .eq("conversation_id", args.conversationId)
      .eq("direction", "inbound")
      .in("msg_type", ["image", "document"])
      .order("occurred_at", { ascending: false })
      .limit(1);
    faturaUrl = (media?.[0] as any)?.media_url ?? null;
  }

  // Origem original: se o contato já estava vinculado a um lead (ex.: Meta Ads), a ingestão preserva a origem existente.
  const { data: conv } = await supabaseAdmin
    .from("wa_conversations")
    .select("status")
    .eq("id", args.conversationId)
    .maybeSingle();
  const humano =
    ex.pediu_humano ||
    ["humano", "humano_assumiu", "humano_bloqueado"].includes(String(conv?.status));

  const result = await ingestLead(
    {
      telefone: phone,
      nome: ex.nome,
      cidade: ex.cidade,
      estado: ex.estado && ex.estado !== "OUTRO" ? ex.estado : null,
      valor_conta: ex.valor_conta,
      padrao_eletrico: (ex.padrao_eletrico as PadraoEletrico | null) ?? null,
      segmento: (ex.segmento as Segmento | null) ?? null,
      email: ex.email,
      cpf_cnpj: ex.cpf_cnpj,
      produto_interesse: ex.interesse,
      fatura_url: faturaUrl,
      origem_principal: "WhatsApp",
      origem: "whatsapp_organico",
      canal: "WhatsApp",
      qualificado_por: "liz",
      sistema_entrada: "zapi",
      wa_contact_id: args.contactId,
      wa_conversation_id: args.conversationId,
    },
    {
      syncPolicy: "when_qualified",
      source: args.source ?? "liz",
      signals: {
        recusou: ex.recusou_informar,
        humano,
        semInteresse: ex.sem_interesse,
        interesse: ex.interesse,
      },
    },
  );

  return { ...result, extraction: ex };
}
