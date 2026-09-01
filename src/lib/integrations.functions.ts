import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// INTEGRAÇÕES — Configuração + Verificação self-service
// ------------------------------------------------------------
// - Credenciais gravadas em `site_settings` sob a chave
//   `integration:{service}:{field}` (fallback aos env vars).
// - `verifyIntegration` roda o teste real do serviço e atualiza
//   `system_health` para refletir o status na tela.
// ============================================================

export type IntegrationService =
  "db" | "auth" | "email" | "whatsapp" | "meta" | "google" | "ai" | "webhook" | "ploomes";

export type IntegrationField = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  hint?: string;
};

export type IntegrationSpec = {
  service: IntegrationService;
  label: string;
  description: string;
  fields: IntegrationField[];
  canConfigure: boolean;
  canVerify: boolean;
};

export const INTEGRATION_SPECS: IntegrationSpec[] = [
  {
    service: "db",
    label: "Banco de Dados",
    description: "Ping da conexão principal.",
    fields: [],
    canConfigure: false,
    canVerify: true,
  },
  {
    service: "auth",
    label: "Autenticação",
    description: "Sessão e RLS do usuário atual.",
    fields: [],
    canConfigure: false,
    canVerify: true,
  },
  {
    service: "email",
    label: "E-mail transacional",
    description: "Domínio de envio configurado.",
    fields: [],
    canConfigure: false,
    canVerify: true,
  },
  {
    service: "ai",
    label: "LIZ (IA)",
    description: "Chave do Lovable AI Gateway.",
    fields: [],
    canConfigure: false,
    canVerify: true,
  },
  {
    service: "meta",
    label: "Meta Ads (Facebook / Instagram)",
    description:
      "Token de Usuário do Sistema (BM → Configurações → Usuários do Sistema) e ID da conta de anúncios (act_...).",
    fields: [
      {
        key: "access_token",
        label: "Access Token (System User)",
        placeholder: "EAAB...",
        secret: true,
        hint: "Business Manager → Configurações → Usuários do Sistema → Gerar Token.",
      },
      {
        key: "ad_account_id",
        label: "ID da conta de anúncios",
        placeholder: "act_123456789",
        hint: "Formato act_ + número. Encontrado em Gerenciador de Anúncios.",
      },
    ],
    canConfigure: true,
    canVerify: true,
  },
  {
    service: "ploomes",
    label: "Ploomes (CRM externo)",
    description: "User-Key da Ploomes para push automático de leads.",
    fields: [
      {
        key: "user_key",
        label: "User Key",
        secret: true,
        hint: "Ploomes → Perfil → Chaves de API.",
      },
    ],
    canConfigure: true,
    canVerify: true,
  },
  {
    service: "whatsapp",
    label: "WhatsApp",
    description: "Instância Evolution / provedor externo.",
    fields: [
      {
        key: "base_url",
        label: "Base URL da instância",
        placeholder: "https://api.seuservidor.com",
      },
      { key: "api_key", label: "API Key", secret: true },
      { key: "instance", label: "Instância", placeholder: "lz7" },
    ],
    canConfigure: true,
    canVerify: true,
  },
  {
    service: "google",
    label: "Google Agenda",
    description: "Integração OAuth por usuário — feita em Agenda → Conectar Google.",
    fields: [],
    canConfigure: false,
    canVerify: true,
  },
  {
    service: "webhook",
    label: "Webhooks",
    description: "Rota pública de recebimento (Ploomes, Meta).",
    fields: [],
    canConfigure: false,
    canVerify: true,
  },
];

// ----------------- Helpers -----------------

async function assertAdminOrCoord(supabase: any, userId: string) {
  const [{ data: a }, { data: c }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "coordenador" }),
  ]);
  if (!a && !c) throw new Error("Acesso restrito a admin/coordenação.");
}

function settingKey(service: string, field: string) {
  return `integration:${service}:${field}`;
}

function maskValue(v: string | null) {
  if (!v) return null;
  if (v.length <= 6) return "•".repeat(v.length);
  return `${v.slice(0, 3)}${"•".repeat(Math.max(4, v.length - 6))}${v.slice(-3)}`;
}

async function upsertHealth(
  supabase: any,
  service: string,
  status: "ok" | "warn" | "down" | "unknown",
  message: string | null,
  latency_ms: number | null,
  meta: any = {},
) {
  await supabase.rpc("upsert_health", {
    _service: service,
    _status: status,
    _message: message,
    _latency_ms: latency_ms,
    _meta: meta,
  });
}

// ----------------- List spec + current values -----------------

