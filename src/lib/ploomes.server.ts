// Server-only helpers for Ploomes push. Import ONLY from inside server-fn handlers.
const PLOOMES_API = "https://public-api2.ploomes.com";

async function ploomesFetch(path: string, init?: { method?: string; body?: any }): Promise<any> {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) throw new Error("Sem PLOOMES_USER_KEY");
  const res = await fetch(`${PLOOMES_API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "User-Key": key,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Ploomes ${res.status}: ${text.slice(0, 400)}`);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function pushLeadToPloomesInternal(leadId: string) {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "sem chave" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("id, nome, telefone, email, cidade, estado, external_id, external_source")
    .eq("id", leadId)
    .single();
  if (error || !lead) return { ok: false, reason: error?.message ?? "lead não encontrado" };
  if (lead.external_source === "ploomes" && lead.external_id) {
    return { ok: true, skipped: true, reason: "já existe no Ploomes" };
  }

  try {
    const body: any = {
      Name: lead.nome,
      Email: lead.email ?? undefined,
      Phones: lead.telefone ? [{ PhoneNumber: lead.telefone, TypeId: 2, CountryId: 76 }] : [],
      TypeId: 1,
    };
    const created = await ploomesFetch("/Contacts", { method: "POST", body });
    const ploomesId = created?.value?.[0]?.Id ?? created?.Id;
    if (ploomesId) {
      await supabaseAdmin
        .from("leads")
        .update({
          external_source: "ploomes",
          external_id: String(ploomesId),
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", leadId);
    }
    return { ok: true, ploomesId };
  } catch (e: any) {
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_push",
      status: "error",
      message: `lead ${leadId}: ${String(e?.message ?? e).slice(0, 400)}`,
    });
    return { ok: false, reason: e?.message ?? String(e) };
  }
}

export async function upsertLeadFromPloomesContact(contact: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const phone =
    contact.Phones?.find((p: any) => p.PhoneNumber)?.PhoneNumber ??
    contact.Phones?.[0]?.PhoneNumber ??
    "";
  if (!phone) return { ok: false, reason: "sem telefone" };

  const payload = {
    external_source: "ploomes" as const,
    external_id: String(contact.Id),
    nome: (contact.Name ?? "Sem nome").toString().slice(0, 200),
    telefone: String(phone).slice(0, 40),
    email: contact.Email ?? null,
    cidade: contact.City?.Name ?? null,
    estado: contact.City?.StateShortName ?? null,
    origem: "Ploomes",
    last_synced_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin
    .from("leads")
    .upsert(payload, { onConflict: "external_source,external_id" });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

// ============================================================
// Deal (negócio) support: fetch + upsert lead + trigger CAPI
// ============================================================

export async function fetchPloomesDealById(id: number | string) {
  return ploomesFetch(`/Deals(${id})?$expand=Contact($expand=Phones,City),Stage,Pipeline`);
}

export async function fetchPloomesContactById(id: number | string) {
  return ploomesFetch(`/Contacts(${id})?$expand=City,Phones`);
}

// Deal status mapping: Ploomes uses StatusId 1=Open, 2=Won, 3=Lost (padrão)
function stageFromDeal(deal: any): "novo" | "atendimento" | "venda" | "perdido" {
  const won = deal?.Won === true || deal?.StatusId === 2;
  const lost = deal?.StatusId === 3;
  if (won) return "venda";
  if (lost) return "perdido";
  // Se tem stage e não é a primeira, considera em atendimento
  if (deal?.StageId) return "atendimento";
  return "novo";
}

/**
 * Upsert lead a partir de um Deal completo do Ploomes.
 * Retorna o registro atualizado (com stage anterior) para permitir dispatch de conversões.
 */
export async function upsertLeadFromPloomesDeal(deal: any): Promise<{
  ok: boolean;
  reason?: string;
  lead?: any;
  previousStage?: string | null;
  stageChanged?: boolean;
  saleValue?: number | null;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const contact = deal?.Contact ?? null;
  const phone =
    contact?.Phones?.find((p: any) => p.PhoneNumber)?.PhoneNumber ??
    contact?.Phones?.[0]?.PhoneNumber ??
    null;

  if (!contact?.Id) return { ok: false, reason: "deal sem Contact.Id" };
  if (!phone) return { ok: false, reason: "contato sem telefone" };

  const newStage = stageFromDeal(deal);
  const saleValue =
    typeof deal?.Amount === "number"
      ? Number(deal.Amount)
      : deal?.Amount
        ? Number(deal.Amount)
        : null;

  // Procura lead existente por external_id do contato
  const { data: existing } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("external_source", "ploomes")
    .eq("external_id", String(contact.Id))
    .maybeSingle();

  const patch: any = {
    external_source: "ploomes",
    external_id: String(contact.Id),
    nome: (contact.Name ?? existing?.nome ?? "Sem nome").toString().slice(0, 200),
    telefone: String(phone).slice(0, 40),
    email: contact.Email ?? existing?.email ?? null,
    cidade: contact.City?.Name ?? existing?.cidade ?? null,
    estado: contact.City?.StateShortName ?? existing?.estado ?? null,
    origem: existing?.origem ?? "Ploomes",
    ploomes_deal_id: deal?.Id ? Number(deal.Id) : (existing?.ploomes_deal_id ?? null),
    pipeline_id: deal.PipelineId ?? null,
    pipeline_stage_id: deal.StageId ?? null,
    stage: newStage,
    sale_value: saleValue ?? existing?.sale_value ?? null,
    last_synced_at: new Date().toISOString(),
  };

  const { data: upserted, error } = await supabaseAdmin
    .from("leads")
    .upsert(patch, { onConflict: "external_source,external_id" })
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, reason: error.message };

  return {
    ok: true,
    lead: upserted,
    previousStage: existing?.stage ?? null,
    stageChanged: (existing?.stage ?? null) !== newStage,
    saleValue,
  };
}

/**
 * Se o lead entrou em stage relevante, dispara conversões (Meta CAPI + TikTok + GA4)
 * e registra em conversion_events.
 */
export async function fireConversionsForLead(
  lead: any,
  stage: string,
  saleValue: number | null | undefined,
) {
  if (!["novo", "atendimento", "venda", "faturado"].includes(stage)) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settingsRows } = await supabaseAdmin.from("site_settings").select("key,value");
    const settings: Record<string, string> = {};
    for (const r of settingsRows ?? []) settings[r.key] = r.value ?? "";

    const { dispatchStageConversions } = await import("./conversions.server");
    const results = await dispatchStageConversions(
      {
        id: lead.id,
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone,
        cidade: lead.cidade,
        estado: lead.estado,
        gclid: lead.gclid,
        fbp: lead.fbp,
        fbc: lead.fbc,
        user_agent: lead.user_agent,
        page_url: lead.page_url,
        utm_source: lead.utm_source,
        utm_medium: lead.utm_medium,
        utm_campaign: lead.utm_campaign,
        utm_content: lead.utm_content,
        utm_term: lead.utm_term,
      },
      stage,
      saleValue ?? undefined,
      settings,
    );

    if (results.length) {
      await supabaseAdmin.from("conversion_events").insert(
        results.map((r) => ({
          lead_id: lead.id,
          event_name: stage,
          platform: r.platform,
          status: r.status,
          value: saleValue ?? null,
          response: r.response as any,
        })),
      );
    }
  } catch (e) {
    console.error("fireConversionsForLead failed", e);
  }
}

