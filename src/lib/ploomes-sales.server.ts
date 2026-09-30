// Server-only: importa contratos vendidos e cruza a confirmação financeira do Ploomes.
// Somente LEITURA no Ploomes (GET). Toda escrita acontece no banco do Solar OS.
const PLOOMES_API = "https://public-api2.ploomes.com";

/**
 * Único funil que representa venda de contrato. Os demais funis (Homologação,
 * Compras, Projetos e Obras, Compensação, Pós-venda...) repetem o valor do mesmo
 * contrato em cada etapa operacional — contá-los inflava as vendas em ~55%.
 */
export const PLOOMES_COMMERCIAL_PIPELINE_ID = 10017344; // Comercial / Energia Solar
/** Funil que confirma o faturamento do contrato (identificado pelo código no título). */
export const PLOOMES_FINANCE_PIPELINE_ID = 60000841; // Financeiro / Energia Solar
/** Funil de execução das obras (ganho = obra concluída; aberto = fila de obras). */
export const PLOOMES_WORKS_PIPELINE_ID = 10017346; // Projetos e Obras / Energia Solar

// Campos personalizados do Ploomes (nomes reais entre parênteses):
// 60047429 ("Como feita a captação do Lead?") = Prospecção, Indicação, Tráfego pago...
// 60047430 ("Origem do Lead") = na prática guarda a filial: Sede Wenceslau Braz, Filial Londrina...
// 60112093 ("Data do início do contrato") = data de faturamento no funil Financeiro.
const FIELD_CAPTACAO = 60047429;
const FIELD_FILIAL = 60047430;
const FIELD_DT_CONTRATO = 60112093;

function getKey(): string {
  const key = process.env["PLOOMES_USER_KEY"] || process.env["PLOOMES_API_KEY"];
  if (!key) throw new Error("Chave da API do Ploomes não configurada.");
  return key;
}

