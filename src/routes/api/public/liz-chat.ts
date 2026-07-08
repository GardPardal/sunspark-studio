import { createFileRoute } from "@tanstack/react-router";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { LIZ_SYSTEM_PROMPT } from "@/lib/liz-prompt";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Attribution = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  page_url?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
};

export const Route = createFileRoute("/api/public/liz-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            messages?: ChatMessage[];
            attribution?: Attribution;
          };
          const messages = Array.isArray(body.messages) ? body.messages : [];
          const attribution = body.attribution ?? {};

          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return new Response(JSON.stringify({ error: "AI indisponível" }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }

          const supabaseUrl = process.env.SUPABASE_URL!;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });

          let qualifiedLeadId: string | null = null;

          const qualificarLead = tool({
            description:
              "Registra o lead qualificado no CRM da LZ7. Chame APENAS quando tiver coletado todos os dados obrigatórios (nome, telefone/whatsapp, cidade, valor da conta).",
            inputSchema: z.object({
              nome: z.string(),
              telefone: z.string().describe("WhatsApp do lead com DDD"),
              cidade: z.string(),
              estado: z.string().optional(),
              valor_conta: z.string().describe("Valor da conta de luz, ex: 'R$ 450'"),
              tipo_imovel: z.string().optional().describe("casa/apartamento, próprio/alugado"),
              tipo_telhado: z.string().optional(),
              decisor: z.string().optional().describe("quem decide a compra"),
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
                  telefone: input.telefone.slice(0, 30),
                  cidade: input.cidade?.slice(0, 120) ?? null,
                  estado: input.estado?.slice(0, 60) ?? null,
                  valor_conta: input.valor_conta?.slice(0, 60) ?? null,
                  mensagem: mensagem.slice(0, 2000) || null,
                  origem: "liz_chat",
                  utm_source: attribution.utm_source ?? "liz_chat",
                  utm_medium: attribution.utm_medium ?? null,
                  utm_campaign: attribution.utm_campaign ?? null,
                  utm_term: attribution.utm_term ?? null,
                  utm_content: attribution.utm_content ?? null,
                  gclid: attribution.gclid ?? null,
                  fbclid: attribution.fbclid ?? null,
                  fbp: attribution.fbp ?? null,
                  fbc: attribution.fbc ?? null,
                  page_url: attribution.page_url ?? null,
                  referrer: attribution.referrer ?? null,
                  user_agent: attribution.user_agent ?? null,
                })
                .select("id")
                .single();

              if (error) {
                return { ok: false, error: error.message };
              }
              qualifiedLeadId = data.id;
              return { ok: true, id: data.id };
            },
          });

          const gateway = createLovableAiGatewayProvider(key);
          const result = await generateText({
            model: gateway("google/gemini-3-flash-preview"),
            system: LIZ_SYSTEM_PROMPT,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            tools: { qualificar_lead: qualificarLead },
            stopWhen: stepCountIs(6),
          });

          return new Response(
            JSON.stringify({
              reply: result.text || "Desculpe, tive um problema. Pode repetir?",
              qualified: qualifiedLeadId !== null,
              leadId: qualifiedLeadId,
            }),
            { headers: { "content-type": "application/json" } },
          );
        } catch (err) {
          console.error("[liz-chat]", err);
          const message = err instanceof Error ? err.message : "erro desconhecido";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
