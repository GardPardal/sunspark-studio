import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

type Body = {
  prompt: string;
  model?: string;
  size?: string;
  quality?: "low" | "medium" | "high";
  refine?: boolean;
  /** Data URLs ou https URLs de imagens de referência (máx 5). */
  inputImages?: string[];
  /** Máx imagens a gerar. 0 ou undefined = LIZ decide (1..6). */
  count?: number;
};

const REFINE_SYSTEM = `Você é uma diretora de arte especialista em prompts fotorrealistas (Midjourney v6 / gpt-image-2 no topo).
Devolva UM único prompt em INGLÊS, denso, cinematográfico. Inclua assunto detalhado, composição, iluminação, lente/câmera, materiais, paleta e a cauda de qualidade "hyperrealistic, photorealistic, ultra-detailed, 8k, sharp focus, high dynamic range". Nada de bullets, apenas uma linha longa.`;

const PLAN_SYSTEM = `Você é a LIZ, diretora de arte da LZ7 Energia. Sua tarefa: transformar o pedido do usuário em UMA LISTA de imagens a gerar.

REGRAS:
- Se o usuário pediu explicitamente "separar", "cada elemento", "uma imagem para cada", "variações", "conjunto" etc, produza VÁRIAS entradas — uma por elemento distinto.
- Se anexou imagens de referência, analise-as e liste cada elemento relevante como uma entrada, isolando-o em fundo neutro e limpo.
- Se o pedido é uma cena única, retorne apenas 1 entrada.
- Máximo permitido: {MAX} imagens. Mínimo: 1.

Cada entrada tem:
- "title": rótulo curto em português (ex: "Painel solar isolado")
- "prompt": prompt DENSO em INGLÊS, fotorrealista, com composição, luz, lente, textura e a cauda "hyperrealistic, photorealistic, ultra-detailed, 8k, sharp focus". Para isolamentos, use "isolated on seamless white background, product photography, studio lighting, no shadows on background".

RESPONDA APENAS JSON VÁLIDO no formato exato:
{"items":[{"title":"...","prompt":"..."}, ...]}
Sem markdown, sem comentários, sem texto extra.`;

type PlanItem = { title: string; prompt: string };

function extractJson(text: string): unknown {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(clean);
  } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* noop */ }
    }
    return null;
  }
}

async function planImages(
  key: string,
  idea: string,
  refs: string[],
  maxCount: number,
): Promise<PlanItem[]> {
  const gateway = createLovableAiGatewayProvider(key);
  const content: Array<
    { type: "text"; text: string } | { type: "image"; image: string }
  > = [{ type: "text", text: idea }, ...refs.map((url) => ({ type: "image" as const, image: url }))];

  const { text } = await generateText({
    model: gateway("google/gemini-3-flash-preview"),
    system: PLAN_SYSTEM.replace("{MAX}", String(maxCount)),
    messages: [{ role: "user", content }],
  });
  const parsed = extractJson(text) as { items?: PlanItem[] } | null;
  const items = Array.isArray(parsed?.items) ? parsed!.items : [];
  return items
    .filter((it) => it && typeof it.prompt === "string" && it.prompt.trim().length > 0)
    .slice(0, maxCount)
    .map((it) => ({
      title: (it.title || "").toString().slice(0, 120) || "Imagem",
      prompt: it.prompt.toString(),
    }));
}

async function refinePrompt(key: string, idea: string): Promise<string> {
  try {
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: REFINE_SYSTEM,
      prompt: idea,
    });
    return text.trim().replace(/^["']|["']$/g, "") || idea;
  } catch {
    return idea;
  }
}