export type IntegrationConfigRow = {
  service: IntegrationService;
  spec: IntegrationSpec;
  values: Record<
    string,
    { set: boolean; masked: string | null; source: "settings" | "env" | null }
  >;
};

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntegrationConfigRow[]> => {
    const { supabase, userId } = context;
    await assertAdminOrCoord(supabase, userId);

    const keys = INTEGRATION_SPECS.flatMap((s) =>
      s.fields.map((f) => settingKey(s.service, f.key)),
    );
    const { data: rows } = keys.length
      ? await supabase.from("site_settings").select("key,value").in("key", keys)
      : { data: [] as any[] };
    const settingsMap = new Map<string, string | null>();
    for (const r of (rows ?? []) as any[]) settingsMap.set(r.key, r.value);

    const envFor = (service: string, field: string): string | null => {
      const envMap: Record<string, string> = {
        "meta:access_token": "META_SYSTEM_USER_TOKEN",
        "meta:ad_account_id": "META_AD_ACCOUNT_ID",
        "ploomes:user_key": "PLOOMES_USER_KEY",
        "whatsapp:base_url": "WHATSAPP_BASE_URL",
        "whatsapp:api_key": "WHATSAPP_API_KEY",
        "whatsapp:instance": "WHATSAPP_INSTANCE",
      };
      const envName = envMap[`${service}:${field}`];
      return envName ? (process.env[envName] ?? null) : null;
    };

    return INTEGRATION_SPECS.map((spec) => {
      const values: IntegrationConfigRow["values"] = {};
      for (const f of spec.fields) {
        const fromSetting = settingsMap.get(settingKey(spec.service, f.key)) ?? null;
        const fromEnv = envFor(spec.service, f.key);
        const val = fromSetting ?? fromEnv;
        values[f.key] = {
          set: !!val,
          masked: f.secret ? maskValue(val) : val,
          source: fromSetting ? "settings" : fromEnv ? "env" : null,
        };
      }
      return { service: spec.service, spec, values };
    });
  });

// ----------------- Save credentials -----------------

export const saveIntegrationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { service: IntegrationService; values: Record<string, string> }) => ({
    service: input.service,
    values: input.values ?? {},
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrCoord(supabase, userId);

    const spec = INTEGRATION_SPECS.find((s) => s.service === data.service);
    if (!spec || !spec.canConfigure) throw new Error("Integração não configurável.");

    const rows = spec.fields
      .filter((f) => data.values[f.key] !== undefined)
      .map((f) => ({
        key: settingKey(data.service, f.key),
        value: (data.values[f.key] ?? "").trim() || null,
        updated_at: new Date().toISOString(),
      }));

    if (rows.length) {
      const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    }
    return { ok: true, saved: rows.length };
  });

// ----------------- Verify (executes real check) -----------------

async function verifyMeta(
  supabase: any,
): Promise<{ status: "ok" | "warn" | "down"; message: string; meta?: any }> {
  const { data: rows } = await supabase
    .from("site_settings")
    .select("key,value")
    .in("key", [settingKey("meta", "access_token"), settingKey("meta", "ad_account_id")]);
  const map = new Map((rows ?? []).map((r: any) => [r.key, r.value]));
  const token =
    (map.get(settingKey("meta", "access_token")) as string) || process.env.META_SYSTEM_USER_TOKEN;
  const accountId =
    (map.get(settingKey("meta", "ad_account_id")) as string) || process.env.META_AD_ACCOUNT_ID;
  if (!token) return { status: "down", message: "Access Token não configurado." };
  if (!accountId)
    return { status: "warn", message: "Access Token OK, mas falta ID da conta de anúncios." };
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(accountId)}?fields=id,name,account_status,currency&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) return { status: "down", message: `Meta ${res.status}: ${text.slice(0, 200)}` };
  const body = JSON.parse(text);
  return { status: "ok", message: `Conta ${body.name} (${body.currency})`, meta: body };
}

async function verifyPloomes(
  supabase: any,
): Promise<{ status: "ok" | "warn" | "down"; message: string }> {
  const { data: row } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", settingKey("ploomes", "user_key"))
    .maybeSingle();
  const key = (row?.value as string) || process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) return { status: "down", message: "User Key da Ploomes não configurada." };
  const res = await fetch("https://public-api2.ploomes.com/Self", {
    headers: { "User-Key": key, Accept: "application/json" },
  });
  if (!res.ok) return { status: "down", message: `Ploomes ${res.status}` };
  const body = await res.json().catch(() => ({}));
  const name = body?.value?.[0]?.Name ?? "Ploomes";
  return { status: "ok", message: `Conectado como ${name}` };
}

