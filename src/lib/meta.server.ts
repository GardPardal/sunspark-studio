// Server-only helpers para a Meta Marketing API.
// Só importe dentro de handlers de server functions ou server routes.

const GRAPH = "https://graph.facebook.com/v21.0";

export function getMetaConfig() {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  return { token, accountId };
}

export function requireMetaConfig() {
  const { token, accountId } = getMetaConfig();
  if (!token) throw new Error("META_SYSTEM_USER_TOKEN não configurada.");
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID não configurada.");
  return { token, accountId };
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function metaFetch(path: string, token: string): Promise<any> {
  const url = path.startsWith("http") ? path : `${GRAPH}${path}`;
  const sep = url.includes("?") ? "&" : "?";
  const fullUrl = url.includes("access_token=") ? url : `${url}${sep}access_token=${encodeURIComponent(token)}`;

  let attempt = 0;
  // Backoff simples para 429/5xx
  while (true) {
    const res = await fetch(fullUrl, { headers: { Accept: "application/json" } });
    const text = await res.text();
    if (res.ok) {
      try { return text ? JSON.parse(text) : {}; } catch { return {}; }
    }
    // Retry em 429 / 5xx até 3x
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      attempt++;
      await delay(1000 * Math.pow(2, attempt));
      continue;
    }
    throw new Error(`Meta ${res.status}: ${text.slice(0, 400)}`);
  }
}

// Paginação: itera páginas seguindo paging.next
export async function metaFetchAll(path: string, token: string): Promise<any[]> {
  const out: any[] = [];
  let next: string | null = path;
  let safety = 0;
  while (next && safety < 50) {
    safety++;
    const page: any = await metaFetch(next, token);
    if (Array.isArray(page.data)) out.push(...page.data);
    next = page.paging?.next ?? null;
  }
  return out;
}

// ============ Extração de métricas Meta -> colunas planas ============

function findAction(actions: any[] | undefined, types: string[]): number {
  if (!actions) return 0;
  let sum = 0;
  for (const a of actions) {
    if (types.includes(a.action_type)) sum += Number(a.value) || 0;
  }
  return sum;
}

