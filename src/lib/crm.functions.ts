import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SALES_LEADS_OR_FILTER } from "@/lib/ploomes-pipelines";

const STAGES = ["novo", "atendimento", "nao_atendido", "venda", "faturado", "perdido"] as const;

async function getOwnRoles(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { role: string }) => r.role);
}

async function assertCrmAccess(supabase: any, userId: string) {
  const roles = await getOwnRoles(supabase, userId);
  if (
    !roles.includes("admin") &&
    !roles.includes("consultor") &&
    !roles.includes("coordenador") &&
    !roles.includes("sdr")
  ) {
    throw new Error("Acesso restrito ao CRM.");
  }
  return roles;
}

const CRM_LEAD_COLS =
  "id,nome,telefone,email,cidade,estado,valor_conta,mensagem,origem,produto_interesse,captacao_metodo,objetivo,padrao_eletrico,fatura_url,tipo_encaminhamento,utm_source,utm_campaign,gclid,fbclid,stage,sale_value,sale_notes,assigned_to,created_at,stage_updated_at,atendimento_deadline,atendimento_confirmado_at,is_prioridade_emergencia,is_offline,ploomes_deal_id,pipeline_id,pipeline_stage_id,last_synced_at,lead_quality,ploomes_owner_id,ploomes_captacao_id";

/** Consultor sem papel de gestão só vê leads atribuídos a ele ou criados por ele (igual à RLS leads_select_scoped). */
function isOnlyOwn(roles: string[]) {
  return !roles.includes("admin") && !roles.includes("coordenador") && !roles.includes("sdr");
}

/** Nome do responsável: perfil do Solar OS ou, sem login, o responsável no Ploomes. */
function assigneeName(nameMap: Map<string, string>, l: any): string | null {
  return (
    (l.assigned_to ? nameMap.get(l.assigned_to) : null) ??
    (l.ploomes_owner_id ? nameMap.get(`ploomes:${l.ploomes_owner_id}`) : null) ??
    null
  );
}

/** Mapa id → nome do responsável (profiles, vendedores e usuários do Ploomes). */
async function loadAssigneeNames(db: any) {
  const [{ data: profiles }, { data: ploomesUsers }, { data: sellers }] = await Promise.all([
    db.from("profiles").select("id, full_name, email"),
    db.from("ploomes_users").select("ploomes_id, name, email, profile_id, seller_id"),
    db.from("sales_sellers").select("id, name, profile_id, unit"),
  ]);
  const nameMap = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (p?.id && p?.full_name) nameMap.set(p.id, p.full_name);
  }
  for (const s of sellers ?? []) {
    if (s?.id && s?.name) nameMap.set(s.id, s.name);
    if (s?.profile_id && s?.name) nameMap.set(s.profile_id, s.name);
  }
  for (const u of ploomesUsers ?? []) {
    if (u?.profile_id && u?.name) nameMap.set(u.profile_id, u.name);
    if (u?.seller_id && u?.name) nameMap.set(u.seller_id, u.name);
    if (u?.ploomes_id && u?.name) nameMap.set(`ploomes:${u.ploomes_id}`, u.name);
  }
  return nameMap;
}

export const listCrmLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await assertCrmAccess(supabase, userId);
    const onlyOwn = isOnlyOwn(roles);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchAllRows } = await import("./fetch-all.server");

    // Paginado: o backend corta em 1000 linhas e isso escondia leads antigos
    // do Kanban e distorcia os totais das colunas.
    const [leads, nameMap] = await Promise.all([
      fetchAllRows((from, to) => {
        let q = (supabaseAdmin as any)
          .from("leads")
          .select(CRM_LEAD_COLS, { count: "exact" })
          .or(SALES_LEADS_OR_FILTER)
          .is("duplicado_de", null)
          .order("created_at", { ascending: false })
          .order("id");
        if (onlyOwn) q = q.or(`assigned_to.eq.${userId},created_by.eq.${userId}`);
        return q.range(from, to);
      }),
      loadAssigneeNames(supabaseAdmin),
    ]);

    return leads.map((l: any) => ({
      ...l,
      assigned_name: assigneeName(nameMap, l),
    }));
  });

/* ================= Kanban paginado no servidor ================= */

const BOARD_STAGES = STAGES;
type BoardStage = (typeof BOARD_STAGES)[number];

