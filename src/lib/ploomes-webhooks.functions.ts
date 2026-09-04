// Server functions to manage Ploomes Webhooks via the official API.
// Docs: https://developers.ploomes.com/ (POST /Webhooks, GET /Webhooks, DELETE)
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLOOMES_API = "https://public-api2.ploomes.com";

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r: { role: string }) => r.role === "admin"))
    throw new Error("Somente administradores.");
}

function getKey(): string {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) throw new Error("PLOOMES_USER_KEY não configurada.");
  return key;
}

async function ploomes(path: string, init?: { method?: string; body?: any }) {
  const res = await fetch(`${PLOOMES_API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "User-Key": getKey(),
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

/**
 * Lista todos os webhooks cadastrados no Ploomes.
 */
export const listPloomesWebhooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    try {
      const data = await ploomes("/Webhooks?$top=100");
      return { ok: true, webhooks: data?.value ?? [] };
    } catch (e: any) {
      return { ok: false, message: e.message, webhooks: [] };
    }
  });

/**
 * Registra (se ainda não existir) os webhooks necessários no Ploomes:
 * - Deal criado / atualizado
 * - Contact criado / atualizado
 * Aponta para /api/public/ploomes/webhook do próprio sistema.
 */
export const ensurePloomesWebhooks = createServerFn({ method: "POST" })
  .inputValidator((d: { callbackUrl: string; validationKey?: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const callbackUrl = data.callbackUrl.trim();
    if (!/^https?:\/\//.test(callbackUrl)) {
      return { ok: false, message: "callbackUrl inválida" };
    }

    // Persiste validationKey no site_settings (para o receiver validar)
    const validationKey =
      data.validationKey?.trim() || (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    await supabaseAdmin
      .from("site_settings")
      .upsert({ key: "ploomes:validation_key", value: validationKey }, { onConflict: "key" });

    // EntityIds do Ploomes: Contact=1, Deal=2 (padrão da plataforma).
    // ActionIds: 1=Create, 2=Update, 3=Delete (Ploomes docs).
    const targets = [
      { EntityId: 2, ActionId: 1, label: "Deal.Create" },
      { EntityId: 2, ActionId: 2, label: "Deal.Update" },
      { EntityId: 2, ActionId: 3, label: "Deal.Delete" },
      { EntityId: 1, ActionId: 1, label: "Contact.Create" },
      { EntityId: 1, ActionId: 2, label: "Contact.Update" },
    ];

    let existing: any[] = [];
    try {
      const list = await ploomes("/Webhooks?$top=200");
      existing = list?.value ?? [];
    } catch (e: any) {
      return { ok: false, message: `listar: ${e.message}` };
    }

    const created: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const t of targets) {
      const dupe = existing.find(
        (w: any) =>
          Number(w.EntityId) === t.EntityId &&
          Number(w.ActionId) === t.ActionId &&
          String(w.CallBackUrl ?? w.CallbackUrl ?? "").toLowerCase() === callbackUrl.toLowerCase(),
      );
      if (dupe) {
        skipped.push(t.label);
        continue;
      }
      try {
        await ploomes("/Webhooks", {
          method: "POST",
          body: {
            CallBackUrl: callbackUrl,
            EntityId: t.EntityId,
            ActionId: t.ActionId,
            ValidationKey: validationKey,
          },
        });
        created.push(t.label);
      } catch (e: any) {
        errors.push(`${t.label}: ${e.message}`);
      }
    }

    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_webhook_register",
      status: errors.length ? (created.length ? "partial" : "error") : "success",
      items_imported: created.length,
      message: `created=[${created.join(",")}] skipped=[${skipped.join(",")}]${errors.length ? " errors=" + errors.join(" | ") : ""}`,
    });

    return { ok: errors.length === 0, created, skipped, errors, validationKey };
  });

/**
 * Remove um webhook por Id no Ploomes.
 */
export const deletePloomesWebhook = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number | string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    try {
      await ploomes(`/Webhooks(${data.id})`, { method: "DELETE" });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  });

/**
 * Estatísticas para o painel de monitoramento.
 */
export const getPloomesIntegrationStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      { data: lastHook },
      { data: lastEvent },
      { count: sentToday },
      { data: recentErrors },
      { data: failed },
    ] = await Promise.all([
      supabaseAdmin
        .from("integration_sync_log")
        .select("created_at, status, message")
        .eq("provider", "ploomes_webhook")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("conversion_events")
        .select("created_at, event_name, platform, status, value")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("conversion_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfDay.toISOString()),
      supabaseAdmin
        .from("integration_sync_log")
        .select("created_at, provider, message")
        .in("provider", ["ploomes_webhook", "meta_capi", "conversions"])
        .eq("status", "error")
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("conversion_events")
        .select("id, lead_id, event_name, platform, status, created_at, value")
        .neq("status", "success")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    return {
      ok: true,
      lastWebhook: lastHook ?? null,
      lastMetaEvent: lastEvent ?? null,
      sentToday: sentToday ?? 0,
      recentErrors: recentErrors ?? [],
      failedEvents: failed ?? [],
    };
  });

/**
 * Reenvia (retry) um evento de conversão que falhou.
 */
export const retryConversionEvent = createServerFn({ method: "POST" })
  .inputValidator((d: { eventId: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ev } = await supabaseAdmin
      .from("conversion_events")
      .select("id, lead_id, event_name, value")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev?.lead_id) return { ok: false, message: "evento sem lead" };

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", ev.lead_id)
      .maybeSingle();
    if (!lead) return { ok: false, message: "lead não encontrado" };

    const { fireConversionsForLead } = await import("@/lib/ploomes.server");
    await fireConversionsForLead(lead, ev.event_name ?? lead.stage, ev.value ?? null);
    return { ok: true };
  });

async function requireCrmUser(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (
    !roles.includes("admin") &&
    !roles.includes("consultor") &&
    !roles.includes("coordenador") &&
    !roles.includes("sdr")
  ) {
    throw new Error("Acesso restrito a usuários do CRM.");
  }
}

/**
 * Dispara a sincronização completa de responsáveis, leads e contratos do Ploomes para o Solar OS.
 */
export const triggerPloomesSync = createServerFn({ method: "POST" })
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await requireCrmUser(supabase, userId);
    const { syncAllPloomesDealsToSolarOS } = await import("@/lib/ploomes.server");
    const { importPloomesWonSales } = await import("@/lib/ploomes-sales.server");

    const [dealsRes, salesRes] = await Promise.allSettled([
      syncAllPloomesDealsToSolarOS(data?.limit ?? 500),
      importPloomesWonSales(365),
    ]);

    const deals = dealsRes.status === "fulfilled" ? dealsRes.value : { ok: false, message: dealsRes.reason?.message };
    const sales = salesRes.status === "fulfilled" ? salesRes.value : { ok: false, message: salesRes.reason?.message };

    return {
      ok: deals.ok || sales.ok,
      deals,
      sales,
      leadsSynced: (deals as any)?.upserted ?? (deals as any)?.total ?? 0,
      contractsSold: (sales as any)?.sold ?? 0,
      contractsInvoiced: (sales as any)?.invoiced ?? 0,
      contractsInserted: (sales as any)?.inserted ?? 0,
      contractsUpdated: (sales as any)?.updated ?? 0,
      sellersCreated: (sales as any)?.sellersCreated ?? 0,
      unmatched: (sales as any)?.unmatched ?? [],
    };
  });

