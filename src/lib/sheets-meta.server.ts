// Exporta insights diários do Meta Ads para o Google Sheets do Alison.
// Planilha: LZ7 - Insights Meta Ads (diário)
export const META_SHEET_ID = "15gejpeTwXJYfsMYPSfvtPuiw4UlknwZueZjsGSxOCW8";
export const META_SHEET_URL = `https://docs.google.com/spreadsheets/d/${META_SHEET_ID}/edit`;

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

const HEADERS = [
  "Data",
  "Conta",
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

const COLORS = {
  navy: { red: 0.055, green: 0.106, blue: 0.176 },
  yellow: { red: 0.984, green: 0.749, blue: 0.141 },
  white: { red: 1, green: 1, blue: 1 },
  soft: { red: 0.949, green: 0.961, blue: 0.973 },
  green: { red: 0.063, green: 0.725, blue: 0.506 },
  dark: { red: 0.102, green: 0.118, blue: 0.149 },
};

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

function totalRows(values: any[][]) {
  return values.reduce(
    (s, v) => ({
      spend: s.spend + Number(v[4]),
      impressions: s.impressions + Number(v[5]),
      clicks: s.clicks + Number(v[7]),
      leads: s.leads + Number(v[12]),
      purchases: s.purchases + Number(v[14]),
      revenue: s.revenue + Number(v[15]),
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, revenue: 0 },
  );
}

function summaryRow(label: string, values: any[][]) {
  const t = totalRows(values);
  return [
    label,
    round(t.spend),
    t.impressions,
    t.clicks,
    t.leads,
    t.leads > 0 ? round(t.spend / t.leads) : 0,
    t.purchases,
    round(t.revenue),
    t.spend > 0 ? round(t.revenue / t.spend) : 0,
  ];
}

async function formatWorkbook(diarioSheetId: number, resumoSheetId: number, dailyRows: number) {
  const requests: any[] = [
    {
      updateSpreadsheetProperties: {
        properties: { locale: "pt_BR", timeZone: "America/Sao_Paulo" },
        fields: "locale,timeZone",
      },
    },
    {
      updateSheetProperties: {
        properties: {
          sheetId: diarioSheetId,
          gridProperties: { frozenRowCount: 1, frozenColumnCount: 2 },
          tabColorStyle: { rgbColor: COLORS.yellow },
        },
        fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount,tabColorStyle",
      },
    },
    {
      repeatCell: {
        range: { sheetId: diarioSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 17 },
        cell: {
          userEnteredFormat: {
            backgroundColorStyle: { rgbColor: COLORS.navy },
            textFormat: { foregroundColorStyle: { rgbColor: COLORS.white }, bold: true, fontSize: 10 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: diarioSheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 42 },
        fields: "pixelSize",
      },
    },
    {
      setBasicFilter: {
        filter: { range: { sheetId: diarioSheetId, startRowIndex: 0, endRowIndex: Math.max(dailyRows + 1, 2), startColumnIndex: 0, endColumnIndex: 17 } },
      },
    },
    {
      repeatCell: {
        range: { sheetId: diarioSheetId, startRowIndex: 1, endRowIndex: Math.max(dailyRows + 1, 2), startColumnIndex: 4, endColumnIndex: 17 },
        cell: { userEnteredFormat: { horizontalAlignment: "RIGHT" } },
        fields: "userEnteredFormat.horizontalAlignment",
      },
    },
    {
      repeatCell: {
        range: { sheetId: diarioSheetId, startRowIndex: 1, endRowIndex: Math.max(dailyRows + 1, 2), startColumnIndex: 4, endColumnIndex: 5 },
        cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "R$ #,##0.00" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    },
    {
      repeatCell: {
        range: { sheetId: diarioSheetId, startRowIndex: 1, endRowIndex: Math.max(dailyRows + 1, 2), startColumnIndex: 8, endColumnIndex: 9 },
        cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "0.00\"%\"" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    },
    {
      repeatCell: {
        range: { sheetId: diarioSheetId, startRowIndex: 1, endRowIndex: Math.max(dailyRows + 1, 2), startColumnIndex: 9, endColumnIndex: 11 },
        cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "R$ #,##0.00" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    },
    {
      repeatCell: {
        range: { sheetId: diarioSheetId, startRowIndex: 1, endRowIndex: Math.max(dailyRows + 1, 2), startColumnIndex: 13, endColumnIndex: 14 },
        cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "R$ #,##0.00" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    },
    {
      repeatCell: {
        range: { sheetId: diarioSheetId, startRowIndex: 1, endRowIndex: Math.max(dailyRows + 1, 2), startColumnIndex: 15, endColumnIndex: 16 },
        cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "R$ #,##0.00" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: diarioSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 17 },
        properties: { pixelSize: 110 },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: diarioSheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 3 },
        properties: { pixelSize: 220 },
        fields: "pixelSize",
      },
    },
    {
      updateSheetProperties: {
        properties: { sheetId: resumoSheetId, gridProperties: { frozenRowCount: 4 }, tabColorStyle: { rgbColor: COLORS.green } },
        fields: "gridProperties.frozenRowCount,tabColorStyle",
      },
    },
    {
      repeatCell: {
        range: { sheetId: resumoSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 9 },
        cell: { userEnteredFormat: { backgroundColorStyle: { rgbColor: COLORS.navy }, textFormat: { foregroundColorStyle: { rgbColor: COLORS.white }, bold: true, fontSize: 18 }, verticalAlignment: "MIDDLE" } },
        fields: "userEnteredFormat",
      },
    },
    {
      repeatCell: {
        range: { sheetId: resumoSheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 9 },
        cell: { userEnteredFormat: { backgroundColorStyle: { rgbColor: COLORS.navy }, textFormat: { foregroundColorStyle: { rgbColor: COLORS.yellow }, italic: true, fontSize: 10 }, verticalAlignment: "MIDDLE" } },
        fields: "userEnteredFormat",
      },
    },
    {
      repeatCell: {
        range: { sheetId: resumoSheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 9 },
        cell: { userEnteredFormat: { backgroundColorStyle: { rgbColor: COLORS.yellow }, textFormat: { foregroundColorStyle: { rgbColor: COLORS.dark }, bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } },
        fields: "userEnteredFormat",
      },
    },
    {
      repeatCell: {
        range: { sheetId: resumoSheetId, startRowIndex: 4, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 9 },
        cell: { userEnteredFormat: { backgroundColorStyle: { rgbColor: COLORS.white }, verticalAlignment: "MIDDLE" } },
        fields: "userEnteredFormat.backgroundColorStyle,userEnteredFormat.verticalAlignment",
      },
    },
    {
      repeatCell: {
        range: { sheetId: resumoSheetId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 9 },
        cell: { userEnteredFormat: { backgroundColorStyle: { rgbColor: COLORS.soft }, textFormat: { bold: true } } },
        fields: "userEnteredFormat.backgroundColorStyle,userEnteredFormat.textFormat.bold",
      },
    },
    {
      repeatCell: {
        range: { sheetId: resumoSheetId, startRowIndex: 4, endRowIndex: 7, startColumnIndex: 1, endColumnIndex: 2 },
        cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "R$ #,##0.00" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    },
    {
      repeatCell: {
        range: { sheetId: resumoSheetId, startRowIndex: 4, endRowIndex: 7, startColumnIndex: 5, endColumnIndex: 6 },
        cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "R$ #,##0.00" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    },
    {
      repeatCell: {
        range: { sheetId: resumoSheetId, startRowIndex: 4, endRowIndex: 7, startColumnIndex: 7, endColumnIndex: 8 },
        cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "R$ #,##0.00" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: resumoSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 9 },
        properties: { pixelSize: 130 },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: resumoSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 230 },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: resumoSheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 48 },
        fields: "pixelSize",
      },
    },
  ];

  await sheetsFetch(`/spreadsheets/${META_SHEET_ID}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
}

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
      "date, account_id, campaign_id, spend, impressions, reach, clicks, ctr, cpc, cpm, frequency, leads, purchases, purchase_value",
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

  const accountNameById = new Map<string, string>();
  {
    const { data: accs } = await supabaseAdmin
      .from("meta_ad_accounts")
      .select("id, name");
    for (const a of accs ?? []) accountNameById.set(a.id, a.name ?? a.id);
  }

  // Agrega por campanha (a tabela pode ter granularidade por anúncio)
  const agg = new Map<string, any>();
  for (const r of rows ?? []) {
    const cid = r.campaign_id ?? "(sem campanha)";
    const acct = (r as any).account_id ?? "";
    const key = `${acct}|${cid}`;
    const cur = agg.get(key) ?? {
      account_id: acct, campaign_id: cid,
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
    agg.set(key, cur);
  }

  const values = Array.from(agg.values()).map((a: any) => [
    day,
    accountNameById.get(a.account_id) ?? a.account_id,
    nameById.get(a.campaign_id) ?? a.campaign_id,
    a.campaign_id,
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
  const head = await sheetsFetch(`/spreadsheets/${META_SHEET_ID}/values/Diario!A1:Q1`);
  if (head.values?.[0]?.[1] !== "Conta") {
    await sheetsFetch(
      `/spreadsheets/${META_SHEET_ID}/values/Diario!A1:Q1?valueInputOption=RAW`,
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
    `/spreadsheets/${META_SHEET_ID}/values/Diario!A1:Q1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values }) },
  );

  // Resumo do dia separado por conta, com consolidado geral.
  const accountNames = Array.from(new Set(values.map((v) => String(v[1])))).sort();
  const summaryRows = accountNames.map((name) =>
    summaryRow(name, values.filter((v) => v[1] === name)),
  );
  summaryRows.push(summaryRow("TOTAL — DUAS CONTAS", values));

  await sheetsFetch(`/spreadsheets/${META_SHEET_ID}/values/Resumo!A1:I20:clear`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  await sheetsFetch(
    `/spreadsheets/${META_SHEET_ID}/values/Resumo!A1:I${4 + summaryRows.length}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({
        values: [
          ["LZ7 ENERGIA • PAINEL META ADS"],
          [`Resultado de ${day} • atualização automática diária • dados oficiais das duas contas`],
          [],
          ["Conta", "Investimento", "Impressões", "Cliques", "Leads", "CPL", "Compras", "Receita", "ROAS"],
          ...summaryRows,
        ],
      }),
    },
  );

  const meta = await sheetsFetch(`/spreadsheets/${META_SHEET_ID}`);
  const diarioSheetId = (meta.sheets ?? []).find((s: any) => s.properties?.title === "Diario")?.properties?.sheetId;
  const resumoSheetId = (meta.sheets ?? []).find((s: any) => s.properties?.title === "Resumo")?.properties?.sheetId;
  if (diarioSheetId != null && resumoSheetId != null) {
    const daily = await sheetsFetch(`/spreadsheets/${META_SHEET_ID}/values/Diario!A2:A`);
    await formatWorkbook(diarioSheetId, resumoSheetId, daily.values?.length ?? values.length);
  }

  return { date: day, rows: values.length, accounts: accountNames, url: META_SHEET_URL };
}
