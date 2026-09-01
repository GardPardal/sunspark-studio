// Server-only: importa contratos vendidos e cruza a confirmação financeira do Ploomes.
const PLOOMES_API = "https://public-api2.ploomes.com";

function getKey(): string {
  const key = process.env["PLOOMES_USER_KEY"] || process.env["PLOOMES_API_KEY"];
  if (!key) throw new Error("Chave da API do Ploomes não configurada.");
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
  sold: number;
  invoiced: number;
  unmatched: string[];
  sellersCreated: number;
};

/**
 * O pipeline Comercial representa o contrato vendido. O pipeline Financeiro
 * confirma o faturamento do mesmo contrato, identificado pelo código no título.
 */
export async function importPloomesWonSales(sinceDays = 365): Promise<ImportResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const top = 300;
  let skip = 0;
  const wonDeals: any[] = [];
  for (let page = 0; page < 40; page++) {
    const filter = `$filter=StatusId eq 2 and (FinishDate ge ${since} or CreateDate ge ${since})`;
    const path = `/Deals?${filter}&$expand=Contact($expand=City),Owner,Pipeline,Stage,OtherProperties&$orderby=FinishDate desc&$top=${top}&$skip=${skip}`;
    const json = await ploomesGet(path);
    const batch: any[] = json?.value ?? [];
    wonDeals.push(...batch);
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
    const sid =
      u.seller_id ??
      (u.profile_id ? byProfile.get(u.profile_id) : null) ??
      byName.get(norm(u.name));
    if (sid) byPloomesId.set(Number(u.ploomes_id), sid);
  }

  const VERIFIED_SELLER_UNITS: Record<
    string,
    "wenceslau_braz" | "ponta_grossa" | "londrina" | "representantes"
  > = {
    "beatriz moro": "wenceslau_braz",
    "eduarda juraski": "wenceslau_braz",
    "julia azevedo": "wenceslau_braz",
    "pamela martins": "wenceslau_braz",
    "augusto costa": "ponta_grossa",
    "kamily meira": "ponta_grossa",
    "thiago paiva": "ponta_grossa",
    "maycom cristian": "londrina",
    "guilherme luis": "londrina",
    "mycaela silva": "londrina",
    "joao gabriel macedo": "londrina",
    "ademir silva": "londrina",
    "victor hugo victorino": "londrina",
    "matheus henrique": "representantes",
    "anderson miguel": "representantes",
    "adonias pereira da silva": "representantes",
    "katia antunes": "representantes",
  };

  let sellersCreated = 0;
  const unmatched = new Set<string>();

  async function resolveSeller(
    ownerId: number | null,
    ownerName: string | null,
  ): Promise<string | null> {
    if (ownerId && byPloomesId.has(ownerId)) return byPloomesId.get(ownerId) ?? null;
    const n = norm(ownerName);
    if (n && byName.has(n)) {
      const sid = byName.get(n) ?? null;
      if (!sid) return null;
      if (ownerId) byPloomesId.set(ownerId, sid);
      return sid;
    }
    if (ownerName) {
      const unit = VERIFIED_SELLER_UNITS[n] ?? null;
      const { data, error } = await supabaseAdmin
        .from("sales_sellers")
        .insert({ name: ownerName.trim(), unit, active: true })
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
  const CONTRACT_RE = /^[A-Z]{2}\d{6}[A-Z]{3}$/;
  const contractCode = (title: string | null | undefined) => {
    const t =
      (title ?? "")
        .replace(/^Ploomes:\s*/, "")
        .split(" - ")[0]
        ?.trim()
        .toUpperCase() ?? "";
    return CONTRACT_RE.test(t) ? t : "";
  };

  // Campos personalizados do Ploomes usados para classificar a venda.
  // 60047429 = "Origem" (Tráfego pago, Indicação, Prospecção, Reativação...)
  // 60047430 = "Filial" (Londrina, Ponta Grossa, Wenceslau Braz)
  const FIELD_ORIGEM = 60047429;
  const FIELD_FILIAL = 60047430;
  const customField = (deal: any, fieldId: number): string | null => {
    const p = (deal?.OtherProperties ?? []).find((x: any) => x?.FieldId === fieldId);
    return p?.ObjectValueName ?? p?.StringValue ?? null;
  };

  const isPipeline = (deal: any, name: string) => {
    const p = norm(deal?.Pipeline?.Name ?? "");
    if (!p) return name === "comercial";
    if (name === "financeiro") return p.includes("financeiro") || p.includes("faturamento");
    if (name === "comercial") return !p.includes("financeiro") && !p.includes("faturamento");
    return p.includes(name);
  };
  const commercialDeals =
    wonDeals.filter((deal) => isPipeline(deal, "comercial")).length > 0
      ? wonDeals.filter((deal) => isPipeline(deal, "comercial"))
      : wonDeals;

  // Data de faturamento = "Data do início do contrato" (60112093). O FinishDate
  // do funil Financeiro só marca a liquidação do saldo remanescente, meses depois.
  const FIELD_DT_CONTRATO = 60112093;
  const invoiceDateOf = (deal: any): string | null => {
    const p = (deal?.OtherProperties ?? []).find((x: any) => x?.FieldId === FIELD_DT_CONTRATO);
    return p?.DateTimeValue ?? deal?.CreateDate ?? deal?.FinishDate ?? null;
  };

  const invoiceByCode = new Map<string, any>();
  for (const deal of wonDeals) {
    if (!isPipeline(deal, "financeiro")) continue;
    const code = contractCode(deal?.Title);
    if (!code) continue;
    const current = invoiceByCode.get(code);
    if (!current || String(invoiceDateOf(deal) ?? "") < String(invoiceDateOf(current) ?? ""))
      invoiceByCode.set(code, deal);
  }

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

  let invoiced = 0;
  for (const d of commercialDeals) {
    const dealId = Number(d?.Id);
    if (!dealId) continue;
    const amount = Number(d?.Amount ?? 0);
    if (!(amount > 0)) continue;
    const ownerName: string | null = d?.Owner?.Name ?? null;
    const sellerId = await resolveSeller(d?.OwnerId ?? null, ownerName);
    const finish = d?.FinishDate ?? d?.LastUpdateDate ?? d?.CreateDate;
    const saleDate = finish
      ? new Date(finish).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const city = d?.Contact?.City?.Name ?? null;
    const notes = d?.Title ? `Ploomes: ${d.Title}` : "Importado do Ploomes";
    const code = contractCode(d?.Title);
    const codeKey = code ? `${sellerId ?? "-"}|${code}` : null;
    const invoice = code ? invoiceByCode.get(code) : null;
    const invoiceFinish = invoice ? invoiceDateOf(invoice) : null;
    const invoicedDate = invoiceFinish ? new Date(invoiceFinish).toISOString().slice(0, 10) : null;

    if (invoicedDate) invoiced++;

    const payload = {
      seller_id: sellerId,
      sale_date: saleDate,
      amount,
      city,
      notes,
      ploomes_deal_id: dealId,
      // ploomes_invoice_deal_id tem índice único e um mesmo negócio financeiro pode
      // cobrir mais de um contrato comercial — mantemos só a data de faturamento.

      invoiced_date: invoicedDate,
      ploomes_owner_name: ownerName,
      lead_origin: customField(d, FIELD_ORIGEM),
      branch: customField(d, FIELD_FILIAL),
      ploomes_creator_id: d?.CreatorId ?? null,
      updated_at: new Date().toISOString(),
    };

    const found = existingMap.get(dealId) ?? (codeKey ? codeMap.get(codeKey) : undefined);
    if (found) {
      const { error } = await supabaseAdmin.from("manual_sales").update(payload).eq("id", found);
      if (!error) updated++;
    } else {
      const { data: ins, error } = await supabaseAdmin
        .from("manual_sales")
        .insert(payload)
        .select("id")
        .single();
      if (!error && ins) {
        inserted++;
        existingMap.set(dealId, ins.id);
        if (codeKey) codeMap.set(codeKey, ins.id);
      }
    }
  }

  return {
    ok: true,
    fetched: wonDeals.length,
    inserted,
    updated,
    sold: commercialDeals.length,
    invoiced,
    unmatched: [...unmatched],
    sellersCreated,
  };
}
