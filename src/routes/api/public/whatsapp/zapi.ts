import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { defaultOrgId } from "@/lib/wa-ingest.server";
import { normalizeZapiWebhook } from "@/lib/wa-normalize.server";
import { applyDeliveryStatus, persistNormalizedMessage } from "@/lib/wa-store.server";
import { getZApiConfig } from "@/lib/zapi.server";

// 🔒 IA pausada até autorização expressa do usuário.
const LIZ_AUTO_REPLY_ENABLED = false;

export const Route = createFileRoute("/api/public/whatsapp/zapi")({
  server: {
    handlers: {
      GET: async () => new Response("Z-API Webhook LZ7 ativo", { status: 200 }),

      POST: async ({ request }) => {
        try {
          const expectedToken = getZApiConfig().clientToken;
          const suppliedToken =
            request.headers.get("client-token") ||
            request.headers.get("x-zapi-token") ||
            new URL(request.url).searchParams.get("token");
          if (!suppliedToken || suppliedToken !== expectedToken) {
            return new Response("forbidden", { status: 403 });
          }

          const raw = await request.text();
          if (raw.length > 1_000_000) return new Response("payload too large", { status: 413 });
          const payload = JSON.parse(raw);

          const orgId = await defaultOrgId(supabaseAdmin as never);
          if (!orgId) return new Response("no org", { status: 503 });

          const evento = normalizeZapiWebhook(payload);

          // Registro bruto idempotente (permite reprocessar e reparar depois).
          const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
          const payloadHash = Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          const eventId =
            evento.kind === "status"
              ? `status:${evento.ids.join(",")}:${evento.status}`
              : evento.kind === "message" && evento.messageId
                ? `message:${evento.messageId}:${payload.isEdit ? "edit" : "new"}`
                : `zapi:${payloadHash}`;

          const { data: recordedEvent, error: eventError } = await supabaseAdmin
            .from("wa_events")
            .upsert(
              {
                org_id: orgId,
                provider_event_id: eventId,
                event_kind: evento.kind,
                payload,
                process_status: "processing",
                attempts: 1,
              } as never,
              { onConflict: "provider_event_id", ignoreDuplicates: true },
            )
            .select("id")
            .maybeSingle();
          if (eventError) throw eventError;
          if (!recordedEvent) return new Response("duplicate event ignored", { status: 200 });

          const finish = async (status: string, texto: string, code = 200) => {
            await supabaseAdmin
              .from("wa_events")
              .update({
                process_status: status,
                processed_at: new Date().toISOString(),
                error: status === "processed" ? null : texto,
              } as never)
              .eq("provider_event_id", eventId);
            return new Response(texto, { status: code });
          };

          if (evento.kind === "ignore") {
            return finish("processed", `ignorado: ${evento.reason}`);
          }

          if (evento.kind === "status") {
            const n = await applyDeliveryStatus(supabaseAdmin, evento.ids, evento.status);
            return finish("processed", `status ${evento.status} em ${n} mensagem(ns)`);
          }

          if (evento.isGroup) {
            return finish("processed", "mensagem de grupo ignorada");
          }

          const result = await persistNormalizedMessage(supabaseAdmin, orgId, evento);
          if (!result.ok) return finish("failed", `não persistida: ${result.reason}`);

          if (!LIZ_AUTO_REPLY_ENABLED) {
            return finish("processed", "mensagem registrada (IA pausada)");
          }

          return finish("processed", "ok");
        } catch (err) {
          const message = err instanceof Error ? err.message : "erro desconhecido";
          console.error("[Z-API Webhook Error]", message);
          return new Response(`error: ${message}`, { status: 500 });
        }
      },
    },
  },
});
