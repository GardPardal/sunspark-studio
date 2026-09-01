import { createFileRoute } from "@tanstack/react-router";

/**
 * Dispara eventos REAIS (sem test_event_code) para a Meta CAPI, de modo que os
 * eventos personalizados `QualifiedLead` e `LeadDisqualified` passem a aparecer
 * na lista de eventos do Gerenciador de Eventos (criação de conversão personalizada).
 *
 * Uso: GET /api/public/meta/fire-live-events (executa uma única vez).
 */
export const Route = createFileRoute("/api/public/meta/fire-live-events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = process.env.META_CAPI_ACCESS_TOKEN;
        if (!token)
          return Response.json(
            { ok: false, error: "META_CAPI_ACCESS_TOKEN ausente" },
            { status: 500 },
          );

        const url = new URL(request.url);
        const force = url.searchParams.get("force") === "1";
        const times = Math.min(Math.max(Number(url.searchParams.get("times") ?? 1), 1), 5);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (!force) {
          const { count } = await supabaseAdmin
            .from("conversion_events")
            .select("id", { count: "exact", head: true })
            .eq("platform", "meta_capi")
            .eq("event_name", "QualifiedLead")
            .eq("test_mode", false);
          if ((count ?? 0) > 0) {
            return Response.json({
              ok: true,
              alreadySeeded: true,
              message:
                "Evento QualifiedLead já foi enviado em modo real. Use ?force=1 para reenviar.",
            });
          }
        }

        const { data } = await supabaseAdmin.from("site_settings").select("key,value");
        const settings: Record<string, string> = {};
        for (const r of data ?? []) settings[r.key] = r.value ?? "";
        // força modo REAL (sem test_event_code)
        settings.meta_test_event_code = "";

        const { sendMetaEvent, persistConversionEvent } = await import("@/lib/conversions.server");

        const results: any[] = [];
        for (let i = 0; i < times; i++) {
          const stamp = Date.now() + i;
          const lead = {
            id: `seed-${stamp}`,
            nome: `Semente Evento LZ7 ${i + 1}`,
            email: `seed-capi-${stamp}@lz7energia.com.br`,
            telefone: `554399999${String(1000 + i).slice(-4)}`,
            cidade: "Londrina",
            estado: "PR",
            page_url: "https://lz7energia.com.br/quiz",
            user_agent:
              "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
          };
          for (const ev of ["QualifiedLead", "LeadDisqualified"] as const) {
            const r = await sendMetaEvent(ev, lead, { value: 1, settings });
            await persistConversionEvent(null, r, null);
            results.push({
              event: ev,
              ok: r.ok,
              http_status: r.http_status,
              fbtrace_id: r.fbtrace_id,
              response: r.response,
            });
          }
        }

        return Response.json({
          ok: results.every((r) => r.ok),
          pixel: settings.meta_pixel_id,
          results,
        });
      },
    },
  },
});
