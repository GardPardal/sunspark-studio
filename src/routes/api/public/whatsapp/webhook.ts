import { createFileRoute } from "@tanstack/react-router";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { LIZ_CAPTURE_PROMPT } from "@/lib/liz-prompt";
import { sendWhatsAppText, verifyMetaSignature } from "@/lib/whatsapp.server";
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
        const expected = process.env.WHATSAPP_VERIFY_TOKEN;
        if (mode === "subscribe" && token && expected && token === expected) {
          return new Response(challenge ?? "", { status: 200 });
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

        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        // Responde 200 sempre pra não gerar retry — processa async
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

async function processIncoming(payload: unknown) {
  const body = payload as { entry?: WaEntry[] };
  const entries = body.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages ?? [];
      const contact = change.value?.contacts?.[0];
      const waName = contact?.profile?.name;
      for (const msg of messages) {
        if (msg.type !== "text" || !msg.text?.body || !msg.from) continue;
        await handleUserMessage(msg.from, msg.text.body, waName);
      }
    }
  }
}

async function handleUserMessage(waPhone: string, text: string, waName?: string) {
  const key = process.env.LOVABLE_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSrv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !supabaseUrl || !supabaseSrv) {
    console.error("[wa] envs faltando");
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
      "Registra lead qualificado no CRM. Chame APENAS com nome, telefone WhatsApp, cidade e valor da conta.",
    inputSchema: z.object({
      nome: z.string(),
      telefone: z.string(),
      cidade: z.string(),
      estado: z.string().optional(),
      valor_conta: z.string(),
      tipo_imovel: z.string().optional(),
      tipo_telhado: z.string().optional(),
      decisor: z.string().optional(),
      observacoes: z.string().optional(),
    }),
    execute: async (input) => {
      const mensagem = [
        input.tipo_imovel ? `Imóvel: ${input.tipo_imovel}` : null,
        input.tipo_telhado ? `Telhado: ${input.tipo_telhado}` : null,
        input.decisor ? `Decisor: ${input.decisor}` : null,
        input.observacoes ? `Obs: ${input.observacoes}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const { data, error } = await supabase
        .from("leads")
        .insert({
          nome: input.nome.slice(0, 200),
          telefone: (input.telefone || waPhone).slice(0, 30),
          cidade: input.cidade?.slice(0, 120) ?? null,
          estado: input.estado?.slice(0, 60) ?? null,
          valor_conta: input.valor_conta?.slice(0, 60) ?? null,
          mensagem: mensagem || `Lead via WhatsApp (${waPhone})`,
          origem: "liz_whatsapp",
          utm_source: "whatsapp",
        })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      qualifiedLeadId = data.id;
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

  const gateway = createLovableAiGatewayProvider(key);
  let replyText = "";
  try {
    const result = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
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
      messages: finalHistory as unknown as Database["public"]["Tables"]["whatsapp_conversations"]["Row"]["messages"],
      qualified: qualifiedLeadId !== null || (existing?.qualified ?? false),
      lead_id: qualifiedLeadId ?? undefined,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wa_phone" },
  );

  try {
    await sendWhatsAppText(waPhone, replyText);
  } catch (e) {
    console.error("[wa send]", e);
  }
}