// ============================================================
// Feedback de qualidade do lead (CRM → Meta)
//   - SDR exclui/perde o negócio no Ploomes  → LeadDisqualified
//   - SDR movimenta o negócio no funil       → QualifiedLead
// ============================================================

/** Localiza o lead no nosso banco a partir de um negócio (deal) do Ploomes. */
export async function findLeadByPloomesDeal(
  dealId: number | string | null,
  contactId?: number | string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (dealId) {
    const { data } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("ploomes_deal_id", Number(dealId))
      .maybeSingle();
    if (data) return data;
  }
  if (contactId) {
    const { data } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("external_source", "ploomes")
      .eq("external_id", String(contactId))
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

/**
 * Envia o feedback de qualidade para a Meta (CAPI) e grava o status no lead.
 * Idempotente por status: não reenvia se o lead já está no mesmo estado.
 */
export async function sendLeadQualityFeedback(
  lead: any,
  quality: "qualified" | "disqualified",
  reason: string,
) {
  if (!lead?.id) return { ok: false, reason: "lead inexistente" };
  if (lead.lead_quality === quality) return { ok: true, skipped: true, reason: "já marcado" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: settingsRows } = await supabaseAdmin.from("site_settings").select("key,value");
  const settings: Record<string, string> = {};
  for (const r of settingsRows ?? []) settings[r.key] = r.value ?? "";

  const { sendMetaEvent, persistConversionEvent } = await import("./conversions.server");
  const event = quality === "qualified" ? "QualifiedLead" : "LeadDisqualified";
  const value = quality === "qualified" ? Number(lead.sale_value ?? 0) || 1 : 0;

  const result = await sendMetaEvent(
    event as any,
    {
      id: lead.id,
      nome: lead.nome,
      email: lead.email,
      telefone: lead.telefone,
      cidade: lead.cidade,
      estado: lead.estado,
      fbp: lead.fbp,
      fbc: lead.fbc,
      user_agent: lead.user_agent,
      page_url: lead.page_url,
      utm_source: lead.utm_source,
      utm_medium: lead.utm_medium,
      utm_campaign: lead.utm_campaign,
      utm_content: lead.utm_content,
      utm_term: lead.utm_term,
    },
    { value, settings },
  );

  await persistConversionEvent(lead.id, result, value);

  await supabaseAdmin
    .from("leads")
    .update({
      lead_quality: quality,
      lead_quality_reason: reason.slice(0, 300),
      lead_quality_at: new Date().toISOString(),
    })
    .eq("id", lead.id);

  return { ok: result.ok, event, event_id: result.event_id };
}
