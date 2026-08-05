// Server-only: importa negócios GANHOS (faturados) do Ploomes e atribui a vendedores.
const PLOOMES_API = "https://public-api2.ploomes.com";

function getKey(): string {
  const key = process.env["PLOOMES_USER_KEY"] || process.env["PLOOMES_API_KEY"];
  if (!key) throw new Error("Chave da API do Ploomes não configurada.");
  return key;
}

async function ploomesGet(path: string): Promise<any> {
  const res = await fetch(`${PLOOMES_API}${path}`, {
    headers: { "User-Key": getKey(), Accept: "application/json", "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Ploomes ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

function norm(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type ImportResult = {
  ok: boolean;
  fetched: number;
  inserted: number;
  updated: number;
  unmatched: string[];
  sellersCreated: number;
};

/**
 * Busca deals com StatusId = 2 (ganho/faturado) desde `sinceDays` dias e grava em manual_sales.
 * Deduplica por ploomes_deal_id.
 */
export async function importPloomesWonSales(sinceDays = 365): Promise<ImportResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const top = 300;
  let skip = 0;
  const deals: any[] = [];
  for (let page = 0; page < 20; page++) {
    const filter = `$filter=StatusId eq 2 and FinishDate ge ${since}`;
    const path = `/Deals?${filter}&$expand=Contact($expand=City),Owner&$orderby=FinishDate desc&$top=${top}&$skip=${skip}`;
    const json = await ploomesGet(path);
    const batch: any[] = json?.value ?? [];
    deals.push(...batch);
    if (batch.length < top) break;
    skip += top;
  }

  // Mapas de vendedores
  const { data: sellers } = await supabaseAdmin
    .from("sales_sellers")
    .select("id,name,profile_id,active");
  const { data: pusers } = await supabaseAdmin
    .from("ploomes_users")
    .select("ploomes_id,name,seller_id,profile_id");

  const byPloomesId = new Map<number, string>();
  const byProfile = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const s of sellers ?? []) {
    byName.set(norm(s.name), s.id);
    if (s.profile_id) byProfile.set(s.profile_id, s.id);
  }
  for (const u of pusers ?? []) {
    const sid = u.seller_id ?? (u.profile_id ? byProfile.get(u.profile_id) : null) ?? byName.get(norm(u.name));
    if (sid) byPloomesId.set(Number(u.ploomes_id), sid);
  }

  let sellersCreated = 0;
  const unmatched = new Set<string>();

  async function resolveSeller(ownerId: number | null, ownerName: string | null): Promise<string | null> {
    if (ownerId && byPloomesId.has(ownerId)) return byPloomesId.get(ownerId)!;
    const n = norm(ownerName);
    if (n && byName.has(n)) {
      const sid = byName.get(n)!;
      if (ownerId) byPloomesId.set(ownerId, sid);
      return sid;
    }
    if (ownerName) {
      const { data, error } = await supabaseAdmin
        .from("sales_sellers")
        .insert({ name: ownerName.trim(), active: true })
        .select("id")
        .single();
      if (!error && data) {
        sellersCreated++;
        byName.set(n, data.id);
        if (ownerId) byPloomesId.set(ownerId, data.id);
        return data.id;
      }
    }
    if (ownerName) unmatched.add(ownerName);
    return null;
  }

  // Dedup: por Id do negócio e também pelo código do contrato (ex.: "WB260173COL"),
  // já que o Ploomes cria vários negócios para o mesmo projeto/contrato.
  const contractCode = (title: string | null | undefined) => {
    const t = (title ?? "").replace(/^Ploomes:\s*/, "").split(" - ")[0]?.trim() ?? "";
    return t;
  };

  const existingMap = new Map<number, string>();
  const codeMap = new Map<string, string>();
  for (let from = 0; from < 50000; from += 1000) {
    const { data: page } = await supabaseAdmin
      .from("manual_sales")
      .select("id,ploomes_deal_id,notes,seller_id")
      .not("ploomes_deal_id", "is", null)
      .range(from, from + 999);
    for (const e of page ?? []) {
      existingMap.set(Number(e.ploomes_deal_id), e.id);
      const code = contractCode(e.notes);
      if (code) codeMap.set(`${e.seller_id ?? "-"}|${code}`, e.id);
    }
    if (!page || page.length < 1000) break;
  }

  let inserted = 0;
  let updated = 0;

  for (const d of deals) {
    const dealId = Number(d?.Id);
    if (!dealId) continue;
    const amount = Number(d?.Amount ?? 0);
    if (!(amount > 0)) continue;
    const ownerName: string | null = d?.Owner?.Name ?? null;
    const sellerId = await resolveSeller(d?.OwnerId ?? null, ownerName);
    const finish = d?.FinishDate ?? d?.LastUpdateDate ?? d?.CreateDate;
    const saleDate = finish ? new Date(finish).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const city = d?.Contact?.City?.Name ?? null;
    const notes = d?.Title ? `Ploomes: ${d.Title}` : "Importado do Ploomes";
    const code = contractCode(d?.Title);
    const codeKey = code ? `${sellerId ?? "-"}|${code}` : null;

    const payload = {
      seller_id: sellerId,
      sale_date: saleDate,
      amount,
      city,
      notes,
      ploomes_deal_id: dealId,
      ploomes_owner_name: ownerName,
      updated_at: new Date().toISOString(),
    };

    const found = existingMap.get(dealId) ?? (codeKey ? codeMap.get(codeKey) : undefined);
    if (found) {
      const { error } = await supabaseAdmin.from("manual_sales").update(payload).eq("id", found);
      if (!error) updated++;
    } else {
      const { data: ins, error } = await supabaseAdmin.from("manual_sales").insert(payload).select("id").single();
      if (!error && ins) {
        inserted++;
        existingMap.set(dealId, ins.id);
        if (codeKey) codeMap.set(codeKey, ins.id);
      }
    }
  }

  return { ok: true, fetched: deals.length, inserted, updated, unmatched: [...unmatched], sellersCreated };
}