async function generateOne(
  key: string,
  model: string,
  prompt: string,
  size: string,
  quality: "low" | "medium" | "high",
  refs: string[],
): Promise<{ ok: true; imageUrl: string } | { ok: false; error: string; status: number }> {
  const isGemini = model.startsWith("google/");
  const hasRefs = refs.length > 0;
  const reqBody: Record<string, unknown> = isGemini
    ? {
        model,
        messages: [
          {
            role: "user",
            content: hasRefs
              ? [
                  { type: "text", text: prompt },
                  ...refs.map((url) => ({ type: "image_url" as const, image_url: { url } })),
                ]
              : prompt,
          },
        ],
        modalities: ["image", "text"],
      }
    : { model, prompt, size, quality, n: 1 };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify(reqBody),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: t.slice(0, 300) || `HTTP ${res.status}`, status: res.status };
  }
  const data = (await res.json()) as {
    data?: Array<{ b64_json?: string }>;
    error?: { message?: string };
  };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) return { ok: false, error: data.error?.message || "sem imagem", status: 502 };
  return { ok: true, imageUrl: `data:image/png;base64,${b64}` };
}

export const Route = createFileRoute("/api/public/liz-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const key = process.env.LOVABLE_API_KEY;
          if (!key) return Response.json({ error: "AI indisponível" }, { status: 500 });

          const authHeader = request.headers.get("authorization");
          const token = authHeader?.replace(/^Bearer\s+/i, "");
          if (!token) return Response.json({ error: "Não autenticado" }, { status: 401 });

          const supabase = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          const { data: userData, error: userErr } = await supabase.auth.getUser(token);
          if (userErr || !userData.user) {
            return Response.json({ error: "Sessão inválida" }, { status: 401 });
          }

          const body = (await request.json()) as Body;
          if (!body?.prompt || typeof body.prompt !== "string") {
            return Response.json({ error: "prompt obrigatório" }, { status: 400 });
          }

          const inputImages = Array.isArray(body.inputImages)
            ? body.inputImages.filter((s) => typeof s === "string" && s.length > 0).slice(0, 5)
            : [];
          const hasRefs = inputImages.length > 0;

          let model = body.model || "openai/gpt-image-2";
          if (hasRefs && !model.startsWith("google/")) {
            model = "google/gemini-3-pro-image";
          }
          const size = body.size || "1024x1024";
          const quality: "low" | "medium" | "high" = body.quality || "high";

          const requested = Number(body.count) || 0;
          const maxCount = Math.min(6, Math.max(1, requested || 6));

          // Planeja quantas imagens gerar (LIZ decide, respeitando maxCount).
          let plan: PlanItem[] = [];
          try {
            plan = await planImages(key, body.prompt, inputImages, maxCount);
          } catch (e) {
            console.error("[liz-image] plan", e);
          }

          if (plan.length === 0) {
            // Fallback: 1 imagem com refino simples.
            const finalPrompt = body.refine === false
              ? body.prompt
              : await refinePrompt(key, body.prompt);
            plan = [{ title: "Imagem", prompt: finalPrompt }];
          }

          // Se usuário pediu contagem explícita, respeita como TETO (não força mais).
          if (requested > 0) plan = plan.slice(0, requested);

          // Gera em paralelo.
          const results = await Promise.all(
            plan.map(async (item) => {
              const r = await generateOne(key, model, item.prompt, size, quality, inputImages);
              if (r.ok) return { title: item.title, prompt: item.prompt, imageUrl: r.imageUrl, model };
              return { title: item.title, prompt: item.prompt, error: r.error, model };
            }),
          );

          const images = results.filter((r) => "imageUrl" in r) as Array<{
            title: string; prompt: string; imageUrl: string; model: string;
          }>;
          const errors = results.filter((r) => "error" in r) as Array<{
            title: string; prompt: string; error: string;
          }>;

          if (images.length === 0) {
            const first = errors[0]?.error || "Falha na geração";
            return Response.json({ error: first }, { status: 502 });
          }

          return Response.json({
            images,
            errors: errors.length ? errors : undefined,
            plan,
          });
        } catch (err) {
          console.error("[liz-image]", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "erro" },
            { status: 500 },
          );
        }
      },
    },
  },
});
