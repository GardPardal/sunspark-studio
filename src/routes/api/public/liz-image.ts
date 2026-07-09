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
  /** Data URLs (`data:image/...;base64,...`) ou https URLs de imagens de referência (máx 5). */
  inputImages?: string[];
};

const REFINE_SYSTEM = `Você é uma diretora de arte especialista em prompts para geração de imagens fotorrealistas (nível Midjourney v6 / gpt-image-2 em qualidade máxima).
Receba a ideia curta do usuário em português e devolva UM ÚNICO prompt em INGLÊS, denso, cinematográfico, específico. Inclua:
- Assunto principal detalhado
- Composição e enquadramento (ex: medium shot, rule of thirds, symmetrical)
- Iluminação (ex: golden hour, soft rim light, cinematic volumetric)
- Lente e câmera (ex: shot on Hasselblad H6D, 85mm f/1.4, shallow depth of field)
- Materiais e texturas
- Paleta e mood
- Qualidade: "hyperrealistic, photorealistic, ultra-detailed, 8k, sharp focus, high dynamic range"
NÃO explique. NÃO use bullet. Devolva só o prompt final em uma linha longa.`;

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

export const Route = createFileRoute("/api/public/liz-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return Response.json({ error: "AI indisponível" }, { status: 500 });
          }

          // Auth: requer sessão da equipe.
          const authHeader = request.headers.get("authorization");
          const token = authHeader?.replace(/^Bearer\s+/i, "");
          if (!token) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }
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

          // Com imagens de referência, força um modelo Gemini chat-shape (aceita image_url).
          let model = body.model || "openai/gpt-image-2";
          if (hasRefs && !model.startsWith("google/")) {
            model = "google/gemini-3-pro-image";
          }
          const size = body.size || "1024x1024";
          const quality = body.quality || "high";

          const finalPrompt = body.refine === false
            ? body.prompt
            : await refinePrompt(key, body.prompt);

          const isGemini = model.startsWith("google/");
          const reqBody: Record<string, unknown> = isGemini
            ? {
                model,
                messages: [
                  {
                    role: "user",
                    content: hasRefs
                      ? [
                          { type: "text", text: finalPrompt },
                          ...inputImages.map((url) => ({
                            type: "image_url" as const,
                            image_url: { url },
                          })),
                        ]
                      : finalPrompt,
                  },
                ],
                modalities: ["image", "text"],
              }
            : {
                model,
                prompt: finalPrompt,
                size,
                quality,
                n: 1,
              };

          const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "Lovable-API-Key": key,
            },
            body: JSON.stringify(reqBody),
          });

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error("[liz-image] gateway", res.status, text);
            if (res.status === 429) {
              return Response.json(
                { error: "Muitas requisições — espera alguns segundos e tenta de novo." },
                { status: 429 },
              );
            }
            if (res.status === 402) {
              return Response.json(
                { error: "Créditos de IA esgotados. Adicione créditos no workspace." },
                { status: 402 },
              );
            }
            return Response.json(
              { error: `Falha na geração (${res.status}): ${text.slice(0, 300)}` },
              { status: 502 },
            );
          }

          const data = (await res.json()) as {
            data?: Array<{ b64_json?: string }>;
            error?: { message?: string };
          };
          const b64 = data.data?.[0]?.b64_json;
          if (!b64) {
            return Response.json(
              { error: data.error?.message || "Sem imagem no retorno" },
              { status: 502 },
            );
          }

          return Response.json({
            imageUrl: `data:image/png;base64,${b64}`,
            prompt: finalPrompt,
            model,
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