const boardSchema = z.object({
  view: z.enum(["todos", "meus", "offline"]).default("todos"),
  seller: z.string().max(200).optional(),
  origin: z.string().max(40).optional(),
  search: z.string().max(100).optional(),
  dateStart: z.string().datetime().optional(),
  dateEnd: z.string().datetime().optional(),
  dateField: z.enum(["created_at", "stage_updated_at"]).default("created_at"),
  scope: z
    .enum(["emergencia", "agenda", "atrasados", "novos", "nao_atendido", "vendas"])
    .optional(),
  limits: z.record(z.string(), z.number().int().min(1).max(2000)).optional(),
});
export type CrmBoardFilters = z.input<typeof boardSchema>;

export type CrmBoardColumn = { items: any[]; total: number; sum: number };
export type CrmBoardResponse = {
  columns: Record<BoardStage, CrmBoardColumn>;
  stats: {
    total: number;
    vendasCount: number;
    vendasValor: number;
    faturadosCount: number;
    faturadosValor: number;
  };
};

const DEFAULT_COLUMN_LIMIT = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Valores entre aspas para os filtros `or(...)` do Data API (datas têm ":" e "."). */
const quoted = (v: string) => `"${v}"`;

/**
 * Kanban do CRM com filtros aplicados no banco. Devolve, por etapa, só os
 * primeiros N cards (N = `limits[etapa]`, padrão 30) mais o total real e a
 * soma de valores da etapa — o navegador não baixa mais a base inteira.
 */
