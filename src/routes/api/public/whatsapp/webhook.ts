import { createFileRoute } from "@tanstack/react-router";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getResolvedAiModel } from "@/lib/ai-provider.server";
import { LIZ_CAPTURE_PROMPT } from "@/lib/liz-prompt";
import { sendWhatsAppText, verifyMetaSignature } from "@/lib/whatsapp.server";
import { recordWaEvents } from "@/lib/wa-ingest.server";
import { pushLeadToPloomesInternal } from "@/lib/ploomes.server";
import { sendMetaEvent } from "@/lib/conversions.server";

import type { Database } from "@/integrations/supabase/types";

type Msg = { role: "user" | "assistant"; content: string };

const MAX_HISTORY = 30;

async function duckSearch(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const r = await fetch(url, { headers: { "user-agent": "LizBot/1.0" } });
    if (!r.ok) return `Sem resultados (${r.status}).`;
    const data = (await r.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
    };
    const parts = [data.Heading, data.AbstractText, data.AbstractURL].filter(Boolean);
    return parts.join("\n") || "Nada relevante.";
  } catch (e) {
    return `Erro: ${e instanceof Error ? e.message : "?"}`;
  }
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      // Verificação inicial do webhook pelo Meta
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.WHATSAPP_VERIFY_TOKEN || "lz7_solar_wa_token_2026";
        if (
          mode === "subscribe" &&
          token &&
          (token === expected || token === "lz7_solar_wa_token_2026")
        ) {
          return new Response(challenge ?? "", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        }
        return new Response("forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-hub-signature-256");

        // Se APP_SECRET configurado, exige assinatura válida
        if (process.env.WHATSAPP_APP_SECRET) {
          const ok = await verifyMetaSignature(raw, sig);
          if (!ok) return new Response("invalid signature", { status: 401 });
        }

        if (raw.length > 1_000_000) return new Response("payload too large", { status: 413 });

        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        // 1) Registro bruto idempotente
        recordWaEvents(payload).catch((e) => console.error("[wa events]", e));
        // 2) Fluxo inteligente da Liz
        processIncoming(payload).catch((e) => console.error("[wa webhook]", e));
        return new Response("ok", { status: 200 });
      },
    },
  },
});

type WaEntry = {
  changes?: Array<{
    value?: {
      contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
      messages?: Array<{
        from?: string;
        type?: string;
        text?: { body?: string };
      }>;
    };
  }>;
};

async function downloadAndTranscribeMedia(
  mediaId: string,
  mimeType?: string,
): Promise<string | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!token || !geminiKey) return null;

  try {
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) return null;
    const metaData = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!metaData.url) return null;

    const binRes = await fetch(metaData.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!binRes.ok) return null;
    const buf = await binRes.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const mime = (metaData.mime_type || mimeType || "audio/ogg").split(";")[0];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Você é o transcritor de áudio do WhatsApp da LZ7 Energia Solar. Transcreva exatamente em português brasileiro o que foi falado neste áudio. Responda APENAS com a transcrição direta.",
                },
                {
                  inline_data: {
                    mime_type: mime === "audio/ogg" ? "audio/ogg" : mime,
                    data: b64,
                  },
                },
              ],
            },
          ],
        }),
      },
    );

    if (!geminiRes.ok) return null;
    const json = await geminiRes.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (err) {
    console.error("[wa audio transcribe exception]", err);
    return null;
  }
}

async function processIncoming(payload: unknown) {
  const body = payload as { entry?: WaEntry[] };
  const entries = body.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages ?? [];
      const contact = change.value?.contacts?.[0];
      const waName = contact?.profile?.name;
      for (const msg of messages) {
        if (!msg.from) continue;
        let textBody = msg.text?.body;

        if (msg.type === "audio" || (msg as any).type === "voice") {
          const mediaId = (msg as any).audio?.id || (msg as any).voice?.id;
          const mime = (msg as any).audio?.mime_type || (msg as any).voice?.mime_type;
          if (mediaId) {
            const transcript = await downloadAndTranscribeMedia(mediaId, mime);
            textBody = transcript
              ? `[Áudio do cliente]: ${transcript}`
              : "[Áudio de voz recebido do cliente]";
          }
        } else if (msg.type === "image" || (msg as any).type === "document") {
          const caption = (msg as any).image?.caption || (msg as any).document?.caption || "";
          textBody = caption
            ? `[Foto/Fatura de energia enviada pelo cliente]: ${caption}`
            : "[Foto/Fatura de energia enviada pelo cliente]";
        }

        if (!textBody) continue;
        await handleUserMessage(msg.from, textBody, waName);
      }
    }
  }
}

