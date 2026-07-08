import { createFileRoute } from "@tanstack/react-router";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { LIZ_CAPTURE_PROMPT, LIZ_INTERNAL_PROMPT } from "@/lib/liz-prompt";
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

/** Pesquisa web leve via DuckDuckGo Instant Answer (sem key, sem dependência). */
async function duckSearch(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const r = await fetch(url, { headers: { "user-agent": "LizBot/1.0 (LZ7 Energia)" } });
    if (!r.ok) return `Sem resultados (status ${r.status}).`;
    const data = (await r.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };
    const parts: string[] = [];
    if (data.Heading) parts.push(`**${data.Heading}**`);
    if (data.AbstractText) parts.push(data.AbstractText);
    if (data.AbstractURL) parts.push(`Fonte: ${data.AbstractURL}`);
    const related = (data.RelatedTopics ?? [])
      .filter((t) => t.Text)
      .slice(0, 4)
      .map((t) => `- ${t.Text}${t.FirstURL ? ` (${t.FirstURL})` : ""}`);
    if (related.length) parts.push("Relacionados:\n" + related.join("\n"));
    return parts.length ? parts.join("\n\n") : "Não achei nada relevante direto — tente refinar a pergunta.";
  } catch (e) {
    return `Erro na busca: ${e instanceof Error ? e.message : "desconhecido"}`;
  }
}

export const Route = createFileRoute("/api/public/liz-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            messages?: ChatMessage[];
            attribution?: Attribution;
            mode?: "capture" | "internal";
            authToken?: string;
          };
          const messages = Array.isArray(body.messages) ? body.messages : [];
          const attribution = body.attribution ?? {};
          const mode: "capture" | "internal" = body.mode === "internal" ? "internal" : "capture";

          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return new Response(JSON.stringify({ error: "AI indisponível" }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }

          const supabaseUrl = process.env.SUPABASE_URL!;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

          // Cliente Supabase — se for interno e tiver token, roda como o usuário.
          const authHeader = request.headers.get("authorization");
          const token = authHeader?.replace(/^Bearer\s+/i, "") ?? body.authToken ?? null;
          const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
            global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
          });

          // Se modo interno, validar sessão.
          let internalUserId: string | null = null;
          if (mode === "internal") {
            if (!token) {
              return new Response(JSON.stringify({ error: "Não autenticado" }), {
                status: 401,
                headers: { "content-type": "application/json" },
              });
            }
            const { data: userData, error: userErr } = await supabase.auth.getUser(token);
            if (userErr || !userData.user) {
              return new Response(JSON.stringify({ error: "Sessão inválida" }), {
                status: 401,
                headers: { "content-type": "application/json" },
              });
            }
            internalUserId = userData.user.id;
          }

          let qualifiedLeadId: string | null = null;

          // ---- Ferramentas ----

          const qualificarLead = tool({
            description:
              "Registra o lead qualificado no CRM da LZ7. Chame APENAS quando tiver nome, WhatsApp, cidade e valor da conta.",
            inputSchema: z.object({
              nome: z.string(),
              telefone: z.string().describe("WhatsApp do lead com DDD"),
              cidade: z.string(),
              estado: z.string().optional(),
              valor_conta: z.string().describe("Valor da conta, ex: 'R$ 450'"),
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
                  telefone: input.telefone.slice(0, 30),
                  cidade: input.cidade?.slice(0, 120) ?? null,
                  estado: input.estado?.slice(0, 60) ?? null,
                  valor_conta: input.valor_conta?.slice(0, 60) ?? null,
                  mensagem: mensagem.slice(0, 2000) || null,
                  origem: mode === "capture" ? "liz_captura" : "liz_interno",
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

              if (error) return { ok: false, error: error.message };
              qualifiedLeadId = data.id;
              return { ok: true, id: data.id };
            },
          });

          const pesquisarWeb = tool({
            description:
              "Busca informação atualizada na internet. Use pra tarifa de concessionária, notícias de energia, dados de cidade, regulação ANEEL, etc.",
            inputSchema: z.object({
              query: z.string().describe("Consulta objetiva em português"),
            }),
            execute: async ({ query }) => {
              const result = await duckSearch(query);
              return { query, result };
            },
          });

          const consultarAprendizados = tool({
            description:
              "Consulta a memória de aprendizados da Liz — objeções, argumentos, dados salvos anteriormente pela equipe.",
            inputSchema: z.object({
              termo: z.string().describe("Palavra-chave ou tema"),
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
              if (termo) q = q.or(`titulo.ilike.%${termo}%,conteudo.ilike.%${termo}%,contexto.ilike.%${termo}%`);
              const { data, error } = await q;
              if (error) return { ok: false, error: error.message };
              return { ok: true, resultados: data ?? [] };
            },
          });

          const salvarAprendizado = tool({
            description:
              "Salva um novo aprendizado na memória da Liz (objeção nova, argumento que funcionou, dado técnico validado).",
            inputSchema: z.object({
              categoria: z.enum([
                "objecao",
                "argumento",
                "dado_tecnico",
                "tarifa",
                "regiao",
                "dica_venda",
                "outros",
              ]),
              titulo: z.string().max(200),
              conteudo: z.string().max(2000),
              contexto: z.string().max(500).optional(),
              tags: z.array(z.string()).optional(),
            }),
            execute: async (input) => {
              const { data, error } = await supabase
                .from("liz_aprendizados")
                .insert({
                  categoria: input.categoria,
                  titulo: input.titulo,
                  conteudo: input.conteudo,
                  contexto: input.contexto ?? null,
                  tags: input.tags ?? [],
                  criado_por: internalUserId,
                  origem: mode === "internal" ? "liz_interno" : "liz_captura",
                })
                .select("id")
                .single();
              if (error) return { ok: false, error: error.message };
              return { ok: true, id: data.id };
            },
          });

          // Ferramentas disponíveis por modo
          const tools =
            mode === "internal"
              ? {
                  pesquisar_web: pesquisarWeb,
                  consultar_aprendizados: consultarAprendizados,
                  salvar_aprendizado: salvarAprendizado,
                }
              : {
                  qualificar_lead: qualificarLead,
                  pesquisar_web: pesquisarWeb,
                  consultar_aprendizados: consultarAprendizados,
                };

          const system = mode === "internal" ? LIZ_INTERNAL_PROMPT : LIZ_CAPTURE_PROMPT;

          const gateway = createLovableAiGatewayProvider(key);
          const result = await generateText({
            model: gateway("google/gemini-3-flash-preview"),
            system,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            tools,
            stopWhen: stepCountIs(50),
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
