import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Ploomes-Signature, X-Ploomes-Validation-Key",
};

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/**
 * Detecta o tipo do payload do Ploomes.
 * Ploomes envia eventos como { EntityId, EntityType, Action, ... } ou objetos brutos.
 */
function detectEntityKind(payload: any): "deal" | "contact" | "unknown" {
  const type = String(
    payload?.EntityType ?? payload?.Entity ?? payload?.entity ?? "",
  ).toLowerCase();
  if (type.includes("deal")) return "deal";
  if (type.includes("contact")) return "contact";
  // Heurística por campos
  if (payload?.Amount !== undefined || payload?.StageId !== undefined || payload?.PipelineId !== undefined)
    return "deal";
  if (payload?.Phones !== undefined || payload?.Email !== undefined)
    return "contact";
  return "unknown";
}

export const Route = createFileRoute("/api/public/ploomes/webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async () =>
        json(200, {
          ok: true,
          hint: "POST aqui com o payload do Ploomes (Contact ou Deal). Aceita ?secret= ou header X-Ploomes-Signature.",
        }),

      POST: async ({ request }) => {
        const secret = process.env.PLOOMES_WEBHOOK_SECRET;
        if (secret) {
          const url = new URL(request.url);
          const provided =
            request.headers.get("x-ploomes-signature") ??
            request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
            url.searchParams.get("secret");
          if (provided !== secret) {
            return json(401, { ok: false, error: "unauthorized" });
          }
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return json(400, { ok: false, error: "json inválido" });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const {
          upsertLeadFromPloomesContact,
          upsertLeadFromPloomesDeal,
          fetchPloomesDealById,
          fetchPloomesContactById,
          fireConversionsForLead,
        } = await import("@/lib/ploomes.server");

        // Normaliza para array
        const items: any[] = Array.isArray(payload)
          ? payload
          : (payload?.value ??
            payload?.Contacts ??
            payload?.Deals ??
            (payload?.Contact ? [payload.Contact] : null) ??
            (payload?.Deal ? [payload.Deal] : null) ??
            [payload]);

        if (!items.length) {
          return json(400, { ok: false, error: "payload vazio" });
        }

        let dealsOk = 0,
          contactsOk = 0,
          conversionsFired = 0,
          failed = 0;
        const errors: string[] = [];

        for (const raw of items) {
          try {
            const kind = detectEntityKind(raw);

            if (kind === "deal") {
              // Se veio só EntityId ou {Id}, buscar deal completo
              let deal = raw;
              const dealId = deal?.EntityId ?? deal?.DealId ?? deal?.Id;
              const needsFetch =
                !deal?.Contact || (!deal?.Amount && !deal?.StageId);
              if (needsFetch && dealId) {
                try {
                  const fetched = await fetchPloomesDealById(dealId);
                  deal =
                    fetched?.value?.[0] ??
                    fetched?.Deal ??
                    fetched ??
                    deal;
                } catch (e: any) {
                  errors.push(`deal ${dealId} fetch: ${e?.message ?? e}`);
                }
              }
              const r = await upsertLeadFromPloomesDeal(deal);
              if (!r.ok) {
                failed++;
                if (errors.length < 5 && r.reason) errors.push(r.reason);
                continue;
              }
              dealsOk++;
              // Dispara conversão sempre que:
              //  a) é um lead novo (previousStage null) — card recém-criado no Ploomes
              //  b) mudou de etapa para uma etapa relevante
              const relevant = ["novo", "atendimento", "venda", "faturado"];
              const shouldFire =
                r.lead &&
                relevant.includes(r.lead.stage) &&
                (r.previousStage == null || r.stageChanged);
              if (shouldFire) {
                await fireConversionsForLead(
                  r.lead,
                  r.lead.stage,
                  r.saleValue ?? null,
                );
                conversionsFired++;
              }
            } else if (kind === "contact") {
              let contact = raw;
              const contactId = contact?.EntityId ?? contact?.Id;
              if (!contact?.Phones && contactId) {
                try {
                  const fetched = await fetchPloomesContactById(contactId);
                  contact = fetched?.value?.[0] ?? fetched ?? contact;
                } catch {
                  /* segue com o que veio */
                }
              }
              const r = await upsertLeadFromPloomesContact(contact);
              if (r.ok) contactsOk++;
              else {
                failed++;
                if (errors.length < 5 && r.reason) errors.push(r.reason);
              }
            } else {
              failed++;
              if (errors.length < 5)
                errors.push(`payload sem EntityType reconhecível`);
            }
          } catch (e: any) {
            failed++;
            if (errors.length < 5) errors.push(String(e?.message ?? e));
          }
        }

        await supabaseAdmin.from("integration_sync_log").insert({
          provider: "ploomes_webhook",
          status: failed ? (dealsOk + contactsOk ? "partial" : "error") : "success",
          items_imported: dealsOk + contactsOk,
          message: `deals=${dealsOk} contacts=${contactsOk} capi=${conversionsFired} fail=${failed}${errors.length ? " · " + errors.join(" | ") : ""}`,
        });

        // Sempre 200 para o Ploomes não reenfileirar em erro de payload
        return json(200, {
          ok: true,
          deals: dealsOk,
          contacts: contactsOk,
          conversions_fired: conversionsFired,
          failed,
        });
      },
    },
  },
});