export const listCrmBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => boardSchema.parse(d ?? {}))
  .handler(async ({ data: f, context }): Promise<CrmBoardResponse> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await assertCrmAccess(supabase, userId);
    const onlyOwn = isOnlyOwn(roles);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchAllRows } = await import("./fetch-all.server");
    const { getLeadOriginInfo } = await import("./lead-origin");
    const db = supabaseAdmin as any;

    // Espelho incremental do Ploomes (somente leitura lá). Limitado a ~4 s para
    // não travar a tela; se não terminar, a próxima abertura refaz o intervalo.
    try {
      const { mirrorIfStale } = await import("./ploomes-mirror.server");
      await Promise.race([
        mirrorIfStale(10).catch((e) => console.error("[crm] espelho Ploomes:", e)),
        new Promise((r) => setTimeout(r, 4000)),
      ]);
    } catch (e) {
      console.error("[crm] espelho Ploomes:", e);
    }

    const nameMap = await loadAssigneeNames(db);

    // Vendedor: o filtro pode vir como id de perfil, id de vendedor ou nome (dono no Ploomes).
    let sellerIds: string[] | null = null;
    if (f.seller && f.seller !== "todos") {
      const targetName = nameMap.get(f.seller) ?? f.seller;
      const ids = new Set<string>();
      if (UUID_RE.test(f.seller)) ids.add(f.seller);
      for (const [id, name] of nameMap) if (name === targetName && UUID_RE.test(id)) ids.add(id);
      sellerIds = Array.from(ids);
    }

    const search = (f.search ?? "").replace(/[",()\\*%]/g, " ").trim();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const applyFilters = (query: any) => {
      // Esconde registros criados a partir de funis operacionais do Ploomes.
      let x = query.or(SALES_LEADS_OR_FILTER).is("duplicado_de", null);
      if (onlyOwn) x = x.or(`assigned_to.eq.${userId},created_by.eq.${userId}`);
      if (f.view === "meus") x = x.eq("assigned_to", userId);
      else if (f.view === "offline") x = x.eq("is_offline", true);
      if (sellerIds) {
        // Nenhum id conhecido para o vendedor escolhido → resultado vazio.
        x = sellerIds.length ? x.in("assigned_to", sellerIds) : x.is("id", null);
      }
      if (search) {
        x = x.or(
          ["nome", "telefone", "cidade", "origem", "captacao_metodo"]
            .map((c) => `${c}.ilike.${quoted(`*${search}*`)}`)
            .join(","),
        );
      }
      if (f.dateStart || f.dateEnd) {
        if (f.dateField === "created_at") {
          if (f.dateStart) x = x.gte("created_at", f.dateStart);
          if (f.dateEnd) x = x.lte("created_at", f.dateEnd);
        } else {
          // Data da etapa com fallback para a data de entrada (mesma regra da tela antiga).
          const upd = [
            f.dateStart && `stage_updated_at.gte.${quoted(f.dateStart)}`,
            f.dateEnd && `stage_updated_at.lte.${quoted(f.dateEnd)}`,
          ].filter(Boolean);
          const crt = [
            "stage_updated_at.is.null",
            f.dateStart && `created_at.gte.${quoted(f.dateStart)}`,
            f.dateEnd && `created_at.lte.${quoted(f.dateEnd)}`,
          ].filter(Boolean);
          x = x.or(`and(${upd.join(",")}),and(${crt.join(",")})`);
        }
      }
      switch (f.scope) {
        case "emergencia":
          x = x.eq("is_prioridade_emergencia", true);
          break;
        case "agenda":
          x = x.not("atendimento_deadline", "is", null).is("atendimento_confirmado_at", null);
          break;
        case "atrasados":
          x = x
            .not("atendimento_deadline", "is", null)
            .is("atendimento_confirmado_at", null)
            .lt("atendimento_deadline", now.toISOString());
          break;
        case "novos":
          x = x.eq("stage", "novo");
          break;
        case "nao_atendido":
          x = x.eq("stage", "nao_atendido");
          break;
        case "vendas":
          x = x
            .in("stage", ["venda", "faturado"])
            .or(
              `stage_updated_at.gte.${quoted(monthStart)},and(stage_updated_at.is.null,created_at.gte.${quoted(monthStart)})`,
            );
          break;
      }
      return x;
    };

    const limitOf = (st: BoardStage) => f.limits?.[st] ?? DEFAULT_COLUMN_LIMIT;
    const withName = (l: any) => ({
      ...l,
      assigned_name: assigneeName(nameMap, l),
    });

    const columns = {} as Record<BoardStage, CrmBoardColumn>;

    if (!f.origin || f.origin === "todas") {
      // Caminho rápido: contagem, página e soma direto no banco, por etapa.
      await Promise.all(
        BOARD_STAGES.map(async (st) => {
          const [page, valued] = await Promise.all([
            applyFilters(db.from("leads").select(CRM_LEAD_COLS, { count: "exact" }))
              .eq("stage", st)
              .order("created_at", { ascending: false })
              .order("id")
              .range(0, limitOf(st) - 1),
            fetchAllRows((from, to) =>
              applyFilters(db.from("leads").select("sale_value", { count: "exact" }))
                .eq("stage", st)
                .not("sale_value", "is", null)
                .order("id")
                .range(from, to),
            ),
          ]);
          if (page.error) throw new Error(page.error.message);
          columns[st] = {
            items: (page.data ?? []).map(withName),
            total: page.count ?? 0,
            sum: valued.reduce((s: number, r: any) => s + (Number(r.sale_value) || 0), 0),
          };
        }),
      );
    } else {
      // Filtro de origem depende de regras de texto: varre só colunas leves,
      // classifica no servidor e busca os dados completos apenas dos cards exibidos.
      const light = await fetchAllRows((from, to) =>
        applyFilters(
          db
            .from("leads")
            .select(
              "id,stage,sale_value,origem,mensagem,captacao_metodo,ploomes_captacao_id,utm_source,fbclid,gclid,created_at",
              { count: "exact" },
            ),
        )
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
      );
      const matched = light.filter((l: any) => getLeadOriginInfo(l).key === f.origin);
      const pageIds: string[] = [];
      for (const st of BOARD_STAGES) {
        const rows = matched.filter((l: any) => l.stage === st);
        columns[st] = {
          items: [],
          total: rows.length,
          sum: rows.reduce((s: number, r: any) => s + (Number(r.sale_value) || 0), 0),
        };
        pageIds.push(...rows.slice(0, limitOf(st)).map((r: any) => r.id));
      }
      const full = new Map<string, any>();
      for (let i = 0; i < pageIds.length; i += 100) {
        const { data, error } = await db
          .from("leads")
          .select(CRM_LEAD_COLS)
          .in("id", pageIds.slice(i, i + 100));
        if (error) throw new Error(error.message);
        for (const l of data ?? []) full.set(l.id, l);
      }
      for (const id of pageIds) {
        const l = full.get(id);
        if (l && columns[l.stage as BoardStage]) {
          columns[l.stage as BoardStage].items.push(withName(l));
        }
      }
    }

    const total = BOARD_STAGES.reduce((s, st) => s + columns[st].total, 0);
    return {
      columns,
      stats: {
        total,
        vendasCount: columns.venda.total,
        vendasValor: columns.venda.sum,
        faturadosCount: columns.faturado.total,
        faturadosValor: columns.faturado.sum,
      },
    };
  });

