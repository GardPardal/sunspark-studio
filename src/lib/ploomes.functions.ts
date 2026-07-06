import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLOOMES_API = "https://public-api2.ploomes.com";

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Somente administradores.");
}

function getKey(): string {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) {
    throw new Error(
      "Chave do Ploomes não configurada. Cadastre a secret PLOOMES_USER_KEY no backend (Painel → Ploomes → Configurar chave).",
    );
  }
  return key;
}

async function ploomesFetch(path: string): Promise<any> {
  const key = getKey();
  const res = await fetch(`${PLOOMES_API}${path}`, {
    headers: { "User-Key": key, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ploomes ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/* ------------------------------- Diagnóstico ------------------------------- */

export const testPloomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    try {
      // /Self retorna o usuário dono da User-Key
      const data = await ploomesFetch("/Self?$top=1");
      return { ok: true, message: "Conexão OK", account: data?.value?.[0]?.Email ?? "conectado" };
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

    const pipelines = await ploomesFetch("/Pipelines?$expand=Stages&$top=100");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows = (pipelines.value ?? []).map((p: any) => ({
      id: p.Id,
      name: p.Name,
      stages: (p.Stages ?? []).map((s: any) => ({ id: s.Id, name: s.Name, order: s.Order })),
      synced_at: new Date().toISOString(),
    }));

    if (rows.length) {
      const { error } = await supabaseAdmin.from("ploomes_pipelines").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_pipelines",
      status: "success",
      items_imported: rows.length,
      triggered_by: userId,
    });

    return { ok: true, count: rows.length };
  });

/* -------------------------- Sincronizar contatos --------------------------- */
/**
 * Puxa contatos do Ploomes e cria/atualiza leads locais com
 * external_source='ploomes' + external_id. Idempotente via unique index.
 */
export const syncPloomesLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);

    // Pega até 500 contatos mais recentes com telefone.
    // $expand=City para pegar nome da cidade; Phones para telefone principal.
    const path =
      "/Contacts?$top=500&$orderby=CreateDate desc&$expand=City,Phones&$filter=Phones/any()";
    const data = await ploomesFetch(path);
    const contacts: any[] = data.value ?? [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let imported = 0;
    let updated = 0;
    const nowIso = new Date().toISOString();

    for (const c of contacts) {
      const phone = c.Phones?.[0]?.PhoneNumber ?? "";
      if (!phone) continue;

      const payload = {
        external_source: "ploomes",
        external_id: String(c.Id),
        nome: c.Name ?? "Sem nome",
        telefone: phone,
        email: c.Email ?? null,
        cidade: c.City?.Name ?? null,
        estado: c.City?.StateShortName ?? null,
        origem: "Ploomes",
        last_synced_at: nowIso,
      };

      // upsert por (external_source, external_id) via unique index
      const { error, data: up } = await supabaseAdmin
        .from("leads")
        .upsert(payload, { onConflict: "external_source,external_id" })
        .select("id, created_at");
      if (error) throw new Error(error.message);
      if (up && up[0]) {
        // se created_at == last_synced_at, é novo
        if (Math.abs(new Date(up[0].created_at).getTime() - Date.now()) < 5000) imported++;
        else updated++;
      }
    }

    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_leads",
      status: "success",
      items_imported: imported,
      items_updated: updated,
      triggered_by: userId,
    });

    return { ok: true, imported, updated, total: contacts.length };
  });