export function normalizeInsight(row: any, accountId: string) {
  const spend = Number(row.spend) || 0;
  const impressions = Number(row.impressions) || 0;
  const reach = Number(row.reach) || 0;
  const clicks = Number(row.clicks) || 0;
  const frequency = Number(row.frequency) || 0;
  const ctr = Number(row.ctr) || 0;
  const cpc = Number(row.cpc) || 0;
  const cpm = Number(row.cpm) || 0;
  const leads = findAction(row.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
  const purchases = findAction(row.actions, ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"]);
  const purchaseValue = findAction(row.action_values, ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"]);
  return {
    date: row.date_start,
    account_id: accountId,
    campaign_id: row.campaign_id ?? null,
    adset_id: row.adset_id ?? null,
    ad_id: row.ad_id ?? null,
    spend,
    impressions,
    reach,
    frequency,
    clicks,
    ctr,
    cpc,
    cpm,
    leads,
    purchases,
    purchase_value: purchaseValue,
    actions: row.actions ?? null,
    action_values: row.action_values ?? null,
    synced_at: new Date().toISOString(),
  };
}

// ============ Syncs ============

export async function syncMetaAccount() {
  const { token, accountId } = requireMetaConfig();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const acc = await metaFetch(
    `/${accountId}?fields=id,name,currency,timezone_name,account_status`,
    token,
  );
  const row = {
    id: acc.id,
    name: acc.name ?? "",
    currency: acc.currency ?? null,
    timezone: acc.timezone_name ?? null,
    status: String(acc.account_status ?? ""),
    last_synced_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin.from("meta_ad_accounts").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return row;
}

export async function syncMetaEntities() {
  const { token, accountId } = requireMetaConfig();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await syncMetaAccount();

  // Campanhas
  const campaigns = await metaFetchAll(
    `/${accountId}/campaigns?limit=100&fields=id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time,buying_type`,
    token,
  );
  const campaignRows = campaigns.map((c) => ({
    id: c.id,
    account_id: accountId,
    name: c.name ?? "",
    objective: c.objective ?? null,
    status: c.status ?? null,
    effective_status: c.effective_status ?? null,
    daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
    lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
    start_time: c.start_time ?? null,
    stop_time: c.stop_time ?? null,
    buying_type: c.buying_type ?? null,
    raw: c,
    synced_at: new Date().toISOString(),
  }));
  if (campaignRows.length) {
    const { error } = await supabaseAdmin.from("meta_campaigns").upsert(campaignRows, { onConflict: "id" });
    if (error) throw new Error(`campaigns: ${error.message}`);
  }

  // Adsets
  const adsets = await metaFetchAll(
    `/${accountId}/adsets?limit=100&fields=id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_strategy,targeting,start_time,end_time`,
    token,
  );
  const adsetRows = adsets.map((a) => ({
    id: a.id,
    campaign_id: a.campaign_id,
    account_id: accountId,
    name: a.name ?? "",
    status: a.status ?? null,
    effective_status: a.effective_status ?? null,
    daily_budget: a.daily_budget ? Number(a.daily_budget) / 100 : null,
    lifetime_budget: a.lifetime_budget ? Number(a.lifetime_budget) / 100 : null,
    optimization_goal: a.optimization_goal ?? null,
    billing_event: a.billing_event ?? null,
    bid_strategy: a.bid_strategy ?? null,
    targeting: a.targeting ?? null,
    start_time: a.start_time ?? null,
    end_time: a.end_time ?? null,
    raw: a,
    synced_at: new Date().toISOString(),
  }));
  if (adsetRows.length) {
    const { error } = await supabaseAdmin.from("meta_adsets").upsert(adsetRows, { onConflict: "id" });
    if (error) throw new Error(`adsets: ${error.message}`);
  }

  // Ads
  const ads = await metaFetchAll(
    `/${accountId}/ads?limit=100&fields=id,name,adset_id,campaign_id,status,effective_status,creative{id},preview_shareable_link`,
    token,
  );
  const adRows = ads.map((a) => ({
    id: a.id,
    adset_id: a.adset_id,
    campaign_id: a.campaign_id,
    account_id: accountId,
    name: a.name ?? "",
    status: a.status ?? null,
    effective_status: a.effective_status ?? null,
    creative_id: a.creative?.id ?? null,
    preview_url: a.preview_shareable_link ?? null,
    raw: a,
    synced_at: new Date().toISOString(),
  }));
  if (adRows.length) {
    const { error } = await supabaseAdmin.from("meta_ads").upsert(adRows, { onConflict: "id" });
    if (error) throw new Error(`ads: ${error.message}`);
  }

  // Criativos (só os referenciados)
  const creativeIds = [...new Set(adRows.map((a) => a.creative_id).filter(Boolean))] as string[];
  const creativeRows: any[] = [];
  for (const cid of creativeIds) {
    try {
      const c = await metaFetch(
        `/${cid}?fields=id,name,title,body,image_url,thumbnail_url,video_id,call_to_action_type,object_story_spec`,
        token,
      );
      creativeRows.push({
        id: c.id,
        account_id: accountId,
        name: c.name ?? null,
        title: c.title ?? null,
        body: c.body ?? null,
        image_url: c.image_url ?? null,
        thumbnail_url: c.thumbnail_url ?? null,
        video_id: c.video_id ?? null,
        call_to_action_type: c.call_to_action_type ?? null,
        object_story_spec: c.object_story_spec ?? null,
        raw: c,
        synced_at: new Date().toISOString(),
      });
    } catch {
      /* skip broken creative */
    }
  }
  if (creativeRows.length) {
    const { error } = await supabaseAdmin.from("meta_creatives").upsert(creativeRows, { onConflict: "id" });
    if (error) throw new Error(`creatives: ${error.message}`);
  }

  await supabaseAdmin.from("meta_sync_state").upsert({
    entity: "entities",
    last_run_at: new Date().toISOString(),
    last_status: "success",
    last_message: null,
    items_processed: campaignRows.length + adsetRows.length + adRows.length + creativeRows.length,
  }, { onConflict: "entity" });

  return {
    campaigns: campaignRows.length,
    adsets: adsetRows.length,
    ads: adRows.length,
    creatives: creativeRows.length,
  };
}

export async function syncMetaInsights(days = 30) {
  const { token, accountId } = requireMetaConfig();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);

  const fields = [
    "date_start",
    "date_stop",
    "campaign_id",
    "adset_id",
    "ad_id",
    "spend",
    "impressions",
    "reach",
    "frequency",
    "clicks",
    "ctr",
    "cpc",
    "cpm",
    "actions",
    "action_values",
  ].join(",");

  const path =
    `/${accountId}/insights` +
    `?level=ad&time_increment=1&limit=500` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}` +
    `&fields=${fields}`;

  const rows = await metaFetchAll(path, token);
  const normalized = rows.map((r) => normalizeInsight(r, accountId));

  // Upsert em lotes de 200
  let saved = 0;
  const chunk = 200;
  for (let i = 0; i < normalized.length; i += chunk) {
    const slice = normalized.slice(i, i + chunk);
    const { error } = await supabaseAdmin
      .from("meta_insights_daily")
      .upsert(slice, { onConflict: "date,ad_id" });
    if (error) throw new Error(`insights: ${error.message}`);
    saved += slice.length;
  }

  await supabaseAdmin.from("meta_sync_state").upsert({
    entity: "insights",
    last_run_at: new Date().toISOString(),
    last_status: "success",
    last_message: `${saved} linhas`,
    items_processed: saved,
  }, { onConflict: "entity" });

  return { rows: saved, since, until };
}
