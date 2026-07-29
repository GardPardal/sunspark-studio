// Server-only Ploomes → base local sync for Meta Custom Audiences.
// Uses ONLY the Ploomes REST API (no webhooks). Import from server handlers only.

const PLOOMES_API = "https://public-api2.ploomes.com";
const ENTITY_CONTACTS = "ploomes_audience_contacts";
const ENTITY_DEALS = "ploomes_audience_deals";
const MIN_SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 min throttle

function getKey(): string {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) throw new Error("PLOOMES_USER_KEY não configurada");
  return key;
}

async function ploomesGet(path: string): Promise<any> {
  const res = await fetch(`${PLOOMES_API}${path}`, {
    headers: {
      "User-Key": getKey(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Ploomes ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/** Ploomes usa OData; datas em ISO com sufixo Z. */
function odataDate(d: Date): string {
  return d.toISOString();
}

type SyncResult = {
  ok: boolean;
  entity: string;
  imported: number;
  updated: number;
  pages: number;
  since: string | null;
  message?: string;
};

async function readState(entity: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("meta_sync_state")
    .select("*")
    .eq("entity", entity)
    .maybeSingle();
  return data;
}

async function writeState(entity: string, patch: Record<string, any>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("meta_sync_state")
    .upsert({ entity, ...patch }, { onConflict: "entity" });
}

/**
 * Sincroniza Contatos alterados desde a última execução.
 * Usa OData $filter=LastUpdateDate gt <iso> quando disponível.
 * Paginado via $top/$skip.
 */
export async function syncPloomesContactsIncremental(force = false): Promise<SyncResult> {
  const { upsertLeadFromPloomesContact } = await import("./ploomes.server");
  const state = await readState(ENTITY_CONTACTS);
  const lastRun = state?.last_run_at ? new Date(state.last_run_at) : null;

  if (!force && lastRun && Date.now() - lastRun.getTime() < MIN_SYNC_INTERVAL_MS) {
    return {
      ok: true,
      entity: ENTITY_CONTACTS,
      imported: 0,
      updated: 0,
      pages: 0,
      since: lastRun.toISOString(),
      message: "throttled",
    };
  }

  const startedAt = new Date();
  const sinceIso = lastRun ? odataDate(new Date(lastRun.getTime() - 60_000)) : null;
  const filter = sinceIso ? `&$filter=LastUpdateDate gt ${sinceIso}` : "";
  const top = 300;
  let skip = 0;
  let pages = 0;
  let imported = 0;
  let updated = 0;
  let errorMessage: string | null = null;

  try {
    // limite defensivo: até 20 páginas por execução (6k registros)
    for (let i = 0; i < 20; i++) {
      const path = `/Contacts?$expand=City,Phones&$orderby=LastUpdateDate asc&$top=${top}&$skip=${skip}${filter}`;
      const page = await ploomesGet(path);
      const rows: any[] = page?.value ?? [];
      pages++;
      if (rows.length === 0) break;
      for (const c of rows) {
        const r = await upsertLeadFromPloomesContact(c);
        if (r?.ok) {
          if ((r as any).created) imported++;
          else updated++;
        }
      }
      if (rows.length < top) break;
      skip += top;
    }

    await writeState(ENTITY_CONTACTS, {
      last_run_at: startedAt.toISOString(),
      last_status: "ok",
      last_message: `${imported} novos + ${updated} atualizados em ${pages} página(s)`,
      items_processed: imported + updated,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_audience",
      status: "ok",
      items_imported: imported,
      items_updated: updated,
      message: `contacts ${imported}/${updated} em ${pages}p (desde ${sinceIso ?? "início"})`,
    });

    return {
      ok: true,
      entity: ENTITY_CONTACTS,
      imported,
      updated,
      pages,
      since: sinceIso,
    };
  } catch (e: any) {
    errorMessage = e?.message ?? String(e);
    await writeState(ENTITY_CONTACTS, {
      last_run_at: startedAt.toISOString(),
      last_status: "error",
      last_message: errorMessage?.slice(0, 400),
      items_processed: imported + updated,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_audience",
      status: "error",
      items_imported: imported,
      items_updated: updated,
      message: errorMessage?.slice(0, 400) ?? "erro desconhecido",
    });
    return {
      ok: false,
      entity: ENTITY_CONTACTS,
      imported,
      updated,
      pages,
      since: sinceIso,
      message: errorMessage ?? undefined,
    };
  }
}

/**
 * Sincroniza Deals alterados desde a última execução para refletir Won/Lost/Stage.
 * Reutiliza upsertLeadFromPloomesDeal (não dispara CAPI aqui — só atualiza base).
 */
export async function syncPloomesDealsIncremental(force = false): Promise<SyncResult> {
  const { upsertLeadFromPloomesDeal } = await import("./ploomes.server");
  const state = await readState(ENTITY_DEALS);
  const lastRun = state?.last_run_at ? new Date(state.last_run_at) : null;

  if (!force && lastRun && Date.now() - lastRun.getTime() < MIN_SYNC_INTERVAL_MS) {
    return {
      ok: true,
      entity: ENTITY_DEALS,
      imported: 0,
      updated: 0,
      pages: 0,
      since: lastRun.toISOString(),
      message: "throttled",
    };
  }

  const startedAt = new Date();
  const sinceIso = lastRun ? odataDate(new Date(lastRun.getTime() - 60_000)) : null;
  const filter = sinceIso ? `&$filter=LastUpdateDate gt ${sinceIso}` : "";
  const top = 200;
  let skip = 0;
  let pages = 0;
  let processed = 0;
  let errorMessage: string | null = null;

  try {
    for (let i = 0; i < 20; i++) {
      const path = `/Deals?$expand=Contact($expand=Phones,City),Stage,Pipeline&$orderby=LastUpdateDate asc&$top=${top}&$skip=${skip}${filter}`;
      const page = await ploomesGet(path);
      const rows: any[] = page?.value ?? [];
      pages++;
      if (rows.length === 0) break;
      for (const d of rows) {
        const r = await upsertLeadFromPloomesDeal(d);
        if (r?.ok) processed++;
      }
      if (rows.length < top) break;
      skip += top;
    }

    await writeState(ENTITY_DEALS, {
      last_run_at: startedAt.toISOString(),
      last_status: "ok",
      last_message: `${processed} deals processados em ${pages} página(s)`,
      items_processed: processed,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_audience",
      status: "ok",
      items_imported: 0,
      items_updated: processed,
      message: `deals ${processed} em ${pages}p (desde ${sinceIso ?? "início"})`,
    });
    return { ok: true, entity: ENTITY_DEALS, imported: 0, updated: processed, pages, since: sinceIso };
  } catch (e: any) {
    errorMessage = e?.message ?? String(e);
    await writeState(ENTITY_DEALS, {
      last_run_at: startedAt.toISOString(),
      last_status: "error",
      last_message: errorMessage?.slice(0, 400),
      items_processed: processed,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_audience",
      status: "error",
      items_imported: 0,
      items_updated: processed,
      message: errorMessage?.slice(0, 400) ?? "erro desconhecido",
    });
    return {
      ok: false,
      entity: ENTITY_DEALS,
      imported: 0,
      updated: processed,
      pages,
      since: sinceIso,
      message: errorMessage ?? undefined,
    };
  }
}

/** Executa as duas syncs em sequência (contatos + deals). */
export async function syncPloomesAudienceAll(force = false) {
  const contacts = await syncPloomesContactsIncremental(force);
  const deals = await syncPloomesDealsIncremental(force);
  return { contacts, deals };
}

/* -------------------------------------------------------------------------- */
/* CSV — Meta Custom Audience                                                  */
/* -------------------------------------------------------------------------- */

export type AudienceKind = "qualified" | "customers";

const QUALIFIED_STAGES = ["atendimento", "venda", "faturado"];
const CUSTOMER_STAGES = ["venda", "faturado"];

function splitName(full: string | null | undefined): { fn: string; ln: string } {
  const raw = (full ?? "").trim();
  if (!raw) return { fn: "", ln: "" };
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return { fn: parts[0], ln: "" };
  return { fn: parts[0], ln: parts.slice(1).join(" ") };
}

/** Normaliza telefone para E.164 aproximado (assume BR quando 10-11 dígitos). */
function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

function csvEscape(v: string): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Gera CSV de público personalizado a partir dos leads sincronizados do Ploomes.
 * Colunas seguem o padrão da Meta Custom Audience File Upload:
 * email, phone, fn, ln, city, state, country, zip, external_id
 * (Meta aplica o hash SHA-256 no upload; enviamos em texto plano normalizado.)
 */
export async function buildAudienceCsv(kind: AudienceKind): Promise<{ csv: string; rows: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const stages = kind === "customers" ? CUSTOMER_STAGES : QUALIFIED_STAGES;

  // Paginação defensiva (Supabase default 1000)
  const all: any[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 50_000; offset += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("id, nome, telefone, email, cidade, estado, external_id, external_source, stage")
      .eq("external_source", "ploomes")
      .in("stage", stages)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }

  const header = ["email", "phone", "fn", "ln", "city", "state", "country", "zip", "external_id"];
  const seen = new Set<string>();
  const lines: string[] = [header.join(",")];

  for (const l of all) {
    const email = (l.email ?? "").toString().trim().toLowerCase();
    const phone = normalizePhone(l.telefone);
    const { fn, ln } = splitName(l.nome);
    const city = (l.cidade ?? "").toString().trim().toLowerCase();
    const state = (l.estado ?? "").toString().trim().toLowerCase();
    const externalId = l.external_id ?? l.id;
    // deduplica por (email|phone|external_id)
    const dedupeKey = `${email}|${phone}|${externalId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    // pula linhas totalmente sem identificador
    if (!email && !phone) continue;
    lines.push(
      [
        email,
        phone,
        fn.toLowerCase(),
        ln.toLowerCase(),
        city,
        state,
        email || phone ? "br" : "",
        "",
        externalId,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  return { csv: lines.join("\n") + "\n", rows: lines.length - 1 };
}
