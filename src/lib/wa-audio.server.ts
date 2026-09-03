// Transcrição universal de áudios do WhatsApp (server-only).
// Suporta Groq Whisper, OpenAI Whisper e Gemini Multimodal.

export async function transcribeWaAudio(audioUrl: string, mime?: string | null): Promise<string> {
  if (!audioUrl) return "";

  try {
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error(`Falha ao baixar áudio: HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const actualMime = mime || "audio/ogg; codecs=opus";
    const ext = actualMime.includes("mp4")
      ? "m4a"
      : actualMime.includes("mpeg") || actualMime.includes("mp3")
        ? "mp3"
        : actualMime.includes("wav")
          ? "wav"
          : "ogg";

    // 1. Groq Whisper (Ultra-rápido ~200ms)
    if (process.env.GROQ_API_KEY) {
      try {
        const formData = new FormData();
        const blob = new Blob([buffer], { type: actualMime });
        formData.append("file", blob, `audio.${ext}`);
        formData.append("model", "whisper-large-v3-turbo");
        formData.append("language", "pt");
        formData.append("response_format", "json");

        const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: formData,
        });

        if (groqRes.ok) {
          const json = (await groqRes.json()) as any;
          if (json.text?.trim()) {
            console.log(`[Transcrição Groq Whisper] "${json.text.trim()}"`);
            return json.text.trim();
          }
        }
      } catch (groqErr) {
        console.warn("[Groq Whisper error, fallback]", groqErr);
      }
    }

    // 2. OpenAI Whisper
    if (process.env.OPENAI_API_KEY) {
      try {
        const formData = new FormData();
        const blob = new Blob([buffer], { type: actualMime });
        formData.append("file", blob, `audio.${ext}`);
        formData.append("model", "whisper-1");
        formData.append("language", "pt");

        const oaiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: formData,
        });

        if (oaiRes.ok) {
          const json = (await oaiRes.json()) as any;
          if (json.text?.trim()) {
            console.log(`[Transcrição OpenAI Whisper] "${json.text.trim()}"`);
            return json.text.trim();
          }
        }
      } catch (oaiErr) {
        console.warn("[OpenAI Whisper error, fallback]", oaiErr);
      }
    }

    // 3. Google Gemini 2.0 Multimodal
    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (geminiKey) {
      try {
        const base64Audio = buffer.toString("base64");
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType: actualMime.split(";")[0],
                        data: base64Audio,
                      },
                    },
                    {
                      text: "Transcreva com fidelidade absoluta tudo o que foi dito neste áudio em português. Retorne APENAS o texto falado, sem nenhuma palavra ou introdução a mais.",
                    },
                  ],
                },
              ],
            }),
          },
        );

        if (geminiRes.ok) {
          const json = (await geminiRes.json()) as any;
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            console.log(`[Transcrição Gemini Audio] "${text}"`);
            return text;
          }
        }
      } catch (geminiErr) {
        console.warn("[Gemini Audio error]", geminiErr);
      }
    }

    return "";
  } catch (err) {
    console.error("[transcribeWaAudio general error]", err);
    return "";
  }
}
