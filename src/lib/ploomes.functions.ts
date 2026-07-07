import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLOOMES_API = "https://public-api2.ploomes.com";

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r: { role: string }) => r.role === "admin"))
    throw new Error("Somente administradores.");
}

function getKey(): string {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) {
    throw new Error(
      "Chave do Ploomes não configurada. Cadastre a secret PLOOMES_USER_KEY no backend.",
    );
  }
  return key;
}

async function ploomesFetch(
  path: string,
  init?: { method?: string; body?: any },
): Promise<any> {
  const key = getKey();
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
  if (!res.ok) {
    throw new Error(`Ploomes ${res.status}: ${text.slice(0, 400)}`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

/* ------------------------------- Diagnóstico ------------------------------- */

export const testPloomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    try {
      const data = await ploomesFetch("/Self?$top=1");
      return {
        ok: true,
        message: "Conexão OK",
        account: data?.value?.[0]?.Email ?? "conectado",
      };
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  });

/* --------------------------- Sincronizar funis ----------------------------- */

export const syncPloomesPipelines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      const pipelines = await ploomesFetch("/Pipelines?$expand=Stages&$top=100");
      const rows = (pipelines.value ?? []).map((p: any) => ({
        id: p.Id,
        name: p.Name,
        stages: (p.Stages ?? []).map((s: any) => ({
          id: s.Id,
          name: s.Name,
          order: s.Order,
        })),
        synced_at: new Date().toISOString(),
      }));

      if (rows.length) {
        const { error } = await supabaseAdmin
          .from("ploomes_pipelines")
          .upsert(rows, { onConflict: "id" });
        if (error) throw new Error(error.message);
      }

      await supabaseAdmin.from("integration_sync_log").insert({
        provider: "ploomes_pipelines",
        status: "success",
        items_imported: rows.length,
        triggered_by: userId,
      });
      return { ok: true, count: rows.length };
    } catch (e: any) {
      await supabaseAdmin.from("integration_sync_log").insert({
        provider: "ploomes_pipelines",
        status: "error",
        message: String(e?.message ?? e).slice(0, 500),
        triggered_by: userId,
      });
      throw e;
    }
  });

/* -------------------------- Sincronizar contatos --------------------------- */

function mapContactToLead(c: any) {
  const phone =
    c.Phones?.find((p: any) => p.PhoneNumber)?.PhoneNumber ??
    c.Phones?.[0]?.PhoneNumber ??
    "";
  return {
    external_source: "ploomes" as const,
    external_id: String(c.Id),
    nome: (c.Name ?? "Sem nome").toString().slice(0, 200),
    telefone: String(phone).slice(0, 40),
    email: c.Email ?? null,
    cidade: c.City?.Name ?? null,
    estado: c.City?.StateShortName ?? null,
    origem: "Ploomes",
    last_synced_at: new Date().toISOString(),
  };
}

export const syncPloomesLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let total = 0;
    let imported = 0;
    let updated = 0;
    let errors = 0;
    const errorSamples: string[] = [];

    try {
      const path =
        "/Contacts?$top=500&$orderby=CreateDate desc&$expand=City,Phones&$filter=Phones/any()";
      const data = await ploomesFetch(path);
      const contacts: any[] = data.value ?? [];
      total = contacts.length;

      // Prepare payloads (skip ones without phone)
      const payloads = contacts
        .map(mapContactToLead)
        .filter((p) => p.telefone && p.telefone.length >= 6);

      if (payloads.length) {
        // Discover which external_ids already exist to count imported vs updated
        const ids = payloads.map((p) => p.external_id);
        const { data: existing } = await supabaseAdmin
          .from("leads")
          .select("external_id")
          .eq("external_source", "ploomes")
          .in("external_id", ids);
        const existingSet = new Set((existing ?? []).map((r: any) => r.external_id));

        // Batch upsert in chunks of 100
        const chunkSize = 100;
        for (let i = 0; i < payloads.length; i += chunkSize) {
          const chunk = payloads.slice(i, i + chunkSize);
          const { error } = await supabaseAdmin
            .from("leads")
            .upsert(chunk, { onConflict: "external_source,external_id" });
          if (error) {
            errors += chunk.length;
            if (errorSamples.length < 3) errorSamples.push(error.message);
            continue;
          }
          for (const p of chunk) {
            if (existingSet.has(p.external_id)) updated++;
            else imported++;
          }
        }
      }

      await supabaseAdmin.from("integration_sync_log").insert({
        provider: "ploomes_leads",
        status: errors ? "partial" : "success",
        items_imported: imported,
        items_updated: updated,
        message: errors ? `${errors} falhas: ${errorSamples.join(" | ")}` : null,
        triggered_by: userId,
      });

      return { ok: true, imported, updated, errors, total };
    } catch (e: any) {
      await supabaseAdmin.from("integration_sync_log").insert({
        provider: "ploomes_leads",
        status: "error",
        items_imported: imported,
        items_updated: updated,
        message: String(e?.message ?? e).slice(0, 500),
        triggered_by: userId,
      });
      throw e;
    }
  });

/* ------------------- Enviar lead local para o Ploomes ---------------------- */

export const pushLeadToPloomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const o = d as { leadId?: string };
    if (!o?.leadId) throw new Error("leadId obrigatório");
    return { leadId: String(o.leadId) };
  })
  .handler(async ({ data }) => {
    const { pushLeadToPloomesInternal } = await import("@/lib/ploomes.server");
    return pushLeadToPloomesInternal(data.leadId);
  });
