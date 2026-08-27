// Exporta insights diários do Meta Ads para o Google Sheets do Alison.
// Planilha: LZ7 - Insights Meta Ads (diário)
export const META_SHEET_ID = "15gejpeTwXJYfsMYPSfvtPuiw4UlknwZueZjsGSxOCW8";
export const META_SHEET_URL = `https://docs.google.com/spreadsheets/d/${META_SHEET_ID}/edit`;

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

const HEADERS = [
  "Data",
  "Campanha",
  "Campaign ID",
  "Gasto (R$)",
  "Impressões",
  "Alcance",
  "Cliques",
  "CTR (%)",
  "CPC (R$)",
  "CPM (R$)",
  "Frequência",
  "Leads",
  "CPL (R$)",
  "Compras",
  "Receita (R$)",
  "ROAS",
];

function gatewayHeaders() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conn = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovable || !conn) throw new Error("Credenciais do Google Sheets ausentes.");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": conn,
    "Content-Type": "application/json",
  };
}

async function sheetsFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...gatewayHeaders(), ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Google Sheets falhou [${res.status}]: ${text}`);
    throw new Error(`Google Sheets falhou [${res.status}]: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Data (YYYY-MM-DD) de "ontem" no fuso de São Paulo. */
export function yesterdaySaoPaulo(): string {
  const now = new Date(Date.now() - 3 * 3600_000); // UTC-3
  const y = new Date(now.getTime() - 86400_000);
  return y.toISOString().slice(0, 10);
}

export async function exportMetaInsightsToSheet(date?: string) {
  const day = date ?? yesterdaySaoPaulo();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows, error } = await supabaseAdmin
    .from("meta_insights_daily")
    .select(
      "date, campaign_id, spend, impressions, reach, clicks, ctr, cpc, cpm, frequency, leads, purchases, purchase_value",
    )
    .eq("date", day);
  if (error) throw error;

  const ids = Array.from(
    new Set((rows ?? []).map((r: any) => r.campaign_id).filter(Boolean)),
  ) as string[];
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: camps } = await supabaseAdmin
      .from("meta_campaigns")
      .select("id, name")
      .in("id", ids);
    for (const c of camps ?? []) nameById.set(c.id, c.name ?? c.id);
  }

  // Agrega por campanha (a tabela pode ter granularidade por anúncio)
  const agg = new Map<string, any>();
  for (const r of rows ?? []) {
    const cid = r.campaign_id ?? "(sem campanha)";
    const cur = agg.get(cid) ?? {
      spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0,
      purchases: 0, revenue: 0, freq: 0,
    };
    cur.spend += Number(r.spend ?? 0);
    cur.impressions += Number(r.impressions ?? 0);
    cur.reach += Number(r.reach ?? 0);
    cur.clicks += Number(r.clicks ?? 0);
    cur.leads += Number(r.leads ?? 0);
    cur.purchases += Number(r.purchases ?? 0);
    cur.revenue += Number(r.purchase_value ?? 0);
    cur.freq = Math.max(cur.freq, Number(r.frequency ?? 0));
    agg.set(cid, cur);
  }

  const values = Array.from(agg.entries()).map(([cid, a]) => [
    day,
    nameById.get(cid) ?? cid,
    cid,
    round(a.spend),
    a.impressions,
    a.reach,
    a.clicks,
    a.impressions > 0 ? round((a.clicks / a.impressions) * 100) : 0,
    a.clicks > 0 ? round(a.spend / a.clicks) : 0,
    a.impressions > 0 ? round((a.spend / a.impressions) * 1000) : 0,
    round(a.freq),
    a.leads,
    a.leads > 0 ? round(a.spend / a.leads) : 0,
    a.purchases,
    round(a.revenue),
    a.spend > 0 ? round(a.revenue / a.spend) : 0,
  ]);

  // Garante cabeçalho
  const head = await sheetsFetch(`/spreadsheets/${META_SHEET_ID}/values/Diario!A1:P1`);
  if (!head.values?.length) {
    await sheetsFetch(
      `/spreadsheets/${META_SHEET_ID}/values/Diario!A1:P1?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: [HEADERS] }) },
    );
  }

  if (!values.length) return { date: day, rows: 0, url: META_SHEET_URL };

  // Remove linhas já existentes desse dia (evita duplicar em re-execuções)
  const existing = await sheetsFetch(`/spreadsheets/${META_SHEET_ID}/values/Diario!A2:A`);
  const dupIdx: number[] = [];
  (existing.values ?? []).forEach((r: string[], i: number) => {
    if (r?.[0] === day) dupIdx.push(i + 1); // índice 0-based da linha na grade
  });
  if (dupIdx.length) {
    const meta = await sheetsFetch(`/spreadsheets/${META_SHEET_ID}`);
    const sheetId = (meta.sheets ?? []).find(
      (s: any) => s.properties?.title === "Diario",
    )?.properties?.sheetId;
    if (sheetId != null) {
      const requests = dupIdx
        .sort((a, b) => b - a)
        .map((i) => ({
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: i, endIndex: i + 1 },
          },
        }));
      await sheetsFetch(`/spreadsheets/${META_SHEET_ID}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({ requests }),
      });
    }
  }

  await sheetsFetch(
    `/spreadsheets/${META_SHEET_ID}/values/Diario!A1:P1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values }) },
  );

  // Resumo do dia
  const t = values.reduce(
    (s, v) => ({
      spend: s.spend + Number(v[3]), impressions: s.impressions + Number(v[4]),
      clicks: s.clicks + Number(v[6]), leads: s.leads + Number(v[11]),
      purchases: s.purchases + Number(v[13]), revenue: s.revenue + Number(v[14]),
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, revenue: 0 },
  );
  await sheetsFetch(
    `/spreadsheets/${META_SHEET_ID}/values/Resumo!A1:H2?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({
        values: [
          ["Dia", "Gasto (R$)", "Impressões", "Cliques", "Leads", "CPL (R$)", "Receita (R$)", "ROAS"],
          [
            day,
            round(t.spend),
            t.impressions,
            t.clicks,
            t.leads,
            t.leads > 0 ? round(t.spend / t.leads) : 0,
            round(t.revenue),
            t.spend > 0 ? round(t.revenue / t.spend) : 0,
          ],
        ],
      }),
    },
  );

  return { date: day, rows: values.length, url: META_SHEET_URL };
}
