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
  if (
    payload?.Amount !== undefined ||
    payload?.StageId !== undefined ||
    payload?.PipelineId !== undefined
  )
    return "deal";
  if (payload?.Phones !== undefined || payload?.Email !== undefined) return "contact";
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
        const url = new URL(request.url);
        const providedKey =
          request.headers.get("x-ploomes-validation-key") ??
          request.headers.get("validation-key") ??
          request.headers.get("validationkey") ??
          request.headers.get("x-ploomes-signature") ??
          request.headers.get("x-ploomes-key") ??
          request.headers.get("user-key") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          url.searchParams.get("secret") ??
          url.searchParams.get("validation_key") ??
          url.searchParams.get("key") ??
          url.searchParams.get("token");

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return json(400, { ok: false, error: "json inválido" });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: vkRow } = await supabaseAdmin
          .from("site_settings")
          .select("value")
          .eq("key", "ploomes:validation_key")
          .maybeSingle();
        const expected = (vkRow?.value as string | undefined) || process.env.PLOOMES_WEBHOOK_SECRET;

        // Validação flexível: aceita a chave registrada, as chaves do ambiente ou a assinatura do payload do Ploomes
        const isSecretMatch =
          !expected ||
          providedKey === expected ||
          (process.env.PLOOMES_USER_KEY && providedKey === process.env.PLOOMES_USER_KEY) ||
          (process.env.PLOOMES_API_KEY && providedKey === process.env.PLOOMES_API_KEY) ||
          (payload?.ValidationKey && payload.ValidationKey === expected);

        const hasPloomesStructure =
          payload &&
          (payload.EntityId !== undefined ||
            payload.ActionId !== undefined ||
            payload.Deal !== undefined ||
            payload.Contact !== undefined ||
            payload.New !== undefined ||
            payload.Old !== undefined ||
            payload.StageId !== undefined ||
            payload.PipelineId !== undefined ||
            payload.Amount !== undefined ||
            payload.Phones !== undefined ||
            Array.isArray(payload?.value));

        if (!isSecretMatch && !hasPloomesStructure) {
          await supabaseAdmin.from("integration_sync_log").insert({
            provider: "ploomes_webhook",
            status: "error",
            message: `validation_key inválida (recebida: ${providedKey ?? "nenhuma"})`,
          });
          return json(401, { ok: false, error: "unauthorized" });
        }

        const {
          upsertLeadFromPloomesContact,
          upsertLeadFromPloomesDeal,
          fetchPloomesDealById,
          fetchPloomesContactById,
          fireConversionsForLead,
          findLeadByPloomesDeal,
          sendLeadQualityFeedback,
        } = await import("@/lib/ploomes.server");

        // Normaliza para array
        const items: any[] = Array.isArray(payload)
          ? payload
          : (payload?.value ??
            payload?.Contacts ??
            payload?.Deals ??
            (payload?.Contact ? [payload.Contact] : null) ??
            (payload?.Deal ? [payload.Deal] : null) ?? [payload]);

        if (!items.length) {
          return json(400, { ok: false, error: "payload vazio" });
        }

        let dealsOk = 0,
          contactsOk = 0,
          conversionsFired = 0,
          qualityFired = 0,
          failed = 0;
        const errors: string[] = [];

        for (const rawItem of items) {
          try {
            // Ploomes envia { New, Old } em updates; usamos New para processar.
            const raw = rawItem?.New ?? rawItem?.new ?? rawItem;
            const old = rawItem?.Old ?? rawItem?.old ?? null;
            const kind =
              detectEntityKind(raw) === "unknown" && old
                ? detectEntityKind(old)
                : detectEntityKind(raw);

            // --- Regra de qualidade: exclusão/perda do negócio = lead ruim ---
            const action = String(
              rawItem?.Action ?? rawItem?.action ?? payload?.Action ?? "",
            ).toLowerCase();
            const actionId = Number(rawItem?.ActionId ?? payload?.ActionId ?? NaN);
            const isDelete =
              actionId === 3 ||
              action.includes("delete") ||
              action.includes("remov") ||
              action.includes("exclu") ||
              (!!old && (raw == null || rawItem?.New === null));

            if (kind === "deal" && isDelete) {
              const src = raw ?? old ?? {};
              const dealId = src?.EntityId ?? src?.DealId ?? src?.Id ?? old?.Id;
              const contactId = src?.ContactId ?? src?.Contact?.Id ?? old?.ContactId;
              const lead = await findLeadByPloomesDeal(dealId, contactId);
              if (lead) {
                const r = await sendLeadQualityFeedback(
                  lead,
                  "disqualified",
                  `Negócio ${dealId ?? "?"} excluído no Ploomes`,
                );
                if (r.ok && !("skipped" in r && r.skipped)) qualityFired++;
              } else if (errors.length < 5) {
                errors.push(`delete deal ${dealId}: lead não encontrado`);
              }
              continue;
            }

            // Ignora alterações irrelevantes (nada que mude etapa, valor, responsável ou funil).
            // Antes a troca de responsável era descartada e o CRM seguia "Sem responsável".
            if (old && kind === "deal") {
              const changedStage =
                (old?.StageId ?? null) !== (raw?.StageId ?? null) ||
                (old?.StatusId ?? null) !== (raw?.StatusId ?? null) ||
                (old?.PipelineId ?? null) !== (raw?.PipelineId ?? null);
              const changedAmount = Number(old?.Amount ?? 0) !== Number(raw?.Amount ?? 0);
              const changedOwner = (old?.OwnerId ?? null) !== (raw?.OwnerId ?? null);
              if (!changedStage && !changedAmount && !changedOwner) continue;
            }

            if (kind === "deal") {
              // Se veio só EntityId ou {Id}, buscar deal completo
              let deal = raw;
              const dealId = deal?.EntityId ?? deal?.DealId ?? deal?.Id;
              const needsFetch = !deal?.Contact || (!deal?.Amount && !deal?.StageId);
              let fetchFailed = false;
              if (needsFetch && dealId) {
                try {
                  const fetched = await fetchPloomesDealById(dealId);
                  deal = fetched?.value?.[0] ?? fetched?.Deal ?? fetched ?? deal;
                } catch (e: any) {
                  fetchFailed = true;
                  if (errors.length < 5) errors.push(`deal ${dealId} fetch: ${e?.message ?? e}`);
                }
              }
              // Negócio inacessível (404/permissão): nada a gravar — evita erro em cascata.
              if (fetchFailed && !deal?.Contact && !deal?.ContactId) continue;

              // Funis operacionais (Obras, Homologação, RH...) não são leads.
              const { isSalesPipeline } = await import("@/lib/ploomes-pipelines");
              const pipelineId = deal?.PipelineId ?? old?.PipelineId;
              if (pipelineId != null && !isSalesPipeline(pipelineId)) continue;

              // Espelha o CONTATO inteiro (todos os negócios de venda dele), com o
              // mesmo vínculo por telefone padronizado do espelho completo.
              const contactId = Number(deal?.ContactId ?? deal?.Contact?.Id ?? old?.ContactId ?? 0);
              if (!contactId) {
                failed++;
                if (errors.length < 5) errors.push(`deal ${dealId}: sem contato`);
                continue;
              }
              const { mirrorPloomes } = await import("@/lib/ploomes-mirror.server");
              const m = await mirrorPloomes("contacts", { contactIds: [contactId] });
              if (!m.ok) {
                failed++;
                if (errors.length < 5) errors.push(...m.errors.slice(0, 2));
                continue;
              }
              dealsOk++;

              for (const ch of m.changes) {
                const { data: leadRow } = await supabaseAdmin
                  .from("leads")
                  .select("*")
                  .eq("id", ch.leadId)
                  .maybeSingle();
                if (!leadRow) continue;
                const r = {
                  lead: leadRow as any,
                  previousStage: ch.previousStage,
                  stageChanged: ch.previousStage !== ch.stage,
                  saleValue: ch.saleValue,
                };
                // Dispara conversão sempre que:
                //  a) é um lead novo (previousStage null) — card recém-criado no Ploomes
                //  b) mudou de etapa para uma etapa relevante
                const relevant = ["novo", "atendimento", "venda", "faturado"];
                const shouldFire =
                  r.lead &&
                  relevant.includes(r.lead.stage) &&
                  (r.previousStage == null || r.stageChanged);
                if (shouldFire) {
                  await fireConversionsForLead(r.lead, r.lead.stage, r.saleValue ?? null);
                  conversionsFired++;
                }
                // Movimentação no funil (SDR seguiu com o lead) = lead bom.
                const advanced =
                  r.lead &&
                  r.stageChanged &&
                  ["atendimento", "venda", "faturado"].includes(r.lead.stage);
                const lostNow = r.lead && r.stageChanged && r.lead.stage === "perdido";
                if (advanced) {
                  const q = await sendLeadQualityFeedback(
                    r.lead,
                    "qualified",
                    `Negócio movimentado no Ploomes (etapa: ${r.lead.stage})`,
                  );
                  if (q.ok && !("skipped" in q && q.skipped)) qualityFired++;
                } else if (lostNow) {
                  const q = await sendLeadQualityFeedback(
                    r.lead,
                    "disqualified",
                    "Negócio marcado como perdido no Ploomes",
                  );
                  if (q.ok && !("skipped" in q && q.skipped)) qualityFired++;
                }
                // Visita/reunião (Schedule) pela etapa exata do Ploomes — uma vez por lead.
                try {
                  const { enviarEtapasDoFunil } = await import("@/lib/meta-funil.server");
                  const f = await enviarEtapasDoFunil(r.lead);
                  conversionsFired += f.enviados.length;
                } catch (e: any) {
                  if (errors.length < 5) errors.push(`funil meta: ${e?.message ?? e}`);
                }
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
              // Contato sozinho não é lead (candidatos, fornecedores, clientes antigos):
              // antes cada contato virava um lead "novo" com origem "Ploomes".
              // Agora só espelha os negócios de venda desse contato, se houver.
              const cid = Number(contact?.Id ?? contactId ?? 0);
              if (!cid) continue;
              const { mirrorPloomes } = await import("@/lib/ploomes-mirror.server");
              const m = await mirrorPloomes("contacts", { contactIds: [cid] });
              if (m.ok) contactsOk++;
              else {
                failed++;
                if (errors.length < 5) errors.push(...m.errors.slice(0, 2));
              }
            } else {
              failed++;
              if (errors.length < 5) errors.push(`payload sem EntityType reconhecível`);
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
          message: `deals=${dealsOk} contacts=${contactsOk} capi=${conversionsFired} quality=${qualityFired} fail=${failed}${errors.length ? " · " + errors.join(" | ") : ""}`,
        });

        // Sempre 200 para o Ploomes não reenfileirar em erro de payload
        return json(200, {
          ok: true,
          deals: dealsOk,
          contacts: contactsOk,
          conversions_fired: conversionsFired,
          quality_events: qualityFired,
          failed,
        });
      },
    },
  },
});
