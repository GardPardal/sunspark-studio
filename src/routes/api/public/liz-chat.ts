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

/** Busca web via DuckDuckGo HTML (sem key). Retorna títulos + snippets + links. */
async function webSearch(query: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const r = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; LizBot/1.0; +https://lz7energia.com.br)",
        "accept": "text/html",
      },
    });
    if (!r.ok) return `Busca falhou (status ${r.status}).`;
    const html = await r.text();
    const results: string[] = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(html)) && i < 6) {
      const link = decodeURIComponent(m[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, "").split("&")[0]);
      const title = m[2].replace(/<[^>]+>/g, "").trim();
      const snippet = m[3].replace(/<[^>]+>/g, "").trim();
      results.push(`**${title}**\n${snippet}\n${link}`);
      i++;
    }
    if (!results.length) return "Nenhum resultado direto — tente refinar a pergunta.";
    return results.join("\n\n---\n\n");
  } catch (e) {
    return `Erro na busca: ${e instanceof Error ? e.message : "desconhecido"}`;
  }
}

/** Baixa e extrai texto legível de uma URL. */
async function fetchUrl(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; LizBot/1.0; +https://lz7energia.com.br)",
        "accept": "text/html,application/json,text/plain",
      },
      redirect: "follow",
    });
    if (!r.ok) return `Não consegui abrir (status ${r.status}).`;
    const ct = r.headers.get("content-type") ?? "";
    const raw = await r.text();
    if (ct.includes("application/json")) return raw.slice(0, 8000);
    // Extrai texto de HTML
    const text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 8000);
  } catch (e) {
    return `Erro ao abrir: ${e instanceof Error ? e.message : "desconhecido"}`;
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
            sessionId?: string;
          };
          const messages = Array.isArray(body.messages) ? body.messages : [];
          const attribution = body.attribution ?? {};
          const mode: "capture" | "internal" = body.mode === "internal" ? "internal" : "capture";
          const sessionId = (body.sessionId && String(body.sessionId).slice(0, 80)) || null;

          const lovableKey = process.env.LOVABLE_API_KEY;
          if (!lovableKey) {
            return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
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
              const result = await webSearch(query);
              return { query, result };
            },
          });

          const abrirUrl = tool({
            description:
              "Abre uma URL específica e retorna o texto legível da página (até 8 mil caracteres). Use pra ler artigo, PDF-html, notícia, tabela de tarifa, ou qualquer link que o time mandar ou que apareça na busca.",
            inputSchema: z.object({
              url: z.string().url().describe("URL completa começando com https://"),
            }),
            execute: async ({ url }) => {
              const content = await fetchUrl(url);
              return { url, content };
            },
          });

          const gerarImagem = tool({
            description:
              "Gera uma imagem via Pollinations.ai (grátis, sem custo). Use quando o time pedir arte, ilustração, banner, mockup, thumbnail. Retorna markdown com a imagem embutida (renderiza direto no chat).",
            inputSchema: z.object({
              prompt: z
                .string()
                .describe(
                  "Descrição detalhada em inglês (composição, estilo, iluminação, cores).",
                ),
              tamanho: z
                .enum(["1024x1024", "1024x1536", "1536x1024"])
                .optional()
                .describe("Formato. Padrão: 1024x1024."),
            }),
            execute: async ({ prompt, tamanho }) => {
              const [w, h] = (tamanho ?? "1024x1024").split("x");
              const seed = Math.floor(Math.random() * 1_000_000);
              const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
                prompt,
              )}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`;
              return {
                ok: true,
                tamanho: tamanho ?? "1024x1024",
                markdown: `![imagem gerada](${url})`,
                aviso:
                  "Inclua o markdown acima na sua resposta EXATAMENTE como está, para o time ver a imagem.",
              };
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

          const tools: Record<string, unknown> = {
            pesquisar_web: pesquisarWeb,
            abrir_url: abrirUrl,
            consultar_aprendizados: consultarAprendizados,
          };
          if (mode === "internal") {
            tools.salvar_aprendizado = salvarAprendizado;
            tools.gerar_imagem = gerarImagem;
          } else {
            tools.qualificar_lead = qualificarLead;
          }

          const system = mode === "internal" ? LIZ_INTERNAL_PROMPT : LIZ_CAPTURE_PROMPT;

          // Via Lovable AI Gateway — sem gerenciar chave própria.
          const gateway = createLovableAiGatewayProvider(lovableKey);
          const result = await generateText({
            model: gateway(mode === "internal" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash"),
            system,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            tools: tools as Parameters<typeof generateText>[0]["tools"],
            stopWhen: stepCountIs(50),
          });

          const replyText = result.text || "Desculpe, tive um problema. Pode repetir?";

          // Persistência do histórico + e-mail para Alison (usuários não-admin/dev)
          if (sessionId) {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              // Verifica se é admin (só no modo interno)
              let isAdminOrDev = false;
              let userEmail: string | null = null;
              let userName: string | null = null;
              if (mode === "internal" && internalUserId) {
                const [{ data: roles }, { data: prof }] = await Promise.all([
                  supabaseAdmin.from("user_roles").select("role").eq("user_id", internalUserId),
                  supabaseAdmin.from("profiles").select("email,full_name").eq("id", internalUserId).maybeSingle(),
                ]);
                isAdminOrDev = (roles ?? []).some((r: { role: string }) => r.role === "admin");
                userEmail = prof?.email ?? null;
                userName = prof?.full_name ?? null;
              }

              const fullMessages = [...messages, { role: "assistant" as const, content: replyText }];
              const nowIso = new Date().toISOString();

              const { data: existing } = await supabaseAdmin
                .from("liz_conversations")
                .select("id,first_at,last_emailed_at")
                .eq("session_id", sessionId)
                .maybeSingle();

              const row = {
                session_id: sessionId,
                user_id: internalUserId,
                user_email: userEmail,
                user_name: userName,
                mode,
                is_admin_or_dev: isAdminOrDev,
                messages: fullMessages,
                message_count: fullMessages.length,
                updated_at: nowIso,
                page_url: attribution.page_url ?? null,
                user_agent: attribution.user_agent ?? null,
              };
              if (existing) {
                await supabaseAdmin.from("liz_conversations").update(row).eq("session_id", sessionId);
              } else {
                await supabaseAdmin.from("liz_conversations").insert({ ...row, first_at: nowIso });
              }

              // Enfileira e-mail para Alison se não for admin/dev, throttled a cada 5 min por sessão
              const lastEmailed = existing?.last_emailed_at ? new Date(existing.last_emailed_at).getTime() : 0;
              const shouldEmail = !isAdminOrDev && (Date.now() - lastEmailed > 5 * 60 * 1000);
              if (shouldEmail) {
                await supabaseAdmin.rpc("enqueue_email", {
                  queue_name: "q_transactional_emails",
                  payload: {
                    to: "alison.amaral@lz7energia.com.br",
                    template: "liz-historico",
                    data: {
                      session_id: sessionId,
                      user_email: userEmail,
                      user_name: userName,
                      mode,
                      page_url: attribution.page_url ?? null,
                      first_at: existing?.first_at ?? nowIso,
                      updated_at: nowIso,
                      message_count: fullMessages.length,
                      messages: fullMessages,
                    },
                  },
                });
                await supabaseAdmin
                  .from("liz_conversations")
                  .update({ last_emailed_at: nowIso })
                  .eq("session_id", sessionId);
              }
            } catch (persistErr) {
              console.error("[liz-chat persist]", persistErr);
            }
          }

          return new Response(
            JSON.stringify({
              reply: replyText,
              qualified: qualifiedLeadId !== null,
              leadId: qualifiedLeadId,
            }),
            { headers: { "content-type": "application/json" } },
          );
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
