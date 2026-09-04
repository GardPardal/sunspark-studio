import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Resolvedor central de modelos de IA para o Solar OS e LIZ no WhatsApp.
 *
 * Ordem de prioridade (permite usar chaves próprias sem gastar cota do Lovable):
 * 1. Google Gemini Oficial (GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY)
 * 2. Groq (GROQ_API_KEY) — ultra-rápido com Llama 3.3
 * 3. OpenAI (OPENAI_API_KEY) — GPT-4o-mini
 * 4. OpenRouter (OPENROUTER_API_KEY)
 * 5. Lovable AI Gateway (LOVABLE_API_KEY) — apenas fallback
 */
export function getResolvedAiModel(modelOverride?: string) {
  // 1. Google Gemini Direto (Google AI Studio / Antigravity / Vertex)
  const geminiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    return google(modelOverride || "gemini-2.5-flash");
  }

  // 2. Groq Direto (Velocidade máxima para WhatsApp)
  if (process.env.GROQ_API_KEY) {
    const groq = createOpenAICompatible({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    });
    return groq(modelOverride || "llama-3.3-70b-versatile");
  }

  // 3. OpenAI Direta
  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAICompatible({
      name: "openai",
      baseURL: "https://api.openai.com/v1",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    return openai(modelOverride || "gpt-4o-mini");
  }

  // 4. OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    });
    return openrouter(modelOverride || "google/gemini-flash-1.5");
  }

  // 5. Fallback Lovable Gateway (apenas se nenhuma outra chave estiver configurada)
  if (process.env.LOVABLE_API_KEY) {
    const lovable = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": process.env.LOVABLE_API_KEY },
    });
    return lovable(modelOverride || "google/gemini-2.5-flash");
  }

  // Se nada foi configurado, usa mock de erro descritivo
  throw new Error(
    "Nenhuma chave de IA configurada. Por favor, adicione GEMINI_API_KEY ou OPENAI_API_KEY nas variáveis de ambiente.",
  );
}

export function hasCustomAiConfigured(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.OPENROUTER_API_KEY,
  );
}
