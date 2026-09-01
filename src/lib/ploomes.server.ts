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
  return ploomesFetch(`/Deals(${id})?$expand=Contact($expand=Phones,City),Stage,Pipeline,Owner`);
}

export async function fetchPloomesContactById(id: number | string) {
  return ploomesFetch(`/Contacts(${id})?$expand=City,Phones`);
}

function normString(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve o responsável (Owner do Ploomes) para um UUID de profile no Solar OS.
 */
export async function resolvePloomesOwnerToProfile(
  ownerId?: number | null,
  ownerName?: string | null,
  ownerEmail?: string | null,
): Promise<string | null> {
  if (!ownerId && !ownerName && !ownerEmail) return null;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Busca por ploomes_id na tabela ploomes_users
    if (ownerId) {
      const { data: pu } = await supabaseAdmin
        .from("ploomes_users")
        .select("profile_id, seller_id")
        .eq("ploomes_id", Number(ownerId))
        .maybeSingle();

      if (pu?.profile_id) return pu.profile_id;
    }

    // 2. Busca por e-mail no profiles
    if (ownerEmail?.trim()) {
      const { data: profByEmail } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", ownerEmail.trim())
        .maybeSingle();

      if (profByEmail?.id) return profByEmail.id;
    }

    // 3. Busca por nome no profiles
    if (ownerName?.trim()) {
      const { data: allProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name");

      const targetNorm = normString(ownerName);
      const match = (allProfiles ?? []).find(
        (p: any) => p.full_name && normString(p.full_name) === targetNorm,
      );
      if (match?.id) return match.id;
    }

    return null;
  } catch (e) {
    console.error("[resolvePloomesOwnerToProfile] Error:", e);
    return null;
  }
}

// Deal status mapping: Ploomes uses StatusId 1=Open, 2=Won, 3=Lost (padrão)
function stageFromDeal(deal: any): "novo" | "atendimento" | "venda" | "perdido" {
  const won = deal?.Won === true || deal?.StatusId === 2;
  const lost = deal?.StatusId === 3;
  if (won) return "venda";
  if (lost) return "perdido";
  if (deal?.StageId) return "atendimento";
  return "novo";
}

/**
 * Upsert lead a partir de um Deal completo do Ploomes.
 * Mapeia e vincula o responsável (consultor/SDR), dados de contato, etapa e valor.
 */
export async function upsertLeadFromPloomesDeal(deal: any): Promise<{
  ok: boolean;
  reason?: string;
  lead?: any;
  previousStage?: string | null;
  stageChanged?: boolean;
  saleValue?: number | null;
  assignedTo?: string | null;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const contact = deal?.Contact ?? null;
  const phone =
    contact?.Phones?.find((p: any) => p.PhoneNumber)?.PhoneNumber ??
    contact?.Phones?.[0]?.PhoneNumber ??
    "";

  const cleanPhone = phone ? phone.replace(/\D/g, "") : "";
  const email = contact?.Email ?? deal?.Email ?? null;
  const name = (deal?.Title ?? contact?.Name ?? "Lead Ploomes").toString().slice(0, 200);

  const newStage = stageFromDeal(deal);
  const saleValue =
    typeof deal?.Amount === "number"
      ? Number(deal.Amount)
      : deal?.Amount
        ? Number(deal.Amount)
        : null;

  // Resolve o consultor responsável
  const ownerId = deal?.OwnerId ?? deal?.Owner?.Id ?? deal?.User?.Id ?? null;
  const ownerName = deal?.Owner?.Name ?? deal?.User?.Name ?? null;
  const ownerEmail = deal?.Owner?.Email ?? deal?.User?.Email ?? null;
  const assignedTo = await resolvePloomesOwnerToProfile(ownerId, ownerName, ownerEmail);

  // 1. Procura lead existente por ploomes_deal_id
  let existing: any = null;
  if (deal?.Id) {
    const { data: byDeal } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("ploomes_deal_id", Number(deal.Id))
      .maybeSingle();
    if (byDeal) existing = byDeal;
  }

  // 2. Procura por external_id do contato
  if (!existing && contact?.Id) {
    const { data: byContact } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("external_source", "ploomes")
      .eq("external_id", String(contact.Id))
      .maybeSingle();
    if (byContact) existing = byContact;
  }

  // 3. Procura por telefone (se tiver pelo menos 8 dígitos)
  if (!existing && cleanPhone.length >= 8) {
    const { data: byPhone } = await supabaseAdmin
      .from("leads")
      .select("*")
      .ilike("telefone", `%${cleanPhone.slice(-8)}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byPhone) existing = byPhone;
  }

  // 4. Procura por email
  if (!existing && email?.trim()) {
    const { data: byEmail } = await supabaseAdmin
      .from("leads")
      .select("*")
      .ilike("email", email.trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byEmail) existing = byEmail;
  }

  const patch: any = {
    nome: name || existing?.nome || "Lead Ploomes",
    telefone: phone || existing?.telefone || "",
    email: email ?? existing?.email ?? null,
    cidade: contact?.City?.Name ?? existing?.cidade ?? null,
    estado: contact?.City?.StateShortName ?? existing?.estado ?? null,
    origem: existing?.origem ?? "Ploomes",
    ploomes_deal_id: deal?.Id ? Number(deal.Id) : (existing?.ploomes_deal_id ?? null),
    external_id: contact?.Id ? String(contact.Id) : (existing?.external_id ?? null),
    external_source: "ploomes",
    pipeline_id: deal.PipelineId ?? existing?.pipeline_id ?? null,
    pipeline_stage_id: deal.StageId ?? existing?.pipeline_stage_id ?? null,
    stage: newStage,
    sale_value: saleValue ?? existing?.sale_value ?? null,
    assigned_to: assignedTo ?? existing?.assigned_to ?? null,
    last_synced_at: new Date().toISOString(),
  };

  let upserted: any = null;
  if (existing?.id) {
    const { data: updated, error } = await supabaseAdmin
      .from("leads")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return { ok: false, reason: error.message };
    upserted = updated;
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from("leads")
      .insert(patch)
      .select("*")
      .single();
    if (error) return { ok: false, reason: error.message };
    upserted = inserted;
  }

  return {
    ok: true,
    lead: upserted,
    previousStage: existing?.stage ?? null,
    stageChanged: (existing?.stage ?? null) !== newStage,
    saleValue,
    assignedTo,
  };
}

/**
 * Sincronização em massa de negócios do Ploomes para o Solar OS.
 * Puxa os dados atualizados do Ploomes sem alterar nada no Ploomes.
 */
export async function syncAllPloomesDealsToSolarOS(
  limit = 500,
): Promise<{
  ok: boolean;
  totalFetched: number;
  synced: number;
  assignedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let synced = 0;
  let assignedCount = 0;

  // 1. Sincroniza primeiro a lista de usuários/responsáveis
  try {
    const { runPloomesUsersSync } = await import("./ploomes-users.server");
    await runPloomesUsersSync(true);
  } catch (e: any) {
    errors.push(`sync users: ${e?.message ?? e}`);
  }

  // 2. Busca os negócios do Ploomes com contatos, etapas e responsáveis
  let deals: any[] = [];
  try {
    const res = await ploomesFetch(
      `/Deals?$expand=Contact($expand=Phones,City),Stage,Pipeline,Owner&$orderby=LastInteractionRecordDate desc,CreateDate desc&$top=${limit}`,
    );
    deals = res?.value ?? [];
  } catch (e: any) {
    errors.push(`fetch deals: ${e?.message ?? e}`);
    return { ok: false, totalFetched: 0, synced: 0, assignedCount: 0, errors };
  }

  // 3. Processa cada negócio para o Solar OS
  for (const deal of deals) {
    try {
      const res = await upsertLeadFromPloomesDeal(deal);
      if (res.ok) {
        synced++;
        if (res.assignedTo) assignedCount++;
      } else if (res.reason && errors.length < 10) {
        errors.push(`deal ${deal.Id}: ${res.reason}`);
      }
    } catch (e: any) {
      if (errors.length < 10) {
        errors.push(`deal ${deal?.Id}: ${e?.message ?? e}`);
      }
    }
  }

  return {
    ok: true,
    totalFetched: deals.length,
    synced,
    assignedCount,
    errors,
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

/**
 * Sincroniza a mudança de etapa/status do lead para o Deal correspondente no Ploomes.
 */
export async function syncStageToPloomes(
  leadId: string,
  stage: string,
  options?: { saleValue?: number | null; saleNotes?: string | null },
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "sem chave" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, ploomes_deal_id, external_id, external_source, nome, telefone, email, sale_value")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { ok: false, reason: "lead não encontrado" };

  const dealId = lead.ploomes_deal_id;
  if (!dealId) {
    return { ok: true, skipped: true, reason: "lead sem ploomes_deal_id" };
  }

  try {
    const patchBody: Record<string, unknown> = {};

    if (stage === "venda" || stage === "faturado") {
      patchBody.StatusId = 2; // Won (Ganho)
      patchBody.FinishDate = new Date().toISOString();
      if (options?.saleValue != null) patchBody.Amount = options.saleValue;
    } else if (stage === "perdido") {
      patchBody.StatusId = 3; // Lost (Perdido)
      patchBody.FinishDate = new Date().toISOString();
    } else {
      patchBody.StatusId = 1; // Open (Aberto)
    }

    if (Object.keys(patchBody).length > 0) {
      await ploomesFetch(`/Deals(${dealId})`, {
        method: "PATCH",
        body: patchBody,
      });
    }

    if (options?.saleNotes?.trim()) {
      await syncInteractionToPloomes(leadId, {
        title: `Mudança de etapa: ${stage}`,
        content: options.saleNotes.trim(),
      });
    }

    return { ok: true };
  } catch (e: any) {
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_stage_sync",
      status: "error",
      message: `deal ${dealId}: ${String(e?.message ?? e).slice(0, 400)}`,
    });
    return { ok: false, reason: e?.message ?? String(e) };
  }
}

/**
 * Cria um registro de interação (histórico/timeline) no Ploomes para o contato/deal.
 */
export async function syncInteractionToPloomes(
  leadId: string,
  interaction: { title: string; content: string },
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "sem chave" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, external_id, ploomes_deal_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { ok: false, reason: "lead não encontrado" };
  const contactId = lead.external_id ? Number(lead.external_id) : null;
  const dealId = lead.ploomes_deal_id ? Number(lead.ploomes_deal_id) : null;

  if (!contactId && !dealId) {
    return { ok: true, skipped: true, reason: "lead sem vínculo no Ploomes" };
  }

  try {
    const body: Record<string, unknown> = {
      Title: interaction.title.slice(0, 200),
      Content: interaction.content.slice(0, 2000),
      Date: new Date().toISOString(),
      TypeId: 1,
    };
    if (contactId) body.ContactId = contactId;
    if (dealId) body.DealId = dealId;

    await ploomesFetch("/InteractionRecords", {
      method: "POST",
      body,
    });

    return { ok: true };
  } catch (e: any) {
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_interaction_sync",
      status: "error",
      message: `lead ${leadId}: ${String(e?.message ?? e).slice(0, 400)}`,
    });
    return { ok: false, reason: e?.message ?? String(e) };
  }
}

/**
 * Cria uma Tarefa / Compromisso (Task) no calendário do Ploomes.
 */
export async function syncTaskToPloomes(
  leadId: string,
  task: { title: string; dateTime: string; typeId?: number },
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "sem chave" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, external_id, ploomes_deal_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { ok: false, reason: "lead não encontrado" };
  const contactId = lead.external_id ? Number(lead.external_id) : null;
  const dealId = lead.ploomes_deal_id ? Number(lead.ploomes_deal_id) : null;

  if (!contactId && !dealId) {
    return { ok: true, skipped: true, reason: "lead sem vínculo no Ploomes" };
  }

  try {
    const body: Record<string, unknown> = {
      Title: task.title.slice(0, 200),
      DateTime: task.dateTime,
      TypeId: task.typeId ?? 1,
    };
    if (contactId) body.ContactId = contactId;
    if (dealId) body.DealId = dealId;

    await ploomesFetch("/Tasks", {
      method: "POST",
      body,
    });

    return { ok: true };
  } catch (e: any) {
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_task_sync",
      status: "error",
      message: `lead ${leadId}: ${String(e?.message ?? e).slice(0, 400)}`,
    });
    return { ok: false, reason: e?.message ?? String(e) };
  }
}

/**
 * Sincroniza alterações cadastrais do lead (nome, telefone, e-mail, valor) com o Contato e Deal no Ploomes.
 */
export async function syncLeadDataToPloomes(
  leadId: string,
  patch: {
    nome?: string;
    telefone?: string;
    email?: string | null;
    cidade?: string | null;
    estado?: string | null;
    sale_value?: number | null;
    sale_notes?: string | null;
  },
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "sem chave" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, external_id, ploomes_deal_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { ok: false, reason: "lead não encontrado" };
  const contactId = lead.external_id ? Number(lead.external_id) : null;
  const dealId = lead.ploomes_deal_id ? Number(lead.ploomes_deal_id) : null;

  try {
    if (contactId && (patch.nome || patch.email !== undefined || patch.telefone)) {
      const contactPatch: Record<string, unknown> = {};
      if (patch.nome) contactPatch.Name = patch.nome;
      if (patch.email !== undefined) contactPatch.Email = patch.email ?? "";
      if (patch.telefone) {
        contactPatch.Phones = [{ PhoneNumber: patch.telefone, TypeId: 2, CountryId: 76 }];
      }
      await ploomesFetch(`/Contacts(${contactId})`, {
        method: "PATCH",
        body: contactPatch,
      });
    }

    if (dealId && patch.sale_value != null) {
      await ploomesFetch(`/Deals(${dealId})`, {
        method: "PATCH",
        body: { Amount: patch.sale_value },
      });
    }

    if (patch.sale_notes?.trim()) {
      await syncInteractionToPloomes(leadId, {
        title: "Atualização de dados no Solar OS",
        content: patch.sale_notes.trim(),
      });
    }

    return { ok: true };
  } catch (e: any) {
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_data_sync",
      status: "error",
      message: `lead ${leadId}: ${String(e?.message ?? e).slice(0, 400)}`,
    });
    return { ok: false, reason: e?.message ?? String(e) };
  }
}