export async function ploomesGet(path: string): Promise<any> {
  const res = await fetch(`${PLOOMES_API}${path}`, {
    method: "GET",
    headers: {
      "User-Key": getKey(),
      Accept: "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Ploomes ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/** Busca todas as páginas de uma consulta OData do Ploomes (somente leitura). */
export async function ploomesGetAll(path: string, top = 300, maxPages = 60): Promise<any[]> {
  const all: any[] = [];
  const sep = path.includes("?") ? "&" : "?";
  for (let page = 0, skip = 0; page < maxPages; page++, skip += top) {
    const json = await ploomesGet(`${path}${sep}$top=${top}&$skip=${skip}`);
    const batch: any[] = json?.value ?? [];
    all.push(...batch);
    if (batch.length < top) break;
  }
  return all;
}

/**
 * Datas do Ploomes já vêm no fuso de Brasília ("2026-05-13T16:02:02-03:00").
 * Converter para UTC jogava vendas do fim do dia para o dia/mês seguinte.
 */
export function ploomesLocalDate(value: string | null | undefined): string | null {
  const s = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

function norm(s: string | null | undefined) {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const CONTRACT_RE = /^[A-Z]{2}\d{6}[A-Z]{3}$/;
/** Código do contrato no título (ex.: "WB260173COL - FULANO (10 KWp)" → "WB260173COL"). */
export function contractCode(title: string | null | undefined) {
  const t =
    (title ?? "")
      .replace(/^Ploomes:\s*/, "")
      .split(" - ")[0]
      ?.trim()
      .toUpperCase() ?? "";
  return CONTRACT_RE.test(t) ? t : "";
}

export type ImportResult = {
  ok: boolean;
  fetched: number;
  inserted: number;
  updated: number;
  removed: number;
  sold: number;
  invoiced: number;
  unmatched: string[];
  sellersCreated: number;
};

/**
 * Espelha em manual_sales os contratos ganhos do funil Comercial / Energia Solar.
 * - sale_date     = data em que o negócio foi ganho (FinishDate)
 * - invoiced_date = "Data do início do contrato" do negócio correspondente no
 *                   funil Financeiro (ganho ou em andamento; perdidos não contam)
 * Linhas importadas antes a partir de outros funis, ou de negócios que deixaram
 * de estar ganhos no Ploomes, são removidas do Solar OS (o Ploomes não é alterado).
 */
export async function importPloomesWonSales(sinceDays = 365): Promise<ImportResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const financeSince = new Date(Date.now() - (sinceDays + 180) * 86400000).toISOString();

  const [wonDeals, financeDeals] = await Promise.all([
    ploomesGetAll(
      `/Deals?$filter=PipelineId eq ${PLOOMES_COMMERCIAL_PIPELINE_ID} and StatusId eq 2 and (FinishDate ge ${since} or CreateDate ge ${since})` +
        `&$select=Id,Title,Amount,FinishDate,CreateDate,LastUpdateDate,OwnerId,CreatorId,StatusId,PipelineId` +
        `&$expand=Contact($select=Id;$expand=City($select=Name)),Owner($select=Id,Name),OtherProperties($filter=FieldId eq ${FIELD_CAPTACAO} or FieldId eq ${FIELD_FILIAL})` +
        `&$orderby=FinishDate desc`,
    ),
    ploomesGetAll(
      `/Deals?$filter=PipelineId eq ${PLOOMES_FINANCE_PIPELINE_ID} and StatusId ne 3 and OtherProperties/any(p: p/FieldId eq ${FIELD_DT_CONTRATO} and p/DateTimeValue ge ${financeSince})` +
        `&$select=Id,Title,StatusId` +
        `&$expand=OtherProperties($filter=FieldId eq ${FIELD_DT_CONTRATO})`,
    ),
  ]);

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

  // Só donos de negócios do funil Comercial chegam aqui, então só vendedores reais são criados.
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

  const customField = (deal: any, fieldId: number): string | null => {
    const p = (deal?.OtherProperties ?? []).find((x: any) => x?.FieldId === fieldId);
    return p?.ObjectValueName ?? p?.StringValue ?? null;
  };

  // Faturamento: data do início do contrato no funil Financeiro, pelo código do contrato.
  const invoiceDateByCode = new Map<string, string>();
  for (const deal of financeDeals) {
    const code = contractCode(deal?.Title);
    if (!code) continue;
    const p = (deal?.OtherProperties ?? []).find((x: any) => x?.FieldId === FIELD_DT_CONTRATO);
    const date = ploomesLocalDate(p?.DateTimeValue);
    if (!date) continue; // sem data de início → ainda não faturado
    const current = invoiceDateByCode.get(code);
    if (!current || date < current) invoiceDateByCode.set(code, date);
  }

  // Linhas já importadas (paginado)
  const existingRows: { id: string; ploomes_deal_id: number }[] = [];
  for (let from = 0; from < 100000; from += 1000) {
    const { data: page } = await supabaseAdmin
      .from("manual_sales")
      .select("id,ploomes_deal_id")
      .not("ploomes_deal_id", "is", null)
      .order("id")
      .range(from, from + 999);
    existingRows.push(...((page ?? []) as any[]));
    if (!page || page.length < 1000) break;
  }
  const existingMap = new Map<number, string>();
  for (const e of existingRows) {
    if (!existingMap.has(Number(e.ploomes_deal_id)))
      existingMap.set(Number(e.ploomes_deal_id), e.id);
  }

  let inserted = 0;
  let updated = 0;
  let invoiced = 0;
  const importedDealIds = new Set<number>();

  for (const d of wonDeals) {
    const dealId = Number(d?.Id);
    if (!dealId) continue;
    const amount = Number(d?.Amount ?? 0);
    if (!(amount > 0)) continue;
    importedDealIds.add(dealId);
    const ownerName: string | null = d?.Owner?.Name ?? null;
    const sellerId = await resolveSeller(d?.OwnerId ?? null, ownerName);
    const saleDate =
      ploomesLocalDate(d?.FinishDate) ??
      ploomesLocalDate(d?.LastUpdateDate) ??
      ploomesLocalDate(d?.CreateDate) ??
      new Date().toISOString().slice(0, 10);
    const code = contractCode(d?.Title);
    const invoicedDate = code ? (invoiceDateByCode.get(code) ?? null) : null;
    if (invoicedDate) invoiced++;

    const payload = {
      seller_id: sellerId,
      sale_date: saleDate,
      amount,
      city: d?.Contact?.City?.Name ?? null,
      notes: d?.Title ? `Ploomes: ${d.Title}` : "Importado do Ploomes",
      ploomes_deal_id: dealId,
      invoiced_date: invoicedDate,
      ploomes_owner_name: ownerName,
      lead_origin: customField(d, FIELD_CAPTACAO),
      branch: customField(d, FIELD_FILIAL),
      ploomes_creator_id: d?.CreatorId ?? null,
      updated_at: new Date().toISOString(),
    };

    const found = existingMap.get(dealId);
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
      }
    }
  }

  // Limpeza no Solar OS: remove linhas vindas de outros funis, de negócios que não
  // estão mais ganhos, ou duplicadas. Cada caso é confirmado no Ploomes antes.
  const toRemove = new Set<string>();
  const keptByDeal = new Map<number, string>();
  const toVerify = new Map<number, string[]>();
  for (const e of existingRows) {
    const dealId = Number(e.ploomes_deal_id);
    if (importedDealIds.has(dealId)) {
      // Mantém uma linha por negócio; as extras são duplicatas.
      const kept = keptByDeal.get(dealId) ?? existingMap.get(dealId);
      if (kept && kept !== e.id) toRemove.add(e.id);
      else keptByDeal.set(dealId, e.id);
      continue;
    }
    const list = toVerify.get(dealId) ?? [];
    list.push(e.id);
    toVerify.set(dealId, list);
  }
  const verifyIds = Array.from(toVerify.keys());
  for (let i = 0; i < verifyIds.length; i += 40) {
    const chunk = verifyIds.slice(i, i + 40);
    const json = await ploomesGet(
      `/Deals?$filter=${chunk.map((id) => `Id eq ${id}`).join(" or ")}&$select=Id,PipelineId,StatusId`,
    );
    const found = new Map<number, any>((json?.value ?? []).map((d: any) => [Number(d.Id), d]));
    for (const id of chunk) {
      const deal = found.get(id);
      const isValidSale =
        deal && deal.PipelineId === PLOOMES_COMMERCIAL_PIPELINE_ID && deal.StatusId === 2;
      // Negócio comercial ganho fora da janela: mantém (histórico antigo continua válido).
      if (isValidSale) continue;
      for (const rowId of toVerify.get(id) ?? []) toRemove.add(rowId);
    }
  }
  let removed = 0;
  const removeIds = Array.from(toRemove);
  for (let i = 0; i < removeIds.length; i += 100) {
    const { error, count } = await supabaseAdmin
      .from("manual_sales")
      .delete({ count: "exact" })
      .in("id", removeIds.slice(i, i + 100));
    if (!error) removed += count ?? 0;
  }

  return {
    ok: true,
    fetched: wonDeals.length,
    inserted,
    updated,
    removed,
    sold: importedDealIds.size,
    invoiced,
    unmatched: [...unmatched],
    sellersCreated,
  };
}

/* ================= Obras (funil Projetos e Obras) ================= */

export type WorksMetrics = {
  /** Obras concluídas (negócio ganho) no ano, por mês (índice 0 = janeiro). */
  entreguesPorMes: number[];
  entreguesAno: number;
  /** Obras em andamento no funil (negócios abertos). */
  fila: number;
};

const UNIT_PREFIX: Record<string, string> = {
  wenceslau_braz: "WB",
  londrina: "LD",
  ponta_grossa: "PG",
};

let worksCache: { key: string; at: number; data: { won: any[]; open: any[] } } | null = null;
const WORKS_TTL_MS = 10 * 60_000;

/**
 * Lê as obras direto do Ploomes (somente GET), com cache de 10 min.
 * Filtro por unidade usa a sigla do código do contrato no título (WB/LD/PG).
 */
export async function getPloomesWorksMetrics(
  year: number,
  unit: string | null,
): Promise<WorksMetrics | null> {
  if (unit && !UNIT_PREFIX[unit]) return null; // representantes: sem sigla própria
  const key = String(year);
  if (!worksCache || worksCache.key !== key || Date.now() - worksCache.at > WORKS_TTL_MS) {
    const [won, open] = await Promise.all([
      ploomesGetAll(
        `/Deals?$filter=PipelineId eq ${PLOOMES_WORKS_PIPELINE_ID} and StatusId eq 2 and FinishDate ge ${year}-01-01T00:00:00-03:00&$select=Id,Title,FinishDate`,
      ),
      ploomesGetAll(
        `/Deals?$filter=PipelineId eq ${PLOOMES_WORKS_PIPELINE_ID} and StatusId eq 1&$select=Id,Title`,
      ),
    ]);
    worksCache = { key, at: Date.now(), data: { won, open } };
  }
  const prefix = unit ? UNIT_PREFIX[unit] : null;
  const ofUnit = (d: any) =>
    !prefix ||
    String(d?.Title ?? "")
      .toUpperCase()
      .startsWith(prefix);
  const entreguesPorMes = Array.from({ length: 12 }, () => 0);
  for (const d of worksCache.data.won) {
    if (!ofUnit(d)) continue;
    const date = ploomesLocalDate(d?.FinishDate);
    if (!date || !date.startsWith(String(year))) continue;
    entreguesPorMes[Number(date.slice(5, 7)) - 1]++;
  }
  return {
    entreguesPorMes,
    entreguesAno: entreguesPorMes.reduce((s, n) => s + n, 0),
    fila: worksCache.data.open.filter(ofUnit).length,
  };
}
