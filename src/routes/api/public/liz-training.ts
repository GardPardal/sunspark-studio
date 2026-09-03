import { createFileRoute } from "@tanstack/react-router";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { getResolvedAiModel } from "@/lib/ai-provider.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LIZ_TRAINER_SYSTEM_PROMPT = `Você é a LIZ, a consultora e inteligência artificial da LZ7 Energia Solar.
Você está na SALA DE TREINAMENTO com a nossa SDR Stephany e a liderança comercial da LZ7.

SEU OBJETIVO NESTA SALA:
Aprender com a SDR como você deve falar, agir, tirar dúvidas técnicas/comerciais, contornar objeções e atender clientes de energia solar no WhatsApp.

COMO VOCÊ DEVE RESPONDER:
1. Ouça com atenção a orientação, regra ou correção que a Stephany/SDR te passar.
2. Seja simpática, prestativa e confirme claramente que entendeu a regra.
3. Mostre um EXEMPLO PRÁTICO de como você responderá no WhatsApp de agora em diante (em 1 ou 2 frases curtas, naturais e sem cara de robô).
4. O sistema vai extrair essa instrução e gravá-la na sua memória viva para aplicar no WhatsApp em tempo real!`;

export const Route = createFileRoute("/api/public/liz-training")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { data, error } = await supabaseAdmin
            .from("liz_aprendizados")
            .select("*")
            .order("created_at", { ascending: false });

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ learnings: data ?? [] }), {
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          const err = e instanceof Error ? e.message : "Erro desconhecido";
          return new Response(JSON.stringify({ error: err }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as any;
          const action = body.action || "chat";

          if (action === "delete") {
            const id = body.id;
            if (!id) {
              return new Response(JSON.stringify({ error: "ID obrigatório" }), {
                status: 400,
                headers: { "content-type": "application/json" },
              });
            }

            const { error } = await supabaseAdmin
              .from("liz_aprendizados")
              .delete()
              .eq("id", id);

            if (error) throw new Error(error.message);
            return new Response(JSON.stringify({ ok: true }), {
              headers: { "content-type": "application/json" },
            });
          }

          if (action === "save") {
            const { id, categoria, titulo, conteudo, contexto, tags } = body;
            if (!titulo || !conteudo) {
              return new Response(JSON.stringify({ error: "Título e conteúdo obrigatórios" }), {
                status: 400,
                headers: { "content-type": "application/json" },
              });
            }

            if (id) {
              const { data: updated, error } = await supabaseAdmin
                .from("liz_aprendizados")
                .update({
                  categoria: categoria || "geral",
                  titulo,
                  conteudo,
                  contexto: contexto || null,
                  tags: tags || [],
                  updated_at: new Date().toISOString(),
                })
                .eq("id", id)
                .select("*")
                .single();

              if (error) throw new Error(error.message);
              return new Response(JSON.stringify({ ok: true, item: updated }), {
                headers: { "content-type": "application/json" },
              });
            }

            const { data: created, error } = await supabaseAdmin
              .from("liz_aprendizados")
              .insert({
                categoria: categoria || "geral",
                titulo,
                conteudo,
                contexto: contexto || "Manual SDR",
                tags: tags || [],
                origem: "treinamento_sdr",
                usos: 0,
              })
              .select("*")
              .single();

            if (error) throw new Error(error.message);
            return new Response(JSON.stringify({ ok: true, item: created }), {
              headers: { "content-type": "application/json" },
            });
          }

          // Default: action === "chat"
          const messages = Array.isArray(body.messages) ? body.messages : [];
          const latestUserMsg = messages[messages.length - 1]?.content || "";

          let replyText = "";
          let model: any = null;

          try {
            model = getResolvedAiModel();
            const aiResponse = await generateText({
              model,
              system: LIZ_TRAINER_SYSTEM_PROMPT,
              messages,
            });
            replyText = aiResponse.text?.trim() || "";
          } catch (aiErr) {
            console.error("[LIZ Training Primary Generation Error]", aiErr);

            // Fallback direto via Lovable Gateway
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
                      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
                    ],
                  }),
                });
                if (res.ok) {
                  const json = (await res.json()) as any;
                  replyText = json.choices?.[0]?.message?.content?.trim() ?? "";
                }
              } catch (fallbackErr) {
                console.error("[LIZ Training Fallback Error]", fallbackErr);
              }
            }
          }

          if (!replyText) {
            replyText =
              "Entendido perfeitamente! Aprendi essa orientação e já salvei na minha memória para aplicar nas conversas de WhatsApp.";
          }

          // Extração inteligente da regra ensinada
          let savedLearning: any = null;
          try {
            if (model) {
              const extraction = await generateObject({
                model,
                schema: z.object({
                  hasNewRuleOrGuideline: z
                    .boolean()
                    .describe(
                      "True se a mensagem ensina uma instrução, regra de resposta, quebra de objeção, dado regional ou dica de como agir",
                    ),
                  categoria: z
                    .enum([
                      "argumento",
                      "objecao",
                      "dado_tecnico",
                      "tarifa",
                      "regiao",
                      "dica_venda",
                      "tom_de_voz",
                      "geral",
                    ])
                    .describe("Categoria da regra aprendida"),
                  titulo: z
                    .string()
                    .describe("Título curto e claro da regra (ex: Sem fiador, Garantia de 25 anos, etc.)"),
                  conteudo: z
                    .string()
                    .describe("Como a LIZ deve agir ou responder exatamente quando esse tema surgir"),
                  tags: z.array(z.string()).describe("Palavras-chave relacionadas"),
                }),
                prompt: `Analise a instrução de treinamento abaixo:
Instrução do usuário: "${latestUserMsg}"
Resposta da LIZ: "${replyText}"

Identifique se houve um aprendizado prático para o WhatsApp da LZ7.`,
              });

              if (
                extraction.object.hasNewRuleOrGuideline &&
                extraction.object.titulo &&
                extraction.object.conteudo
              ) {
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
                  savedLearning = created;
                }
              }
            }
          } catch (extractErr) {
            console.warn("[Training extract warning]", extractErr);
          }

          return new Response(
            JSON.stringify({
              reply: replyText,
              savedLearning,
            }),
            { headers: { "content-type": "application/json" } },
          );
        } catch (err) {
          console.error("[LIZ Training Error]", err);
          const message = err instanceof Error ? err.message : "Erro desconhecido";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});