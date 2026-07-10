import { createFileRoute } from "@tanstack/react-router";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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
          };
          const messages = Array.isArray(body.messages) ? body.messages : [];
          const attribution = body.attribution ?? {};
          const mode: "capture" | "internal" = body.mode === "internal" ? "internal" : "capture";

          const geminiKey = process.env.GEMINI_API_KEY;
          if (!geminiKey) {
            return new Response(JSON.stringify({ error: "GEMINI_API_KEY não configurada" }), {
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

          // Google Gemini API direta (OpenAI-compatível) — sem custo Lovable.
          const gemini = createOpenAICompatible({
            name: "google-gemini",
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
            headers: { Authorization: `Bearer ${geminiKey}` },
          });
          const result = await generateText({
            model: gemini(mode === "internal" ? "gemini-2.5-pro" : "gemini-2.5-flash"),
            system,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            tools: tools as Parameters<typeof generateText>[0]["tools"],
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
