import { createFileRoute } from "@tanstack/react-router";

import { ingestInboundMessage, ingestStatus, type WaValue } from "@/lib/wa-ingest.server";
import { waAdminClient } from "@/lib/wa.server";

const BATCH = 20;
const MAX_ATTEMPTS = 5;

/**
 * Worker de processamento dos eventos brutos do WhatsApp.
 * Chamado por cron (pg_cron) com o header `apikey`.
 */
export const Route = createFileRoute("/api/public/wa/queue/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anon = process.env.SUPABASE_ANON_KEY;
        const provided = request.headers.get("apikey");
        if (!anon || provided !== anon) {
          return new Response("unauthorized", { status: 401 });
        }

        const supabase = waAdminClient();
        const { data: events, error } = await supabase
          .from("wa_events")
          .select("id, payload, event_kind, attempts")
          .eq("process_status", "pending")
          .lt("attempts", MAX_ATTEMPTS)
          .order("received_at", { ascending: true })
          .limit(BATCH);

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        let processed = 0;
        let failed = 0;
        let replied = 0;

        for (const ev of events ?? []) {
          const payload = ev.payload as {
            value?: WaValue;
            target_id?: string;
            entry_kind?: string;
          };
          try {
            const value = payload.value;
            if (!value) throw new Error("payload sem value");

            if (ev.event_kind === "message") {
              const msg = (value.messages ?? []).find(
                (m) => (m as Record<string, unknown>).id === payload.target_id,
              );
              if (msg) {
                const result = await ingestInboundMessage(supabase, value, msg);
                if (result.ok && result.body?.trim()) {
                  const { orchestrateReply } = await import("@/lib/wa-orchestrator.server");
                  const decision = await orchestrateReply({
                    orgId: result.orgId,
                    conversationId: result.conversationId,
                    contactId: result.contactId,
                    channelId: result.channelId,
                    userText: result.body,
                  });
                  if (decision.action === "replied") replied++;
                }
              }
            } else if (ev.event_kind === "status") {
              for (const st of value.statuses ?? []) {
                await ingestStatus(supabase, st);
              }
            }

            await supabase
              .from("wa_events")
              .update({
                process_status: "done",
                processed_at: new Date().toISOString(),
                attempts: ev.attempts + 1,
                error: null,
              })
              .eq("id", ev.id);
            processed++;
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            const attempts = ev.attempts + 1;
            await supabase
              .from("wa_events")
              .update({
                attempts,
                error: message,
                process_status: attempts >= MAX_ATTEMPTS ? "dead" : "pending",
              })
              .eq("id", ev.id);
            failed++;
          }
        }

        return Response.json({ ok: true, processed, failed, replied });
      },
    },
  },
});
