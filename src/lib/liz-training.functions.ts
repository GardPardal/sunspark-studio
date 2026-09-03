import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getResolvedAiModel } from "@/lib/ai-provider.server";
import { generateText } from "ai";

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
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("liz_aprendizados")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[listLizLearnings error]", error.message);
      return [] as LizLearningItem[];
    }
    return (data ?? []) as LizLearningItem[];
  });

export const saveLizLearning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
        contexto: data.contexto ?? null,
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
  .middleware([requireSupabaseAuth])
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
1. Ouça a orientação ou correção com atenção e humildade.
2. Seja simpática, profissional e mostre que entendeu a regra.
3. Mostre um EXEMPLO PRÁTICO de como você responderá no WhatsApp de agora em diante (em frases curtas, naturais e diretas).
4. O sistema automaticamente vai salvar essa regra na sua memória para usar no WhatsApp em tempo real!`;

export const chatWithLizTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

    const model = getResolvedAiModel();

    let replyText = "";
    try {
      const aiResponse = await generateText({
        model,
        system: LIZ_TRAINER_SYSTEM_PROMPT,
        messages: userMessages,
      });
      replyText = aiResponse.text?.trim() || "";
    } catch (aiErr) {
      console.error("[chatWithLizTraining IA erro]", aiErr);
    }
    if (!replyText) {
      replyText =
        "Anotei a orientação e já gravei na minha memória. (Não consegui gerar a resposta completa agora, mas o aprendizado está salvo.)";
    }

    // Extração da regra em JSON via texto (mais estável que structured output nos modelos atuais)
    let savedLearning: LizLearningItem | null = null;
    let extracted: {
      aprendeu: boolean;
      categoria: string;
      titulo: string;
      conteudo: string;
      tags: string[];
    } | null = null;

    try {
      const raw = await generateText({
        model,
        prompt: `Você extrai regras de treinamento da IA LIZ (LZ7 Energia Solar).
Responda SOMENTE com um JSON válido, sem markdown, no formato:
{"aprendeu":true|false,"categoria":"argumento|objecao|dado_tecnico|tarifa|regiao|dica_venda|tom_de_voz|geral","titulo":"...","conteudo":"...","tags":["..."]}

"aprendeu" = true quando a mensagem da SDR ensina uma regra, argumento, objeção, dado técnico, condição comercial, informação regional ou tom de voz que a LIZ deve usar no WhatsApp.
"conteudo" = como a LIZ deve agir/responder exatamente quando esse tema surgir.

Mensagem da SDR: "${latestUserMsg}"
Resposta da LIZ: "${replyText}"`,
      });

      const jsonText = (raw.text ?? "").replace(/```json|```/g, "").trim();
      const start = jsonText.indexOf("{");
      const end = jsonText.lastIndexOf("}");
      if (start >= 0 && end > start) {
        const parsed = JSON.parse(jsonText.slice(start, end + 1));
        extracted = {
          aprendeu: Boolean(parsed.aprendeu),
          categoria: String(parsed.categoria || "geral"),
          titulo: String(parsed.titulo || "").trim(),
          conteudo: String(parsed.conteudo || "").trim(),
          tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
        };
      }
    } catch (extractErr) {
      console.error("[chatWithLizTraining extração erro]", extractErr);
    }

    // Fallback: nunca perder o que a SDR ensinou — grava a orientação bruta.
    const isInstruction = latestUserMsg.trim().length >= 12;
    const toSave =
      extracted && extracted.aprendeu && extracted.titulo && extracted.conteudo
        ? extracted
        : isInstruction
          ? {
              categoria: "geral",
              titulo: latestUserMsg.trim().slice(0, 80),
              conteudo: latestUserMsg.trim(),
              tags: [] as string[],
            }
          : null;

    if (toSave) {
      const { data: created, error } = await supabaseAdmin
        .from("liz_aprendizados")
        .insert({
          categoria: toSave.categoria,
          titulo: toSave.titulo.slice(0, 200),
          conteudo: toSave.conteudo.slice(0, 3000),
          tags: toSave.tags ?? [],
          origem: "treinamento_sdr",
          usos: 0,
        })
        .select("*")
        .single();

      if (error) {
        console.error("[chatWithLizTraining insert erro]", error.message);
      } else if (created) {
        savedLearning = created as LizLearningItem;
      }
    }

    return {
      reply: replyText,
      savedLearning,
    };
  });