export const listCrmSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertCrmAccess(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: sellers }, { data: pusers }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email").order("full_name"),
      supabaseAdmin.from("sales_sellers").select("id, name, profile_id, unit").eq("active", true),
      supabaseAdmin.from("ploomes_users").select("ploomes_id, name, profile_id, seller_id"),
    ]);

    const list: Array<{ id: string; name: string; email?: string | null }> = [];
    const seen = new Set<string>();

    for (const p of profiles ?? []) {
      if (p.full_name?.trim() && !seen.has(p.full_name.trim().toLowerCase())) {
        seen.add(p.full_name.trim().toLowerCase());
        list.push({ id: p.id, name: p.full_name.trim(), email: p.email });
      }
    }
    for (const s of sellers ?? []) {
      const id = s.profile_id || s.id;
      if (s.name?.trim() && !seen.has(s.name.trim().toLowerCase())) {
        seen.add(s.name.trim().toLowerCase());
        list.push({ id, name: s.name.trim() });
      }
    }
    for (const u of pusers ?? []) {
      const id = u.profile_id || u.seller_id || String(u.ploomes_id);
      if (u.name?.trim() && !seen.has(u.name.trim().toLowerCase())) {
        seen.add(u.name.trim().toLowerCase());
        list.push({ id, name: u.name.trim() });
      }
    }

    try {
      const { _internalFetchSchema } = await import("./ploomes-form.functions");
      const schema = await _internalFetchSchema();
      for (const o of schema.owners ?? []) {
        if (o.name?.trim() && !seen.has(o.name.trim().toLowerCase())) {
          seen.add(o.name.trim().toLowerCase());
          list.push({ id: o.name.trim(), name: o.name.trim() });
        }
      }
    } catch {}

    return list.sort((a, b) => a.name.localeCompare(b.name));
  });

const updateStageSchema = z.object({
  leadId: z.string().uuid(),
  stage: z.enum(STAGES),
  saleValue: z.number().nullable().optional(),
  saleNotes: z.string().max(2000).nullable().optional(),
});

export const updateLeadStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateStageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await assertCrmAccess(supabase, userId);
    const { applyStageChange } = await import("./crm-stage.server");
    await applyStageChange(supabase, userId, roles, data);
    return { ok: true, userId };
  });

const assignSchema = z.object({
  leadId: z.string().uuid(),
  assignedTo: z.string().uuid().nullable(),
});

export const assignLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assignSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await getOwnRoles(supabase, userId);
    if (!roles.includes("admin")) throw new Error("Apenas administradores podem atribuir leads.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("leads")
      .update({ assigned_to: data.assignedTo })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteSchema = z.object({ leadId: z.string().uuid() });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await getOwnRoles(supabase, userId);
    if (!roles.includes("admin")) throw new Error("Apenas administradores podem excluir leads.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("leads").delete().eq("id", data.leadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const updateLeadSchema = z.object({
  leadId: z.string().uuid(),
  patch: z.object({
    nome: z.string().min(1).max(200).optional(),
    telefone: z.string().min(1).max(40).optional(),
    email: z.string().email().nullable().optional(),
    cidade: z.string().max(120).nullable().optional(),
    estado: z.string().max(60).nullable().optional(),
    valor_conta: z.string().max(60).nullable().optional(),
    mensagem: z.string().max(4000).nullable().optional(),
    origem: z.string().max(80).nullable().optional(),
    produto_interesse: z.string().max(120).nullable().optional(),
    captacao_metodo: z.string().max(120).nullable().optional(),
    objetivo: z.string().max(200).nullable().optional(),
    padrao_eletrico: z.enum(["monofasico", "bifasico", "trifasico"]).nullable().optional(),
    fatura_url: z.string().max(500).nullable().optional(),
    tipo_encaminhamento: z.enum(["orcamento", "visita_tecnica"]).nullable().optional(),
    sale_value: z.number().nullable().optional(),
    sale_notes: z.string().max(2000).nullable().optional(),
  }),
});

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateLeadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await assertCrmAccess(supabase, userId);
    const isPrivileged = roles.includes("admin") || roles.includes("coordenador");

    if (isPrivileged) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("leads")
        .update(data.patch as any)
        .eq("id", data.leadId);
      if (error) throw new Error(error.message);
    } else {
      // Consultor: RLS bloqueia edição de leads de outros
      const { data: row, error } = await supabase
        .from("leads")
        .update(data.patch as any)
        .eq("id", data.leadId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Sem permissão para editar este lead.");
    }

    // Sincroniza dados com o Ploomes de forma não-bloqueante
    try {
      const { syncLeadDataToPloomes } = await import("./ploomes.server");
      await syncLeadDataToPloomes(data.leadId, data.patch);
    } catch (e) {
      console.error("[updateLead] Ploomes sync error:", e);
    }

    return { ok: true };
  });
