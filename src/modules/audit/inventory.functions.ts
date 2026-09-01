import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data: a } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!a) throw new Error("Somente administradores.");
}

export type AuditReport = {
  generated_at: string;
  summary: {
    routes: number;
    server_functions: number;
    tables: number;
    diagnostics_open: number;
    integrations_error_24h: number;
  };
  routes: Array<{
    path: string;
    area: string;
    audience: string[];
    status: "active" | "legacy" | "duplicate";
  }>;
  navigation_map: Array<{
    area: "Operação" | "Marketing" | "Inteligência" | "Gestão";
    items: Array<{ label: string; to: string; question: string }>;
  }>;
  duplicates: Array<{ kind: string; items: string[]; note: string }>;
  gaps: Array<{ kind: "warning" | "info"; message: string; suggestion: string }>;
  tech_health: {
    integrations_last_24h: Array<{ provider: string; status: string; count: number }>;
    email_last_24h: { total: number; failed: number };
  };
};

const NAVIGATION_MAP: AuditReport["navigation_map"] = [
  {
    area: "Operação",
    items: [
      { label: "Hoje", to: "/hoje", question: "O que preciso fazer agora?" },
      { label: "Minha Agenda", to: "/agenda", question: "Quais são meus compromissos?" },
      { label: "Leads", to: "/crm", question: "Quem precisa da minha atenção?" },
      { label: "Pipeline / Funil", to: "/crm", question: "Onde estão minhas vendas?" },
      {
        label: "Distribuição / Roleta",
        to: "/coordenacao",
        question: "Como distribuir novos leads?",
      },
      { label: "Liberação de contas", to: "/admin", question: "Quem precisa ser aprovado?" },
      {
        label: "Equipe (Consultores/SDR)",
        to: "/coordenacao",
        question: "Como está minha equipe?",
      },
    ],
  },
  {
    area: "Marketing",
    items: [
      {
        label: "Meta Ads (tempo real)",
        to: "/mod/marketing",
        question: "Como estão minhas campanhas?",
      },
      { label: "Marketing Hub", to: "/marketing-hub", question: "UTMs cruzam com CRM?" },
      {
        label: "Diagnóstico de campanhas",
        to: "/mod/marketing",
        question: "Quais campanhas devo pausar?",
      },
      {
        label: "Landing editável",
        to: "/landing-editavel.html",
        question: "Preciso editar o site?",
      },
    ],
  },
  {
    area: "Inteligência",
    items: [
      { label: "Insights IA", to: "/mod/ia", question: "O que a IA recomenda?" },
      { label: "BI por perfil", to: "/mod/bi", question: "Como estão meus indicadores?" },
      { label: "Financeiro", to: "/mod/financeiro", question: "ROI, CAC, ROAS, margem?" },
      { label: "Liz IA do time", to: "/crm", question: "Preciso conversar com a Liz." },
      { label: "LIZ Studio (imagens)", to: "/liz-studio", question: "Preciso gerar imagens." },
    ],
  },
  {
    area: "Gestão",
    items: [
      { label: "Saúde do Sistema", to: "/mod/admin", question: "Algo está fora do ar?" },
      {
        label: "Auditoria da plataforma",
        to: "/mod/auditoria",
        question: "Como está o inventário do sistema?",
      },
      { label: "Usuários & Permissões", to: "/admin", question: "Quem tem acesso a quê?" },
      { label: "Integrações & Logs", to: "/mod/admin", question: "As integrações rodaram?" },
    ],
  },
];