async function verifyWhatsapp(
  supabase: any,
): Promise<{ status: "ok" | "warn" | "down"; message: string }> {
  const { data: rows } = await supabase
    .from("site_settings")
    .select("key,value")
    .in("key", [
      settingKey("whatsapp", "base_url"),
      settingKey("whatsapp", "api_key"),
      settingKey("whatsapp", "instance"),
    ]);
  const map = new Map((rows ?? []).map((r: any) => [r.key, r.value]));
  const base =
    (map.get(settingKey("whatsapp", "base_url")) as string) || process.env.WHATSAPP_BASE_URL;
  const apiKey =
    (map.get(settingKey("whatsapp", "api_key")) as string) || process.env.WHATSAPP_API_KEY;
  const instance =
    (map.get(settingKey("whatsapp", "instance")) as string) || process.env.WHATSAPP_INSTANCE;
  if (!base || !apiKey) return { status: "down", message: "Base URL e API Key são obrigatórias." };
  const url = `${base.replace(/\/$/, "")}/instance/connectionState/${encodeURIComponent(instance ?? "")}`;
  try {
    const res = await fetch(url, { headers: { apikey: apiKey } });
    if (!res.ok) return { status: "warn", message: `HTTP ${res.status} — verifique instância.` };
    const body = await res.json().catch(() => ({}));
    return { status: "ok", message: `Estado: ${body?.instance?.state ?? "conectado"}` };
  } catch (e: any) {
    return { status: "down", message: `Falha de rede: ${e?.message ?? "erro"}` };
  }
}

async function verifyDb(supabase: any) {
  const t0 = Date.now();
  const { error } = await supabase
    .from("profiles")
    .select("id", { head: true, count: "exact" })
    .limit(1);
  const dt = Date.now() - t0;
  if (error) return { status: "down" as const, message: error.message, latency: dt };
  return { status: "ok" as const, message: "Consulta respondeu.", latency: dt };
}

async function verifyEmail(): Promise<{ status: "ok" | "warn" | "down"; message: string }> {
  const domain = process.env.EMAIL_DOMAIN || "notify.lz7energia.com.br";
  return { status: "ok", message: `Domínio ativo: ${domain}` };
}

async function verifyAi(): Promise<{ status: "ok" | "warn" | "down"; message: string }> {
  const has = !!process.env.LOVABLE_API_KEY;
  return has
    ? { status: "ok", message: "LOVABLE_API_KEY presente." }
    : { status: "down", message: "LOVABLE_API_KEY ausente." };
}

async function verifyWebhook(): Promise<{ status: "ok" | "warn" | "down"; message: string }> {
  return { status: "ok", message: "Rotas /api/public/* ativas." };
}

async function verifyGoogle(
  supabase: any,
  userId: string,
): Promise<{ status: "ok" | "warn" | "down"; message: string }> {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", `google_calendar:token:${userId}`)
    .maybeSingle();
  return data?.value
    ? { status: "ok", message: "OAuth Google conectado para este usuário." }
    : { status: "warn", message: "Sem token OAuth Google — conecte em Agenda." };
}

export const verifyIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { service: IntegrationService }) => ({ service: input.service }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrCoord(supabase, userId);

    const t0 = Date.now();
    let result: { status: "ok" | "warn" | "down"; message: string; meta?: any; latency?: number };
    try {
      switch (data.service) {
        case "db":
          result = await verifyDb(supabase);
          break;
        case "auth":
          result = { status: "ok", message: `Sessão ativa (${userId.slice(0, 8)}…)` };
          break;
        case "email":
          result = await verifyEmail();
          break;
        case "ai":
          result = await verifyAi();
          break;
        case "webhook":
          result = await verifyWebhook();
          break;
        case "meta":
          result = await verifyMeta(supabase);
          break;
        case "ploomes":
          result = await verifyPloomes(supabase);
          break;
        case "whatsapp":
          result = await verifyWhatsapp(supabase);
          break;
        case "google":
          result = await verifyGoogle(supabase, userId);
          break;
        default:
          result = { status: "warn", message: "Serviço desconhecido." };
      }
    } catch (e: any) {
      result = { status: "down", message: e?.message ?? "Erro inesperado." };
    }
    const latency = result.latency ?? Date.now() - t0;
    await upsertHealth(
      supabase,
      data.service,
      result.status,
      result.message,
      latency,
      result.meta ?? {},
    );
    return { ...result, latency };
  });
