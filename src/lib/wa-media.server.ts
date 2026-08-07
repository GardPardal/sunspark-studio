// Download de mídia do WhatsApp + transcrição de áudio (server-only).

import { graphUrl, waAdminClient } from "@/lib/wa.server";

const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_PREFIXES = ["audio/", "image/", "video/", "application/pdf", "text/plain"];

function isAllowedMime(mime: string) {
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

function extFor(mime: string) {
  const map: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/amr": "amr",
    "audio/wav": "wav",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "application/pdf": "pdf",
    "text/plain": "txt",
  };
  return map[mime.split(";")[0]] ?? "bin";
}

async function sha256Hex(buf: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Baixa a mídia da Graph API em duas etapas e guarda no bucket privado wa-media.
 * Retorna o id da linha em public.wa_media.
 */
export async function ingestWaMedia(opts: {
  orgId: string;
  providerMediaId: string;
  fallbackMime?: string | null;
}): Promise<string | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    console.error("[wa media] WHATSAPP_ACCESS_TOKEN ausente");
    return null;
  }
  const supabase = waAdminClient();

  const { data: row, error: insErr } = await supabase
    .from("wa_media")
    .insert({
      org_id: opts.orgId,
      provider_media_id: opts.providerMediaId,
      mime_type: opts.fallbackMime ?? null,
      download_status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !row) {
    console.error("[wa media] insert falhou", insErr);
    return null;
  }
  const mediaRowId = row.id;

  try {
    const metaRes = await fetch(graphUrl(`/${opts.providerMediaId}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) throw new Error(`meta [${metaRes.status}]: ${await metaRes.text()}`);
    const meta = (await metaRes.json()) as {
      url?: string;
      mime_type?: string;
      file_size?: number;
    };
    if (!meta.url) throw new Error("URL de mídia ausente");

    const mime = (meta.mime_type ?? opts.fallbackMime ?? "application/octet-stream").split(";")[0];
    if (!isAllowedMime(mime)) throw new Error(`MIME não permitido: ${mime}`);
    if ((meta.file_size ?? 0) > MAX_MEDIA_BYTES) throw new Error("Arquivo acima do limite");

    const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!binRes.ok) throw new Error(`download [${binRes.status}]`);
    const buf = await binRes.arrayBuffer();
    if (buf.byteLength > MAX_MEDIA_BYTES) throw new Error("Arquivo acima do limite");

    const path = `${opts.orgId}/${opts.providerMediaId}.${extFor(mime)}`;
    const { error: upErr } = await supabase.storage
      .from("wa-media")
      .upload(path, buf, { contentType: mime, upsert: true });
    if (upErr) throw new Error(`storage: ${upErr.message}`);

    await supabase
      .from("wa_media")
      .update({
        storage_path: path,
        mime_type: mime,
        size_bytes: buf.byteLength,
        sha256: await sha256Hex(buf),
        download_status: "done",
      })
      .eq("id", mediaRowId);

    if (mime.startsWith("audio/")) {
      await transcribeWaAudio(mediaRowId, buf, mime);
    }
    return mediaRowId;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[wa media]", message);
    await supabase
      .from("wa_media")
      .update({ download_status: "error", error: message })
      .eq("id", mediaRowId);
    return mediaRowId;
  }
}

/**
 * Transcreve áudio via Lovable AI.
 * WhatsApp entrega OGG/Opus, que o endpoint de transcrição rejeita — nesse caso
 * usamos o caminho multimodal do Gemini (chat completions com áudio em base64).
 */
export async function transcribeWaAudio(
  mediaRowId: string,
  buf: ArrayBuffer,
  mime: string,
): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const supabase = waAdminClient();
  if (!apiKey) {
    await supabase
      .from("wa_media")
      .update({ transcript_status: "error", error: "LOVABLE_API_KEY ausente" })
      .eq("id", mediaRowId);
    return null;
  }

  const base = mime.split(";")[0];
  const sttFriendly = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/m4a"].includes(base);

  try {
    let text: string | null = null;

    if (sttFriendly) {
      const form = new FormData();
      form.append("model", "openai/gpt-4o-mini-transcribe");
      form.append(
        "file",
        new Blob([buf], { type: base }),
        `audio.${base === "audio/mpeg" ? "mp3" : base === "audio/wav" ? "wav" : "mp4"}`,
      );
      const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!res.ok) throw new Error(`stt [${res.status}]: ${await res.text()}`);
      const json = (await res.json()) as { text?: string };
      text = json.text ?? null;
    } else {
      // OGG/Opus e demais formatos: caminho multimodal
      const b64 = base64FromArrayBuffer(buf);
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Transcreva literalmente este áudio em português do Brasil. Responda apenas com a transcrição.",
                },
                {
                  type: "input_audio",
                  input_audio: { data: b64, format: base === "audio/ogg" ? "ogg" : "wav" },
                },
              ],
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`gemini audio [${res.status}]: ${await res.text()}`);
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      text = json.choices?.[0]?.message?.content?.trim() ?? null;
    }

    if (!text) throw new Error("Transcrição vazia");

    await supabase
      .from("wa_media")
      .update({ transcript: text, transcript_status: "done" })
      .eq("id", mediaRowId);
    return text;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[wa transcribe]", message);
    await supabase
      .from("wa_media")
      .update({ transcript_status: "error", error: message })
      .eq("id", mediaRowId);
    return null;
  }
}

function base64FromArrayBuffer(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