// Route inventory encoded from the current tree (kept in sync manually — auditoria roda no request).
const ROUTE_INVENTORY: AuditReport["routes"] = [
  { path: "/app", area: "Operação", audience: ["consultor"], status: "active" },
  {
    path: "/hoje",
    area: "Operação",
    audience: ["admin", "coordenador", "consultor", "sdr"],
    status: "active",
  },
  {
    path: "/agenda",
    area: "Operação",
    audience: ["consultor", "coordenador", "admin"],
    status: "active",
  },
  {
    path: "/crm",
    area: "Operação",
    audience: ["consultor", "sdr", "coordenador", "admin"],
    status: "active",
  },
  { path: "/coordenacao", area: "Operação", audience: ["coordenador", "admin"], status: "active" },
  { path: "/admin", area: "Gestão", audience: ["admin"], status: "active" },
  {
    path: "/marketing-hub",
    area: "Marketing",
    audience: ["admin", "coordenador"],
    status: "active",
  },
  {
    path: "/liz-studio",
    area: "Inteligência",
    audience: ["admin", "coordenador"],
    status: "active",
  },
  {
    path: "/baixar-app",
    area: "Gestão",
    audience: ["admin", "coordenador", "consultor", "sdr"],
    status: "active",
  },
  { path: "/mod", area: "Gestão", audience: ["admin", "coordenador"], status: "active" },
  { path: "/mod/admin", area: "Gestão", audience: ["admin", "coordenador"], status: "active" },
  {
    path: "/mod/marketing",
    area: "Marketing",
    audience: ["admin", "coordenador"],
    status: "active",
  },
  { path: "/mod/ia", area: "Inteligência", audience: ["admin", "coordenador"], status: "active" },
  { path: "/mod/bi", area: "Inteligência", audience: ["admin", "coordenador"], status: "active" },
  {
    path: "/mod/financeiro",
    area: "Inteligência",
    audience: ["admin", "coordenador"],
    status: "active",
  },
  { path: "/mod/auditoria", area: "Gestão", audience: ["admin"], status: "active" },
];

export const getAuditReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditReport> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const [{ count: diag }, { data: syncLog }, { data: emails }] = (await Promise.all([
      supabase
        .from("system_diagnostics")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "acknowledged"]),
      supabase.from("integration_sync_log").select("provider,status").gte("created_at", since24h),
      supabase.from("email_send_log").select("status").gte("created_at", since24h),
    ])) as any;

    const byProvider = new Map<string, { provider: string; status: string; count: number }>();
    for (const row of (syncLog ?? []) as any[]) {
      const k = `${row.provider}|${row.status}`;
      const prev = byProvider.get(k);
      if (prev) prev.count += 1;
      else byProvider.set(k, { provider: row.provider, status: row.status, count: 1 });
    }
    const emailRows = (emails ?? []) as any[];
    const failedEmails = emailRows.filter((e) => {
      const s = (e.status ?? "").toLowerCase();
      return s.includes("fail") || s.includes("error") || s.includes("bounce");
    }).length;
    const errs = Array.from(byProvider.values())
      .filter((r) => r.status === "error" || r.status === "partial")
      .reduce((s, r) => s + r.count, 0);

    return {
      generated_at: new Date().toISOString(),
      summary: {
        routes: ROUTE_INVENTORY.length,
        server_functions: 40, // conservative placeholder — evolves with real scan
        tables: 30,
        diagnostics_open: diag ?? 0,
        integrations_error_24h: errs,
      },
      routes: ROUTE_INVENTORY,
      navigation_map: NAVIGATION_MAP,
      duplicates: [
        {
          kind: "shell",
          items: ["BackendShell", "ModuleShell"],
          note: "Dois shells convivem — planejar unificação atrás da flag `so_shell_enabled` sem remover o antigo.",
        },
        {
          kind: "home",
          items: ["/app (Hub do consultor)", "/hoje (Centro de Operações — novo)"],
          note: "Nova Home foi adicionada sem substituir a antiga. Migração gradual por perfil.",
        },
      ],
      gaps: [
        {
          kind: "info",
          message: "Rotina de auditoria ainda depende de scan sob demanda.",
          suggestion: "Programar cron 15min via pg_cron para /api/public/hooks/diagnostics.",
        },
        {
          kind: "info",
          message: "Biblioteca de UI ainda não centralizada.",
          suggestion: "Criar `src/components/ui-kit/` na próxima rodada.",
        },
      ],
      tech_health: {
        integrations_last_24h: Array.from(byProvider.values()),
        email_last_24h: { total: emailRows.length, failed: failedEmails },
      },
    };
  });