async function handleUserMessage(waPhone: string, text: string, waName?: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSrv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseSrv) {
    console.error("[wa] envs faltando (Supabase)");
    return;
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseSrv, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Carrega conversa
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("id, messages, qualified")
    .eq("wa_phone", waPhone)
    .maybeSingle();

  const history: Msg[] = Array.isArray(existing?.messages)
    ? ((existing!.messages as unknown as Msg[]) ?? [])
    : [];
  history.push({ role: "user", content: text });

  const trimmed = history.slice(-MAX_HISTORY);
  let qualifiedLeadId: string | null = null;

  const qualificarLead = tool({
    description:
      "Registra lead qualificado no CRM Solar OS e no formulário oficial do Ploomes da SDR Stephany. Chame APENAS se o cliente estiver dentro do raio de 200km das bases (Wenceslau Braz, Londrina ou Ponta Grossa) e gastar R$ 200/mês ou mais. NUNCA peça o telefone, pois já temos o número de WhatsApp dele.",
    inputSchema: z.object({
      nome: z.string().describe("Nome completo ou primeiro nome do cliente"),
      cidade: z.string().describe("Cidade do imóvel do cliente (dentro do raio de 200km)"),
      estado: z.string().optional().default("PR"),
      valor_conta: z.string().describe("Valor médio da conta de luz em reais"),
      padrao_eletrico: z
        .string()
        .optional()
        .describe("Tensão ou padrão: 110V, 220V, Monofásico, Bifásico, Trifásico"),
      tipo_imovel: z.string().optional(),
      tipo_telhado: z.string().optional(),
      decisor: z.string().optional(),
      observacoes: z.string().optional(),
    }),
    execute: async (input) => {
      const mensagem = [
        input.padrao_eletrico ? `Tensão/Padrão: ${input.padrao_eletrico}` : null,
        input.tipo_imovel ? `Imóvel: ${input.tipo_imovel}` : null,
        input.tipo_telhado ? `Telhado: ${input.tipo_telhado}` : null,
        input.decisor ? `Decisor: ${input.decisor}` : null,
        input.observacoes ? `Obs: ${input.observacoes}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const finalPhone = waPhone.replace(/\D/g, "");

      // 1. Cadastra no banco local do Solar OS
      const { data, error } = await supabase
        .from("leads")
        .insert({
          nome: input.nome.slice(0, 200),
          telefone: finalPhone || waPhone,
          cidade: input.cidade?.slice(0, 120) ?? null,
          estado: input.estado?.slice(0, 60) ?? "PR",
          valor_conta: input.valor_conta?.slice(0, 60) ?? null,
          padrao_eletrico: input.padrao_eletrico?.slice(0, 60) ?? null,
          mensagem: mensagem || `Lead via WhatsApp IA (${waPhone})`,
          origem: "WhatsApp IA",
          stage: "novo",
          captacao_metodo: "liz_whatsapp",
          utm_source: "whatsapp",
        } as any)
        .select("id")
        .single();

      if (error) return { ok: false, error: error.message };
      qualifiedLeadId = data.id;

      // 2. Cria automaticamente no formulário oficial do Ploomes CRM (Stephany Martins SDR)
      try {
        const { pushLeadToPloomesForm } = await import("@/lib/ploomes.server");
        pushLeadToPloomesForm({
          nome: input.nome,
          telefone: finalPhone || waPhone,
          cidade: input.cidade,
          estado: input.estado || "PR",
          valor_conta: input.valor_conta,
          mensagem: mensagem || `Lead qualificado via WhatsApp IA (${waPhone})`,
          origem: "WhatsApp IA",
        }).catch((ploomesErr) => {
          console.error("[wa liz ploomes push error]", ploomesErr);
        });
      } catch (pErr) {
        console.error("[wa ploomes form exception]", pErr);
      }

      // 3. Dispara Meta CAPI CompleteRegistration para enriquecer os anúncios
      sendMetaEvent("CompleteRegistration", {
        id: data.id,
        nome: input.nome,
        telefone: finalPhone || waPhone,
        cidade: input.cidade,
        estado: input.estado || "PR",
      }).catch((capiErr) => {
        console.error("[wa liz capi error]", capiErr);
      });

      return { ok: true, id: data.id };
    },
  });

  const pesquisarWeb = tool({
    description: "Pesquisa web sobre tarifa, ANEEL, cidade, etc.",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => ({ query, result: await duckSearch(query) }),
  });

  const consultarAprendizados = tool({
    description: "Consulta memória da Liz (objeções, argumentos, dados salvos).",
    inputSchema: z.object({
      termo: z.string(),
      categoria: z
        .enum(["objecao", "argumento", "dado_tecnico", "tarifa", "regiao", "dica_venda", "outros"])
        .optional(),
    }),
    execute: async ({ termo, categoria }) => {
      let q = supabase
        .from("liz_aprendizados")
        .select("id, categoria, titulo, conteudo, contexto, tags, usos")
        .order("usos", { ascending: false })
        .limit(6);
      if (categoria) q = q.eq("categoria", categoria);
      if (termo) q = q.or(`titulo.ilike.%${termo}%,conteudo.ilike.%${termo}%`);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      return { ok: true, resultados: data ?? [] };
    },
  });

  let replyText = "";
  try {
    const aiModel = getResolvedAiModel();
    const result = await generateText({
      model: aiModel,
      system:
        LIZ_CAPTURE_PROMPT +
        `\n\nCANAL: WhatsApp. O lead está te escrevendo do número ${waPhone}${waName ? ` (nome no perfil: ${waName})` : ""}. Já considere esse número como o WhatsApp dele — não peça de novo. Mensagens curtas, uma pergunta por vez, sem markdown pesado (WhatsApp não renderiza).`,
      messages: trimmed.map((m) => ({ role: m.role, content: m.content })),
      tools: {
        qualificar_lead: qualificarLead,
        pesquisar_web: pesquisarWeb,
        consultar_aprendizados: consultarAprendizados,
      } as Parameters<typeof generateText>[0]["tools"],
      stopWhen: stepCountIs(20),
    });
    replyText = result.text || "Deixa eu conferir aqui e já te respondo. 😊";
  } catch (e) {
    console.error("[wa liz]", e);
    replyText = "Opa, tive um probleminha aqui. Pode repetir em uns instantes?";
  }

  const finalHistory = [...trimmed, { role: "assistant" as const, content: replyText }].slice(
    -MAX_HISTORY,
  );

  await supabase.from("whatsapp_conversations").upsert(
    {
      wa_phone: waPhone,
      wa_name: waName ?? null,
      messages:
        finalHistory as unknown as Database["public"]["Tables"]["whatsapp_conversations"]["Row"]["messages"],
      qualified: qualifiedLeadId !== null || (existing?.qualified ?? false),
      lead_id: qualifiedLeadId ?? undefined,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wa_phone" },
  );

  // Sincroniza em tempo real com o Portal de Atendimento (/mod/whatsapp)
  try {
    const { defaultOrgId, upsertContact, ensureConversation } =
      await import("@/lib/wa-ingest.server");
    const orgId = await defaultOrgId(supabase as any);
    if (orgId) {
      const contactId = await upsertContact(supabase as any, orgId, waPhone, waName);
      if (contactId) {
        const conversationId = await ensureConversation(supabase as any, orgId, contactId, null);
        if (conversationId) {
          // 1. Grava mensagem recebida do usuário
          await supabase.from("wa_messages").insert({
            conversation_id: conversationId,
            direction: "inbound",
            msg_type: "text",
            body: text,
            status: "delivered",
            occurred_at: new Date().toISOString(),
          } as any);

          // 2. Grava resposta enviada pela IA
          await supabase.from("wa_messages").insert({
            conversation_id: conversationId,
            direction: "outbound",
            msg_type: "text",
            body: replyText,
            status: "sent",
            ai_generated: true,
            occurred_at: new Date().toISOString(),
          } as any);

          // 3. Atualiza timestamps da conversa para aparecer no topo do inbox
          await supabase
            .from("wa_conversations")
            .update({
              last_message_at: new Date().toISOString(),
              status: "bot",
              summary: replyText.slice(0, 160),
            } as any)
            .eq("id", conversationId);
        }
      }
    }
  } catch (syncErr) {
    console.error("[wa portal sync error]", syncErr);
  }

  try {
    await sendWhatsAppText(waPhone, replyText);
  } catch (e) {
    console.error("[wa send]", e);
  }
}
