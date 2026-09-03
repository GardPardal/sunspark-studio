import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getResolvedAiModel } from "@/lib/ai-provider.server";
import { generateText, generateObject } from "ai";

export interface LizLearningItem {
  id: string;
  categoria: string;
  titulo: string;
  conteudo: string;
  contexto: string | null;
  tags: string[];
  usos: number;
  created_at: string;
}

export const listLizLearnings = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from("liz_aprendizados")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[listLizLearnings error]", error.message);
        return [] as LizLearningItem[];
      }
      return (data ?? []) as LizLearningItem[];
    } catch (e) {
      console.error("[listLizLearnings exception]", e);
      return [] as LizLearningItem[];
    }
  });

export const saveLizLearning = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        categoria: z.string().min(2),
        titulo: z.string().min(2).max(200),
        conteudo: z.string().min(3).max(3000),
        contexto: z.string().max(500).optional(),
        tags: z.array(z.string()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (data.id) {
      const { data: updated, error } = await supabaseAdmin
        .from("liz_aprendizados")
        .update({
          categoria: data.categoria,
          titulo: data.titulo,
          conteudo: data.conteudo,
          contexto: data.contexto ?? null,
          tags: data.tags ?? [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return { ok: true, item: updated as LizLearningItem };
    }

    const { data: created, error } = await supabaseAdmin
      .from("liz_aprendizados")
      .insert({
        categoria: data.categoria,
        titulo: data.titulo,
        conteudo: data.conteudo,
        contexto: data.contexto ?? "Manual SDR",
        tags: data.tags ?? [],
        origem: "treinamento_sdr",
        usos: 0,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { ok: true, item: created as LizLearningItem };
  });

export const deleteLizLearning = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("liz_aprendizados")
      .delete()
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

const LIZ_TRAINER_SYSTEM_PROMPT = `Você é a LIZ, a consultora de inteligência artificial da LZ7 Energia Solar.
Você está na SALA DE TREINAMENTO com a nossa SDR Stephany e liderança comercial da LZ7.

SEU OBJETIVO:
Aprender exatamente como falar, agir, tirar dúvidas técnicas e comerciais, contornar objeções e atender clientes de energia solar no WhatsApp.

COMO RESPONDER NESTA SALA:
1. Ouça a orientação ou correção com atenção e simpatia.
2. Demonstre claramente que entendeu a regra.
3. Mostre um EXEMPLO PRÁTICO de como você responderá no WhatsApp de agora em diante (em frases curtas, naturais e sem enrolação).
4. O sistema automaticamente vai salvar essa regra na sua memória para usar no WhatsApp em tempo real!`;

export const chatWithLizTraining = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          }),
        ),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const userMessages = data.messages;
    const latestUserMsg = userMessages[userMessages.length - 1]?.content || "";

    let replyText = "";
    let model: any = null;

    try {
      model = getResolvedAiModel();
      const aiResponse = await generateText({
        model,
        system: LIZ_TRAINER_SYSTEM_PROMPT,
        messages: userMessages,
      });
      replyText = aiResponse.text?.trim() || "";
    } catch (aiErr) {
      console.error("[LIZ Training Error]", aiErr);
      if (process.env.LOVABLE_API_KEY) {
        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: LIZ_TRAINER_SYSTEM_PROMPT },
                ...userMessages.map((m) => ({ role: m.role, content: m.content })),
              ],
            }),
          });
          if (res.ok) {
            const json = (await res.json()) as any;
            replyText = json.choices?.[0]?.message?.content?.trim() ?? "";
          }
        } catch (fErr) {
          console.error("[LIZ Training Fallback Error]", fErr);
        }
      }
    }

    if (!replyText) {
      replyText = "Entendido! Registrei essa orientação na minha memória para aplicar no WhatsApp.";
    }

    let savedLearning: LizLearningItem | null = null;
    try {
      if (model) {
        const extraction = await generateObject({
          model,
          schema: z.object({
            hasNewRuleOrGuideline: z
              .boolean()
              .describe("True se a mensagem do usuário ensina uma instrução, orientação, regra de resposta, objeção, dado regional ou dica de como agir"),
            categoria: z
              .enum(["argumento", "objecao", "dado_tecnico", "tarifa", "regiao", "dica_venda", "tom_de_voz", "geral"])
              .describe("Categoria da regra aprendida"),
            titulo: z.string().describe("Título curto e claro da regra (ex: Sem fiador no financiamento, Garantia de 25 anos, etc.)"),
            conteudo: z.string().describe("Como a LIZ deve agir ou responder exatamente quando esse tema surgir no WhatsApp"),
            tags: z.array(z.string()).describe("Palavras-chave relacionadas"),
          }),
          prompt: `Analise o diálogo de treinamento abaixo:
Usuário: "${latestUserMsg}"
LIZ: "${replyText}"

Identifique se houve um aprendizado, regra ou orientação para o atendimento de WhatsApp.`,
        });

        if (extraction.object.hasNewRuleOrGuideline && extraction.object.titulo && extraction.object.conteudo) {
          const { data: created, error } = await supabaseAdmin
            .from("liz_aprendizados")
            .insert({
              categoria: extraction.object.categoria,
              titulo: extraction.object.titulo.slice(0, 200),
              conteudo: extraction.object.conteudo.slice(0, 3000),
              tags: extraction.object.tags ?? [],
              origem: "treinamento_sdr",
              contexto: "Conversa de Treinamento SDR",
              usos: 0,
            })
            .select("*")
            .single();

          if (!error && created) {
            savedLearning = created as LizLearningItem;
          }
        }
      }
    } catch (extractErr) {
      console.warn("[Training auto-extract warning]", extractErr);
    }

    return {
      reply: replyText,
      savedLearning,
    };
  });