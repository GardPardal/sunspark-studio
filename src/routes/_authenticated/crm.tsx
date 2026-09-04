import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  DollarSign,
  Filter,
  Layers,
  CheckCircle,
  Building2,
  LogOut,
  ExternalLink,
  Sun,
  LayoutDashboard,
  RefreshCw,
  Trash2,
  GripVertical,
  UserPlus,
  TrendingUp,
  CalendarClock,
  Plus,
  Phone,
  MessageCircle,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Sparkles,
  Edit3,
  MapPin,
  Zap,
  Clock,
  User,
  Copy,
  FileText,
  Upload,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listCrmLeads, updateLeadStage, deleteLead, updateLead } from "@/lib/crm.functions";
import { triggerPloomesSync } from "@/lib/ploomes-webhooks.functions";
import { getMyRole } from "@/lib/admin-users.functions";
import {
  createOfflineLead,
  listLeadCadenceTasks,
  completeCadenceTask,
} from "@/lib/crm-advanced.functions";
import { confirmarAtendimento } from "@/lib/atendimento.functions";
import { CadenceBot } from "@/components/cadence-bot";
import { BackendTopBar } from "@/components/backend-shell";
import { LizChat } from "@/components/liz-chat";

type CrmScope = "emergencia" | "agenda" | "atrasados" | "novos" | "nao_atendido" | "vendas";
type CrmView = "meus" | "brutos" | "offline" | "todos" | "liz";

export const Route = createFileRoute("/_authenticated/crm")({
  validateSearch: (s: Record<string, unknown>): { view?: CrmView; scope?: CrmScope } => ({
    view: ["meus", "brutos", "offline", "todos", "liz"].includes(String(s.view ?? ""))
      ? (s.view as CrmView)
      : undefined,
    scope: ["emergencia", "agenda", "atrasados", "novos", "nao_atendido", "vendas"].includes(
      String(s.scope ?? ""),
    )
      ? (s.scope as CrmScope)
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "CRM & Pipeline de Leads — Solar OS LZ7" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CrmPage,
});

export type LeadStage = "novo" | "atendimento" | "nao_atendido" | "venda" | "faturado" | "perdido";

const STAGES: {
  key: LeadStage;
  label: string;
  dotColor: string;
  borderColor: string;
  bgHeader: string;
  description: string;
}[] = [
  {
    key: "novo",
    label: "Novos & Triagem",
    dotColor: "bg-blue-500",
    borderColor: "border-l-blue-500",
    bgHeader: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    description: "Leads recém-chegados aguardando contato",
  },
  {
    key: "atendimento",
    label: "Em Atendimento & Proposta",
    dotColor: "bg-amber-500",
    borderColor: "border-l-amber-500",
    bgHeader: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    description: "Apresentação, visita técnica ou negociação",
  },
  {
    key: "nao_atendido",
    label: "Tentativa de Contato",
    dotColor: "bg-slate-400",
    borderColor: "border-l-slate-400",
    bgHeader: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    description: "Sem retorno / Em cadência ativa",
  },
  {
    key: "venda",
    label: "Venda Fechada / Ganho",
    dotColor: "bg-purple-600",
    borderColor: "border-l-purple-600",
    bgHeader: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    description: "Negócio ganho no Ploomes / Contrato assinado",
  },
  {
    key: "faturado",
    label: "Faturado / Contrato Ativo",
    dotColor: "bg-emerald-500",
    borderColor: "border-l-emerald-500",
    bgHeader: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    description: "Faturamento confirmado no financeiro / Instalado",
  },
  {
    key: "perdido",
    label: "Perdido / Descarte",
    dotColor: "bg-rose-500",
    borderColor: "border-l-rose-500",
    bgHeader: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    description: "Desqualificado ou perdido no Ploomes",
  },
];

const ORIGEM_OPTIONS = [
  "Quiz Solar LZ7",
  "Meta Ads (Facebook/Instagram)",
  "Google Ads",
  "TikTok Ads",
  "Prospecção Ativa (PAP)",
  "Indicação de Cliente",
  "Site orgânico",
  "Feira/Evento",
  "Redes sociais",
  "SDR Qualificado",
  "Ploomes CRM",
  "Outro",
];

const PRODUTO_OPTIONS = [
  "Energia Solar Residencial",
  "Energia Solar Comercial",
  "Energia Solar Rural / Agro",
  "Energia Solar Industrial",
  "Carregador Veicular Elétrico",
  "Usinas de Investimento",
  "Manutenção & O&M",
];

export type LeadOriginInfo = {
  label: string;
  key: string;
  className: string;
};

export function getLeadOriginInfo(lead: Partial<Lead>): LeadOriginInfo {
  const orig = (lead.origem || "").toLowerCase();
  const msg = (lead.mensagem || "").toLowerCase();
  const capt = (lead.captacao_metodo || "").toLowerCase();
  const utm = (lead.utm_source || "").toLowerCase();

  // 1. Quiz Site (Tráfego Interno LZ7)
  if (
    orig.includes("quiz") ||
    msg.includes("quiz") ||
    capt.includes("quiz") ||
    utm.includes("quiz") ||
    lead.quiz_data
  ) {
    return {
      label: "Quiz Site",
      key: "quiz",
      className:
        "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-semibold",
    };
  }

  // 2. Tráfego Conecta (SDR Stephany Manual)
  if (
    orig.includes("conecta") ||
    orig.includes("sdr") ||
    orig.includes("meta whatsapp") ||
    msg.includes("sdr") ||
    capt.includes("sdr")
  ) {
    return {
      label: "Tráfego Conecta (SDR)",
      key: "conecta",
      className:
        "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-semibold",
    };
  }

  // 3. Prospecção Ativa (PAP / Consultores)
  if (
    orig.includes("pap") ||
    orig.includes("prospec") ||
    capt.includes("pap") ||
    capt.includes("prospec")
  ) {
    return {
      label: "PAP / Prospecção",
      key: "pap",
      className:
        "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-semibold",
    };
  }

  // 4. Indicações
  if (orig.includes("indica") || capt.includes("indica")) {
    return {
      label: "Indicação",
      key: "indicacao",
      className:
        "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-semibold",
    };
  }

  // 5. WhatsApp IA (LIZ)
  if (orig.includes("whatsapp ia") || capt.includes("liz_whatsapp") || orig.includes("liz")) {
    return {
      label: "WhatsApp IA",
      key: "whatsapp_ia",
      className:
        "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-500/30 font-semibold",
    };
  }

  // 6. Meta Ads
  if (
    lead.fbclid ||
    utm.includes("facebook") ||
    utm.includes("meta") ||
    orig.includes("meta ads")
  ) {
    return {
      label: "Meta Ads",
      key: "meta",
      className:
        "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-semibold",
    };
  }

  // 7. Google Ads
  if (lead.gclid || utm.includes("google") || orig.includes("google")) {
    return {
      label: "Google Ads",
      key: "google",
      className:
        "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-semibold",
    };
  }

  // 8. Ploomes CRM
  if (orig.includes("ploomes")) {
    return {
      label: "Ploomes CRM",
      key: "ploomes",
      className:
        "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30 font-semibold",
    };
  }

  return {
    label: lead.origem || "Orgânico",
    key: "outro",
    className: "bg-secondary text-secondary-foreground font-medium",
  };
}

export type Lead = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  valor_conta: string | null;
  mensagem: string | null;
  origem: string | null;
  stage: LeadStage;
  gclid: string | null;
  fbclid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  assigned_to: string | null;
  sale_value: number | null;
  sale_notes: string | null;
  created_at: string;
  stage_updated_at?: string | null;
  produto_interesse: string | null;
  captacao_metodo: string | null;
  objetivo: string | null;
  padrao_eletrico: string | null;
  tipo_encaminhamento: string | null;
  fatura_url: string | null;
  quiz_data?: Record<string, any> | null;
  atendimento_deadline: string | null;
  atendimento_confirmado_at: string | null;
  is_prioridade_emergencia: boolean | null;
  is_offline?: boolean | null;
  ploomes_deal_id?: number | null;
  pipeline_id?: number | null;
  pipeline_stage_id?: number | null;
  last_synced_at?: string | null;
  lead_quality?: string | null;
};

type DatePreset =
  | "todos"
  | "hoje"
  | "ontem"
  | "esta_semana"
  | "este_mes"
  | "mes_anterior"
  | "ultimos_30d"
  | "ultimos_90d"
  | "ano_atual"
  | "personalizado";

type DateFieldBasis = "created_at" | "stage_updated_at";

function getDateRange(preset: DatePreset, customFrom: string, customTo: string): { start: number | null; end: number | null; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (preset) {
    case "hoje": {
      const s = new Date(y, m, d, 0, 0, 0, 0).getTime();
      const e = new Date(y, m, d, 23, 59, 59, 999).getTime();
      return { start: s, end: e, label: "Hoje" };
    }
    case "ontem": {
      const s = new Date(y, m, d - 1, 0, 0, 0, 0).getTime();
      const e = new Date(y, m, d - 1, 23, 59, 59, 999).getTime();
      return { start: s, end: e, label: "Ontem" };
    }
    case "esta_semana": {
      const day = now.getDay();
      const diff = d - day + (day === 0 ? -6 : 1);
      const s = new Date(y, m, diff, 0, 0, 0, 0).getTime();
      return { start: s, end: now.getTime(), label: "Esta Semana" };
    }
    case "este_mes": {
      const s = new Date(y, m, 1, 0, 0, 0, 0).getTime();
      return { start: s, end: null, label: "Este Mês" };
    }
    case "mes_anterior": {
      const s = new Date(y, m - 1, 1, 0, 0, 0, 0).getTime();
      const e = new Date(y, m, 0, 23, 59, 59, 999).getTime();
      return { start: s, end: e, label: "Mês Anterior" };
    }
    case "ultimos_30d": {
      const s = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();
      return { start: s, end: now.getTime(), label: "Últimos 30 Dias" };
    }
    case "ultimos_90d": {
      const s = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).getTime();
      return { start: s, end: now.getTime(), label: "Últimos 90 Dias" };
    }
    case "ano_atual": {
      const s = new Date(y, 0, 1, 0, 0, 0, 0).getTime();
      return { start: s, end: null, label: "Ano Atual" };
    }
    case "personalizado": {
      const s = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : null;
      const e = customTo ? new Date(`${customTo}T23:59:59.999`).getTime() : null;
      return { start: s, end: e, label: `Personalizado (${customFrom || "..."} a ${customTo || "..."})` };
    }
    default:
      return { start: null, end: null, label: "Todo o Período" };
  }
}

function CrmPage() {
  const qc = useQueryClient();
  const getRole = useServerFn(getMyRole);
  const { data: role } = useQuery({ queryKey: ["my_role"], queryFn: () => getRole() });
  const fetchLeads = useServerFn(listCrmLeads);
  const syncPloomesFn = useServerFn(triggerPloomesSync);

  const leadsQuery = useQuery({
    queryKey: ["crm_leads"],
    queryFn: async (): Promise<Lead[]> => (await fetchLeads()) as Lead[],
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const syncPloomesMutation = useMutation({
    mutationFn: () => syncPloomesFn({ data: { limit: 500 } }),
    onSuccess: (r: any) => {
      if (r?.ok) {
        toast.success(
          `Ploomes sincronizado! ${r.synced} negócios atualizados (${r.assignedCount} responsáveis vinculados).`,
        );
        qc.invalidateQueries({ queryKey: ["crm_leads"] });
      } else {
        toast.error(r?.errors?.join(" | ") || "Falha na sincronização do Ploomes");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const search = Route.useSearch();
  const [view, setView] = useState<CrmView>(search.view ?? "meus");
  const [scope, setScope] = useState<CrmScope | undefined>(search.scope);
  const [originFilter, setOriginFilter] = useState<string>("todas");
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filtros de Data
  const [datePreset, setDatePreset] = useState<DatePreset>("todos");
  const [dateFieldBasis, setDateFieldBasis] = useState<DateFieldBasis>("created_at");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  useEffect(() => {
    if (search.view && search.view !== view) setView(search.view);
    if (search.scope !== scope) setScope(search.scope);
  }, [search.view, search.scope]);

  const myId = role?.userId;
  const allLeads = leadsQuery.data ?? [];

  const dateRange = useMemo(
    () => getDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const filtered = useMemo(() => {
    let base = allLeads;
    if (view === "brutos") base = allLeads.filter((l) => !l.assigned_to);
    else if (view === "offline")
      base = allLeads.filter((l: any) => l.is_offline && l.assigned_to === myId);
    else if (view === "todos") base = allLeads;
    else base = allLeads.filter((l) => l.assigned_to === myId);

    if (originFilter !== "todas") {
      base = base.filter((l) => getLeadOriginInfo(l).key === originFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(
        (l) =>
          l.nome.toLowerCase().includes(q) ||
          (l.telefone && l.telefone.includes(q)) ||
          (l.cidade && l.cidade.toLowerCase().includes(q)) ||
          (l.origem && l.origem.toLowerCase().includes(q)) ||
          getLeadOriginInfo(l).label.toLowerCase().includes(q),
      );
    }

    // Filtro temporal por intervalo de datas
    if (dateRange.start != null || dateRange.end != null) {
      base = base.filter((l) => {
        const targetIso =
          dateFieldBasis === "stage_updated_at" ? (l.stage_updated_at ?? l.created_at) : l.created_at;
        if (!targetIso) return true;
        const t = new Date(targetIso).getTime();
        if (isNaN(t)) return true;
        if (dateRange.start != null && t < dateRange.start) return false;
        if (dateRange.end != null && t > dateRange.end) return false;
        return true;
      });
    }

    if (!scope) return base;
    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    switch (scope) {
      case "emergencia":
        return base.filter((l) => l.is_prioridade_emergencia);
      case "agenda":
        return base.filter((l) => l.atendimento_deadline && !l.atendimento_confirmado_at);
      case "atrasados":
        return base.filter(
          (l) =>
            l.atendimento_deadline &&
            !l.atendimento_confirmado_at &&
            new Date(l.atendimento_deadline).getTime() < now,
        );
      case "novos":
        return base.filter((l) => l.stage === "novo");
      case "nao_atendido":
        return base.filter((l) => l.stage === "nao_atendido");
      case "vendas":
        return base.filter(
          (l) =>
            (l.stage === "venda" || l.stage === "faturado") &&
            new Date(l.stage_updated_at ?? l.created_at) >= monthStart,
        );
      default:
        return base;
    }
  }, [allLeads, view, scope, myId, searchQuery, originFilter, dateRange, dateFieldBasis]);

  // Estatísticas calculadas sobre a lista filtrada atual
  const stats = useMemo(() => {
    const total = filtered.length;
    const vendas = filtered.filter((l) => l.stage === "venda");
    const faturados = filtered.filter((l) => l.stage === "faturado");
    const totalVendasValor = vendas.reduce((sum, l) => sum + (Number(l.sale_value) || 0), 0);
    const totalFaturadoValor = faturados.reduce((sum, l) => sum + (Number(l.sale_value) || 0), 0);
    const taxaConversao =
      total > 0 ? (((vendas.length + faturados.length) / total) * 100).toFixed(1) : "0";

    return {
      total,
      vendasCount: vendas.length,
      vendasValor: totalVendasValor,
      faturadosCount: faturados.length,
      faturadosValor: totalFaturadoValor,
      taxaConversao,
    };
  }, [filtered]);

  const SCOPE_LABEL: Record<CrmScope, string> = {
    emergencia: "🔥 Emergências",
    agenda: "⏱️ Confirmar atendimento",
    atrasados: "⚠️ Atrasados",
    novos: "📥 Novos",
    nao_atendido: "📞 Não atendido",
    vendas: "💰 Vendas do mês",
  };

  const showTodos = !!(role?.isAdmin || role?.isCoordenador);

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-background pb-16 font-sans text-foreground">
      <BackendTopBar
        title="CRM & Pipeline de Leads"
        subtitle="Quadro Kanban de Vendas · Direcionamento Comercial"
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {/* Barra Superior de Controles, Visões, Filtros de Origem e Data */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-xs">
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
            {/* Abas de Visão */}
            <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full xl:w-auto">
              <TabsList className="flex w-full xl:w-auto flex-nowrap gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1 no-scrollbar">
                <TabsTrigger value="meus" className="rounded-lg text-xs font-semibold px-3.5 py-1.5">
                  Meus Leads
                </TabsTrigger>
                <TabsTrigger
                  value="brutos"
                  className="rounded-lg text-xs font-semibold px-3.5 py-1.5"
                >
                  Fila Comum (Sem Dono)
                </TabsTrigger>
                <TabsTrigger
                  value="offline"
                  className="rounded-lg text-xs font-semibold px-3.5 py-1.5"
                >
                  Leads PAP / Offline
                </TabsTrigger>
                {showTodos && (
                  <TabsTrigger
                    value="todos"
                    className="rounded-lg text-xs font-semibold px-3.5 py-1.5"
                  >
                    Todos da Empresa
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="liz"
                  className="rounded-lg text-xs font-semibold px-3.5 py-1.5 gap-1 text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Liz IA Comercial
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Ações e Botões de Sincronização */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncPloomesMutation.mutate()}
                disabled={syncPloomesMutation.isPending}
                className="rounded-xl h-9 text-xs font-semibold px-3 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10"
                title="Sincronizar negócios e responsáveis direto do Ploomes"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1.5 ${syncPloomesMutation.isPending ? "animate-spin" : ""}`}
                />
                {syncPloomesMutation.isPending ? "Sincronizando..." : "Sincronizar Ploomes"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOfflineOpen(true)}
                className="rounded-xl h-9 text-xs font-semibold px-3"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Novo Lead
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => leadsQuery.refetch()}
                disabled={leadsQuery.isFetching}
                className="rounded-xl h-9 text-xs px-3"
                title="Atualizar lista"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${leadsQuery.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Linha de Filtros: Origem, Data, Busca */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/50">
            {/* Filtro de Origem */}
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="h-9 w-[170px] rounded-xl text-xs bg-background border-border/70 font-medium">
                <SelectValue placeholder="Filtrar Origem" />
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="todas">Todas as Origens</SelectItem>
                <SelectItem value="quiz">🎯 Quiz Site (Tráfego)</SelectItem>
                <SelectItem value="conecta">💼 Tráfego Conecta (SDR)</SelectItem>
                <SelectItem value="pap">🚶 PAP / Prospecção</SelectItem>
                <SelectItem value="indicacao">🤝 Indicação</SelectItem>
                <SelectItem value="whatsapp_ia">🤖 WhatsApp IA</SelectItem>
                <SelectItem value="meta">📘 Meta Ads</SelectItem>
                <SelectItem value="google">🔍 Google Ads</SelectItem>
                <SelectItem value="ploomes">📁 Ploomes CRM</SelectItem>
              </SelectContent>
            </Select>

            {/* Seletor de Período / Data */}
            <div className="flex items-center gap-1.5 bg-background border border-border/70 rounded-xl px-2 h-9">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                <SelectTrigger className="h-7 w-[140px] border-0 bg-transparent text-xs p-0 font-medium shadow-none focus:ring-0">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="todos">Todo o Período</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="ontem">Ontem</SelectItem>
                  <SelectItem value="esta_semana">Esta Semana</SelectItem>
                  <SelectItem value="este_mes">Este Mês</SelectItem>
                  <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                  <SelectItem value="ultimos_30d">Últimos 30 Dias</SelectItem>
                  <SelectItem value="ultimos_90d">Últimos 90 Dias</SelectItem>
                  <SelectItem value="ano_atual">Ano Atual</SelectItem>
                  <SelectItem value="personalizado">📅 Personalizado...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Base da Data (Criação vs Etapa) */}
            <Select value={dateFieldBasis} onValueChange={(v) => setDateFieldBasis(v as DateFieldBasis)}>
              <SelectTrigger className="h-9 w-[160px] rounded-xl text-xs bg-background border-border/70 font-medium">
                <SelectValue placeholder="Base Temporal" />
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="created_at">Data de Entrada</SelectItem>
                <SelectItem value="stage_updated_at">Data da Etapa / Fechamento</SelectItem>
              </SelectContent>
            </Select>

            {/* Inputs Customizados quando Personalizado */}
            {datePreset === "personalizado" && (
              <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 w-32 rounded-xl text-xs bg-background border-border/70"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 w-32 rounded-xl text-xs bg-background border-border/70"
                />
              </div>
            )}

            {/* Busca textual */}
            <div className="relative flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por nome, fone, cidade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 rounded-xl text-xs pl-3 bg-background border-border/70"
              />
            </div>
          </div>
        </div>

        {/* Fita de Métricas do Período Filtrado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Total no Período</span>
              <Layers className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div className="mt-1 font-display text-lg font-bold text-foreground">
              {stats.total}{" "}
              <span className="text-xs font-normal text-muted-foreground">leads</span>
            </div>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-3 shadow-2xs">
            <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 text-xs">
              <span className="font-semibold">Vendas Fechadas</span>
              <CheckCircle className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <div className="mt-1 font-display text-lg font-bold text-purple-700 dark:text-purple-300">
              {stats.vendasCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({stats.vendasValor > 0 ? `R$ ${(stats.vendasValor / 1000).toFixed(0)}k` : "R$ 0"})
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-xs">
              <span className="font-semibold">Faturado / Contrato</span>
              <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="mt-1 font-display text-lg font-bold text-emerald-700 dark:text-emerald-300">
              {stats.faturadosCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({stats.faturadosValor > 0 ? `R$ ${(stats.faturadosValor / 1000).toFixed(0)}k` : "R$ 0"})
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Conversão Total</span>
              <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="mt-1 font-display text-lg font-bold text-foreground">
              {stats.taxaConversao}%{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({stats.vendasCount + stats.faturadosCount}/{stats.total})
              </span>
            </div>
          </div>
        </div>

        {/* Indicador de Filtros Ativos */}
        {(scope || datePreset !== "todos" || originFilter !== "todas") && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-primary">Filtros ativos:</span>
              {scope && (
                <Badge variant="secondary" className="text-[11px] font-medium">
                  {SCOPE_LABEL[scope]}
                </Badge>
              )}
              {datePreset !== "todos" && (
                <Badge variant="secondary" className="text-[11px] font-medium">
                  📅 {dateRange.label} ({dateFieldBasis === "created_at" ? "Entrada" : "Fechamento"})
                </Badge>
              )}
              {originFilter !== "todas" && (
                <Badge variant="secondary" className="text-[11px] font-medium">
                  🏷️ {originFilter.toUpperCase()}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setScope(undefined);
                setDatePreset("todos");
                setOriginFilter("todas");
                setSearchQuery("");
              }}
              className="h-6 text-xs text-primary hover:bg-primary/20"
            >
              Limpar Todos os Filtros
            </Button>
          </div>
        )}

        {view === "liz" ? (
          <LizChat />
        ) : (
          <KanbanBoard
            leads={filtered}
            isLoading={leadsQuery.isLoading}
            isAdmin={!!(role?.isAdmin || role?.isCoordenador)}
          />
        )}

        <OfflineLeadModal open={offlineOpen} onOpenChange={setOfflineOpen} />
      </main>
    </div>
  );
}

/* ------------------------------ Kanban Board (Horizontal Scroll Elegante & Espaçoso) ------------------------------ */

function KanbanBoard({
  leads,
  isLoading,
  isAdmin,
}: {
  leads: Lead[];
  isLoading: boolean;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const updateStage = useServerFn(updateLeadStage);
  const deleteLeadFn = useServerFn(deleteLead);

  const [dragOver, setDragOver] = useState<LeadStage | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [saleModal, setSaleModal] = useState<{ lead: Lead; stage: LeadStage } | null>(null);

  const mutation = useMutation({
    mutationFn: ({
      leadId,
      stage,
      saleValue,
      saleNotes,
    }: {
      leadId: string;
      stage: LeadStage;
      saleValue?: number;
      saleNotes?: string | null;
    }) => updateStage({ data: { leadId, stage, saleValue, saleNotes } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
      qc.invalidateQueries({ queryKey: ["admin_leads"] });
      qc.invalidateQueries({ queryKey: ["executive_bi"] });
      toast.success("Etapa do lead atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (leadId: string) => deleteLeadFn({ data: { leadId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
      qc.invalidateQueries({ queryKey: ["admin_leads"] });
      toast.success("Lead excluído com sucesso.");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleMove = (lead: Lead, stage: LeadStage) => {
    if (stage === lead.stage) return;
    if (stage === "venda" || stage === "faturado") {
      setSaleModal({ lead, stage });
      return;
    }
    mutation.mutate({ leadId: lead.id, stage });
  };

  const onDragStart = (e: React.DragEvent, lead: Lead) => {
    e.dataTransfer.setData("text/lead-id", lead.id);
    e.dataTransfer.setData("text/lead-stage", lead.stage);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = (e: React.DragEvent, stage: LeadStage) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/lead-id");
    const from = e.dataTransfer.getData("text/lead-stage") as LeadStage;
    if (!id || from === stage) return;
    const lead = leads.find((l) => l.id === id);
    if (lead) handleMove(lead, stage);
  };

  const currentDetails = useMemo(() => {
    if (!detailsTarget) return null;
    return leads.find((l) => l.id === detailsTarget.id) ?? detailsTarget;
  }, [detailsTarget, leads]);

  return (
    <section className="w-full">
      {isLoading ? (
        <Card className="p-12 text-center text-muted-foreground text-sm rounded-2xl">
          Carregando pipeline de leads do CRM...
        </Card>
      ) : (
        /* Container Horizontal Flex: Garante que cada coluna tenha pelo menos 300px de largura e nunca comprima o texto */
        <div className="flex gap-4 overflow-x-auto pb-8 pt-1 px-1 snap-x scrollbar-thin">
          {STAGES.map((col) => {
            const items = leads.filter((l) => l.stage === col.key);
            const active = dragOver === col.key;
            const colTotal = items.reduce(
              (acc, l) => acc + (l.sale_value ? Number(l.sale_value) : 0),
              0,
            );

            return (
              <div
                key={col.key}
                className={`w-[305px] min-w-[305px] shrink-0 flex flex-col rounded-2xl border border-border/70 bg-muted/30 dark:bg-card/40 backdrop-blur-xs shadow-xs transition-all ${
                  active ? "ring-2 ring-primary border-primary bg-primary/10 shadow-md" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col.key);
                }}
                onDragLeave={() => setDragOver((c) => (c === col.key ? null : c))}
                onDrop={(e) => onDrop(e, col.key)}
              >
                {/* Cabeçalho da Coluna: Título Completo sem cortes + Contador + Valor Total */}
                <div className="px-3.5 py-3 border-b border-border/50 flex items-center justify-between bg-card/60 rounded-t-2xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2.5 w-2.5 rounded-full ${col.dotColor} shrink-0`} />
                    <h3 className="font-display text-xs font-bold text-foreground truncate">
                      {col.label}
                    </h3>
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-muted-foreground px-1.5">
                      {items.length}
                    </span>
                  </div>
                  {colTotal > 0 && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                      {colTotal >= 1000
                        ? `R$ ${(colTotal / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`
                        : `R$ ${colTotal}`}
                    </span>
                  )}
                </div>

                {/* Lista de Cards da Coluna com Scroll Vertical Independente */}
                <div className="p-2.5 space-y-2.5 min-h-[220px] max-h-[calc(100vh-250px)] overflow-y-auto">
                  {items.map((l) => (
                    <LeadKanbanCard
                      key={l.id}
                      lead={l}
                      borderColor={col.borderColor}
                      isAdmin={isAdmin}
                      onMove={(s) => handleMove(l, s)}
                      onDelete={() => setDeleteTarget(l)}
                      onDragStart={(e) => onDragStart(e, l)}
                      onOpen={() => setDetailsTarget(l)}
                    />
                  ))}
                  {!items.length && (
                    <div className="flex flex-col items-center justify-center h-32 text-xs text-muted-foreground/60 border border-dashed border-border/60 rounded-xl bg-card/20">
                      Nenhum lead nesta etapa
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Registro de Venda */}
      <SaleDialog
        open={!!saleModal}
        onOpenChange={(o) => !o && setSaleModal(null)}
        lead={saleModal?.lead}
        stage={saleModal?.stage}
        onConfirm={(v, n) => {
          if (!saleModal) return;
          mutation.mutate({
            leadId: saleModal.lead.id,
            stage: saleModal.stage,
            saleValue: v,
            saleNotes: n,
          });
          setSaleModal(null);
        }}
      />

      {/* Modal de Exclusão */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Excluir lead</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.nome}</strong>? Essa ação não
              pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => deleteTarget && removeMutation.mutate(deleteTarget.id)}
              className="rounded-xl"
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Central de Diagnóstico & Playbook 360 do Lead */}
      <LeadPlaybookDialog
        lead={currentDetails}
        open={!!detailsTarget}
        onOpenChange={(o) => !o && setDetailsTarget(null)}
        onMoveStage={(st) => currentDetails && handleMove(currentDetails, st)}
      />
    </section>
  );
}

/* ------------------------------ Lead Kanban Card (Layout Limpo, Espaçoso e Elegante) ------------------------------ */

function LeadKanbanCard({
  lead,
  borderColor,
  isAdmin,
  onMove,
  onDelete,
  onDragStart,
  onOpen,
}: {
  lead: Lead;
  borderColor: string;
  isAdmin: boolean;
  onMove: (s: LeadStage) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onOpen: () => void;
}) {
  const phoneDigits = lead.telefone.replace(/\D/g, "");
  const initial = (lead.nome?.trim()?.[0] ?? "?").toUpperCase();
  const originInfo = getLeadOriginInfo(lead);

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button,a,[role='combobox'],input,textarea,select")) return;
    onOpen();
  };

  const avatarColors = [
    "bg-emerald-500 text-white",
    "bg-blue-500 text-white",
    "bg-amber-500 text-white",
    "bg-purple-500 text-white",
    "bg-indigo-500 text-white",
  ];
  const colorIndex = (lead.nome?.charCodeAt(0) || 0) % avatarColors.length;
  const avatarClass = avatarColors[colorIndex];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={handleCardClick}
      className={`group relative overflow-hidden rounded-xl border border-border/80 bg-card p-3 shadow-xs transition-all hover:border-primary/50 hover:shadow-md cursor-pointer border-l-4 ${borderColor} ${
        lead.is_prioridade_emergencia ? "ring-2 ring-red-500/80 bg-red-500/5" : ""
      }`}
    >
      {/* Alerta de Emergência se houver */}
      {lead.is_prioridade_emergencia && (
        <div className="mb-2 flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
          <AlertTriangle className="h-3 w-3" /> Emergência · Atendimento Prioritário
        </div>
      )}

      {/* Topo do Card: Avatar + Nome Completo + Cidade + Botão de Ficha */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center font-display text-xs font-bold shadow-xs ${avatarClass}`}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <h4
              className="font-display text-xs font-bold text-foreground truncate leading-tight group-hover:text-primary transition"
              title={lead.nome}
            >
              {lead.nome}
            </h4>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
              {lead.cidade ? (
                <span
                  className="truncate flex items-center gap-0.5"
                  title={`${lead.cidade}${lead.estado ? `/${lead.estado}` : ""}`}
                >
                  <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/80" /> {lead.cidade}
                </span>
              ) : (
                <span>{originInfo.label}</span>
              )}
            </div>
          </div>
        </div>

        {/* Botão de Ver Ficha Completa */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center transition shrink-0"
          title="Abrir ficha e direcionamento do lead"
        >
          <Edit3 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Badges de Origem e Valores com Espaçamento Amplo */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-md shadow-2xs ${originInfo.className}`}
        >
          {originInfo.label}
        </span>
        {lead.ploomes_deal_id && (
          <a
            href={`https://app.ploomes.com/#/deals/${lead.ploomes_deal_id}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 transition"
            title="Abrir Negócio no Ploomes"
          >
            Ploomes #{lead.ploomes_deal_id} ↗
          </a>
        )}
        {lead.valor_conta && (
          <span className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
            ⚡ {lead.valor_conta}
          </span>
        )}
        {lead.sale_value != null && Number(lead.sale_value) > 0 && (
          <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
            R$ {Number(lead.sale_value).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </span>
        )}
      </div>

      {/* Timer de Atendimento (se aplicável) */}
      <AtendimentoTimer lead={lead} />

      {/* Barra de Ações Rápidas no Rodapé do Card (Espaçosa e Proporcional) */}
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-border/50 pt-2">
        <a
          href={`https://wa.me/55${phoneDigits}?text=${encodeURIComponent(
            `Olá ${lead.nome.split(" ")[0]}, tudo bem? Sou da LZ7 Energia Solar. Vi seu interesse e gostaria de apresentar a simulação para seu imóvel!`,
          )}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-7.5 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-[11px] font-semibold text-white shadow-xs transition"
          title="Chamar no WhatsApp"
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </a>

        {phoneDigits && (
          <a
            href={`tel:${phoneDigits}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-foreground hover:bg-secondary transition"
            title="Ligar"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}

        <Select onValueChange={(v) => onMove(v as LeadStage)}>
          <SelectTrigger className="h-7.5 w-[90px] rounded-lg px-2 text-[11px] font-medium border-border/70">
            <SelectValue placeholder="Mover" />
          </SelectTrigger>
          <SelectContent>
            {STAGES.filter((s) => s.key !== lead.stage).map((s) => (
              <SelectItem key={s.key} value={s.key} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7.5 w-7.5 shrink-0 rounded-lg text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Lead Playbook & 360 Dialog (O NORTE DE COMO TRABALHAR) ------------------------------ */

function LeadPlaybookDialog({
  lead,
  open,
  onOpenChange,
  onMoveStage,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onMoveStage: (st: LeadStage) => void;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateLead);

  const [activeTab, setActiveTab] = useState<"norte" | "editar" | "cadencia">("norte");
  const [copiedScript, setCopiedScript] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [uploadingFatura, setUploadingFatura] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    email: "",
    cidade: "",
    estado: "",
    valor_conta: "",
    mensagem: "",
    sale_notes: "",
    origem: "",
    produto_interesse: "",
    captacao_metodo: "",
    objetivo: "",
    padrao_eletrico: "",
    tipo_encaminhamento: "",
    fatura_url: "",
  });
  const [saleDigits, setSaleDigits] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (lead && loadedFor !== lead.id) {
      setForm({
        nome: lead.nome ?? "",
        telefone: lead.telefone ?? "",
        email: lead.email ?? "",
        cidade: lead.cidade ?? "",
        estado: lead.estado ?? "",
        valor_conta: lead.valor_conta ?? "",
        mensagem: lead.mensagem ?? "",
        sale_notes: lead.sale_notes ?? "",
        origem: lead.origem ?? "",
        produto_interesse: lead.produto_interesse ?? "",
        captacao_metodo: lead.captacao_metodo ?? "",
        objetivo: lead.objetivo ?? "",
        padrao_eletrico: lead.padrao_eletrico ?? "",
        tipo_encaminhamento: lead.tipo_encaminhamento ?? "",
        fatura_url: lead.fatura_url ?? "",
      });
      setSaleDigits(numberToCents(lead.sale_value));
      setLoadedFor(lead.id);
      setActiveTab("norte");
    }
  }, [lead, loadedFor]);

  const mutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      updateFn({ data: { leadId: lead!.id, patch: patch as any } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
      qc.invalidateQueries({ queryKey: ["admin_leads"] });
      toast.success("Informações do lead salvas com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!lead) return null;

  const phoneDigits = lead.telefone.replace(/\D/g, "");
  const firstName = lead.nome.split(" ")[0] || "Cliente";
  const originInfo = getLeadOriginInfo(lead);
  const originLabel = originInfo.label;

  let scriptSugerido = `Olá ${firstName}, tudo bem? Sou o consultor da LZ7 Energia Solar. Vi que você solicitou uma simulação de economia para sua conta de luz. Já montei o estudo preliminar com os painéis solares para você. Posso te enviar por aqui?`;
  if (originInfo.key === "quiz" || originLabel.includes("Quiz")) {
    scriptSugerido = `Olá ${firstName}, aqui é da LZ7 Energia Solar! Recebi seu resultado da simulação pelo Quiz Solar onde você informou conta média de ${lead.valor_conta || "energia"}. Preparamos a proposta com a economia mensal garantida. Podemos conversar 2 minutinhos?`;
  } else if (originInfo.key === "conecta") {
    scriptSugerido = `Olá ${firstName}, tudo bem? Sou da LZ7 Energia Solar. Nossa consultora Stephany me passou seu contato sobre o interesse em energia solar. Gostaria de te apresentar o estudo personalizado com a melhor condição para sua região!`;
  } else if (originInfo.key === "pap") {
    scriptSugerido = `Olá ${firstName}, tudo bem? Estivemos conversando recentemente sobre o potencial de energia solar para o seu imóvel. Montei o orçamento detalhado com a projeção de economia. Posso te apresentar?`;
  } else if (originInfo.key === "indicacao" || originLabel.includes("Indicação")) {
    scriptSugerido = `Olá ${firstName}, tudo bem? Sou da LZ7 Energia Solar. Fomos indicados para apresentar uma proposta personalizada de energia solar para você com condições exclusivas. Tem um momento para conversarmos?`;
  } else if (
    originInfo.key === "meta" ||
    originLabel.includes("Meta") ||
    originLabel.includes("Facebook") ||
    originLabel.includes("Instagram")
  ) {
    scriptSugerido = `Olá ${firstName}, tudo bem? Sou da equipe comercial da LZ7 Energia Solar. Você clicou no nosso anúncio sobre usinas solares de alta performance. Gostaria de entender melhor o padrão do seu imóvel para te apresentar a proposta sem compromisso!`;
  }

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptSugerido);
    setCopiedScript(true);
    toast.success("Script copiado para a área de transferência!");
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleSaveForm = () => {
    mutation.mutate({
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      email: form.email.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim() || null,
      valor_conta: form.valor_conta.trim() || null,
      mensagem: form.mensagem.trim() || null,
      origem: form.origem.trim() || null,
      produto_interesse: form.produto_interesse.trim() || null,
      captacao_metodo: form.captacao_metodo.trim() || null,
      objetivo: form.objetivo.trim() || null,
      padrao_eletrico: (form.padrao_eletrico || null) as any,
      tipo_encaminhamento: (form.tipo_encaminhamento || null) as any,
      fatura_url: form.fatura_url || null,
      sale_value: saleDigits ? centsToNumber(saleDigits) : null,
      sale_notes: form.sale_notes.trim() || null,
    });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const dateStr = new Date().toLocaleString("pt-BR");
    const updatedNotes = form.sale_notes
      ? `[${dateStr}]: ${newNote.trim()}\n${form.sale_notes}`
      : `[${dateStr}]: ${newNote.trim()}`;
    setForm((f) => ({ ...f, sale_notes: updatedNotes }));
    mutation.mutate({ sale_notes: updatedNotes });
    setNewNote("");
  };

  const handleFaturaUpload = async (file: File) => {
    setUploadingFatura(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${lead.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("faturas").upload(path, file, { upsert: true });
      if (error) throw error;
      setForm((f) => ({ ...f, fatura_url: path }));
      mutation.mutate({ fatura_url: path });
      toast.success("Fatura enviada e anexada ao lead.");
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar fatura.");
    } finally {
      setUploadingFatura(false);
    }
  };

  const openFatura = async () => {
    if (!form.fatura_url) return;
    const { data } = await supabase.storage
      .from("faturas")
      .createSignedUrl(form.fatura_url, 60 * 10);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-semibold">
                  {originLabel}
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-xs capitalize font-bold bg-primary/10 text-primary border-primary/20"
                >
                  Etapa: {lead.stage}
                </Badge>
              </div>
              <DialogTitle className="font-display text-xl sm:text-2xl font-bold text-foreground mt-1">
                {lead.nome}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <Clock className="h-3 w-3" />
                Cadastrado em {new Date(lead.created_at).toLocaleDateString("pt-BR")} às{" "}
                {new Date(lead.created_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                asChild
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
              >
                <a
                  href={`https://wa.me/55${phoneDigits}?text=${encodeURIComponent(scriptSugerido)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-4 w-4 mr-1.5" /> Chamar WhatsApp
                </a>
              </Button>
              {phoneDigits && (
                <Button asChild size="sm" variant="outline" className="rounded-xl">
                  <a href={`tel:${phoneDigits}`}>
                    <Phone className="h-4 w-4 mr-1.5" /> Ligar
                  </a>
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Abas da Ficha do Lead */}
        <div className="flex items-center gap-1 border-b border-border/60 pb-2 pt-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("norte")}
            className={`rounded-xl px-3.5 py-1.5 transition ${
              activeTab === "norte"
                ? "bg-primary text-primary-foreground shadow-xs font-bold"
                : "bg-secondary/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            🧭 Como Trabalhar este Lead (O Norte)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("editar")}
            className={`rounded-xl px-3.5 py-1.5 transition ${
              activeTab === "editar"
                ? "bg-primary text-primary-foreground shadow-xs font-bold"
                : "bg-secondary/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            ✏️ Editar Informações & Venda
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cadencia")}
            className={`rounded-xl px-3.5 py-1.5 transition ${
              activeTab === "cadencia"
                ? "bg-primary text-primary-foreground shadow-xs font-bold"
                : "bg-secondary/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            🤖 Cadência & Histórico
          </button>
        </div>

        {/* ABA 1: COMO TRABALHAR ESTE LEAD */}
        {activeTab === "norte" && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/60 bg-card p-3 shadow-xs">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-500" /> Canal de Captação
                </span>
                <p className="font-bold text-sm text-foreground mt-1">{originLabel}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {lead.utm_campaign ? `Campanha: ${lead.utm_campaign}` : "Captação direta"}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-3 shadow-xs">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-blue-500" /> Localização & Fone
                </span>
                <p className="font-bold text-sm text-foreground mt-1">
                  {lead.cidade || "Cidade não informada"} {lead.estado ? `/${lead.estado}` : ""}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {lead.telefone}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-3 shadow-xs">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-500" /> Conta / Potencial
                </span>
                <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                  {lead.valor_conta ? `⚡ ${lead.valor_conta}` : "Não informado"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {lead.produto_interesse || "Energia Solar"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Roteiro de Abordagem Ideal (Script Rápido)
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyScript}
                  className="rounded-xl h-7 text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {copiedScript ? "Copiado!" : "Copiar Script"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed bg-card p-3 rounded-xl border border-border/40 font-mono">
                {scriptSugerido}
              </p>
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  asChild
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs"
                >
                  <a
                    href={`https://wa.me/55${phoneDigits}?text=${encodeURIComponent(scriptSugerido)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1" /> Enviar este script no WhatsApp
                  </a>
                </Button>
              </div>
            </div>

            {(lead.quiz_data || lead.mensagem) && (
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs space-y-2">
                <h4 className="font-display text-xs font-bold text-foreground">
                  📋 Dados Fornecidos pelo Cliente no Formulário / Quiz
                </h4>
                {lead.mensagem && (
                  <p className="text-xs text-muted-foreground bg-secondary/40 p-2.5 rounded-xl border border-border/40">
                    "{lead.mensagem}"
                  </p>
                )}
                {lead.quiz_data && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    {Object.entries(lead.quiz_data).map(([k, v]) => (
                      <div
                        key={k}
                        className="p-2 rounded-xl bg-secondary/20 border border-border/40"
                      >
                        <span className="font-semibold text-foreground capitalize">
                          {k.replace(/_/g, " ")}:
                        </span>{" "}
                        <span className="text-muted-foreground">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <h4 className="font-display text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-primary" /> Fatura de Energia Elétrica
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {form.fatura_url ? "Fatura anexada ao cadastro" : "Nenhuma fatura enviada ainda"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {form.fatura_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openFatura}
                    className="rounded-xl text-xs"
                  >
                    Visualizar Fatura
                  </Button>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFaturaUpload(f);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-xl text-xs pointer-events-none"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {uploadingFatura ? "Enviando..." : "Anexar Fatura"}
                  </Button>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs space-y-2">
              <h4 className="font-display text-xs font-bold text-foreground">
                📝 Registrar Andamento / Anotação de Venda
              </h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Liguei e cliente pediu proposta para 500 kWh..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="text-xs rounded-xl"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddNote();
                  }}
                />
                <Button size="sm" onClick={handleAddNote} className="rounded-xl text-xs shrink-0">
                  Salvar Nota
                </Button>
              </div>
              {form.sale_notes && (
                <div className="mt-2 rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground whitespace-pre-wrap font-mono border border-border/40 max-h-36 overflow-y-auto">
                  {form.sale_notes}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA 2: EDITAR INFORMAÇÕES */}
        {activeTab === "editar" && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <Label htmlFor="d-nome">Nome Completo *</Label>
                <Input
                  id="d-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label htmlFor="d-tel">Telefone / WhatsApp *</Label>
                <Input
                  id="d-tel"
                  inputMode="tel"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label htmlFor="d-email">E-mail</Label>
                <Input
                  id="d-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label htmlFor="d-cidade">Cidade</Label>
                <Input
                  id="d-cidade"
                  value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label htmlFor="d-estado">Estado (UF)</Label>
                <Input
                  id="d-estado"
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label>Valor Médio da Conta</Label>
                <Input
                  value={form.valor_conta}
                  onChange={(e) => setForm({ ...form, valor_conta: e.target.value })}
                  placeholder="Ex: R$ 850,00"
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label>Valor Fechado / Proposta (R$)</Label>
                <CurrencyInput value={saleDigits} onChange={setSaleDigits} placeholder="R$ 0,00" />
              </div>
              <div>
                <Label>Origem do Lead</Label>
                <Select
                  value={form.origem || undefined}
                  onValueChange={(v) => setForm({ ...form, origem: v })}
                >
                  <SelectTrigger className="rounded-xl mt-1">
                    <SelectValue placeholder="Selecionar canal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGEM_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Produto de Interesse</Label>
                <Select
                  value={form.produto_interesse || undefined}
                  onValueChange={(v) => setForm({ ...form, produto_interesse: v })}
                >
                  <SelectTrigger className="rounded-xl mt-1">
                    <SelectValue placeholder="Selecionar produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUTO_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                onClick={() => setActiveTab("norte")}
                className="rounded-xl"
              >
                Voltar
              </Button>
              <Button
                onClick={handleSaveForm}
                disabled={mutation.isPending}
                className="rounded-xl font-bold"
              >
                {mutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        )}

        {/* ABA 3: CADÊNCIA */}
        {activeTab === "cadencia" && (
          <div className="space-y-4 py-2">
            <LeadCadenceTasks leadId={lead.id} canWrite={true} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Currency helpers ------------------------------ */

function formatCentsToBRL(digits: string): string {
  const cents = (digits || "").replace(/\D/g, "").replace(/^0+/, "") || "0";
  const padded = cents.padStart(3, "0");
  const intPart = padded.slice(0, -2);
  const decPart = padded.slice(-2);
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${withThousands},${decPart}`;
}

function centsToNumber(digits: string): number {
  const cents = (digits || "").replace(/\D/g, "");
  if (!cents) return 0;
  return Number(cents) / 100;
}

function numberToCents(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "";
  return String(Math.round(n * 100));
}

function CurrencyInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      value={value ? formatCentsToBRL(value) : ""}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      placeholder={placeholder ?? "R$ 0,00"}
      className="rounded-xl mt-1"
    />
  );
}

/* ------------------------------ SaleDialog ------------------------------ */

function SaleDialog({
  open,
  onOpenChange,
  lead,
  stage,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead?: Lead;
  stage?: LeadStage;
  onConfirm: (value: number, notes: string | null) => void;
}) {
  const [digits, setDigits] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setDigits("");
          setNotes("");
        }
      }}
    >
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            Registrar {stage === "faturado" ? "faturamento" : "venda ganha"}
          </DialogTitle>
          <DialogDescription>
            Ao confirmar, o valor de {lead?.nome} entra automaticamente para o Ranking e
            Faturamento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Lead</Label>
            <div className="text-sm font-bold text-foreground">
              {lead?.nome} — {lead?.telefone}
            </div>
          </div>
          <div>
            <Label htmlFor="sv">Valor do Contrato Fechado</Label>
            <CurrencyInput id="sv" value={digits} onChange={setDigits} />
          </div>
          <div>
            <Label htmlFor="sn">Observações da Venda (opcional)</Label>
            <Textarea
              id="sn"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(centsToNumber(digits), notes || null)}
            disabled={!digits || centsToNumber(digits) <= 0}
            className="rounded-xl font-bold"
          >
            Confirmar Venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Cadence tasks ------------------------------ */

export function LeadCadenceTasks({ leadId, canWrite }: { leadId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listLeadCadenceTasks);
  const completeFn = useServerFn(completeCadenceTask);
  const { data: tasks = [] } = useQuery({
    queryKey: ["cadence_tasks", leadId],
    queryFn: () => fetchFn({ data: { leadId } }),
  });
  const doneM = useMutation({
    mutationFn: (id: string) => completeFn({ data: { taskId: id, notes: null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cadence_tasks", leadId] });
      toast.success("Passo concluído.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const now = Date.now();
  return (
    <div className="space-y-2">
      {!tasks.length && (
        <div className="text-xs text-muted-foreground py-4 text-center">
          Nenhuma tarefa de cadência pendente para este lead.
        </div>
      )}
      {tasks.map((t: any) => {
        const overdue = !t.completed_at && new Date(t.due_at).getTime() < now;
        return (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs ${
              overdue
                ? "border-red-300 bg-red-500/10 text-red-600"
                : t.completed_at
                  ? "opacity-60 bg-muted/30 border-border/40"
                  : "border-border/60 bg-card"
            }`}
          >
            <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground truncate">{t.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(t.due_at).toLocaleString("pt-BR")} · {t.channel}
              </div>
            </div>
            {!t.completed_at && canWrite && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-lg"
                onClick={() => doneM.mutate(t.id)}
              >
                Concluir
              </Button>
            )}
            {t.completed_at && (
              <span className="text-[11px] font-bold text-emerald-600">✓ Feito</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------- AtendimentoTimer (2h úteis) --------------------- */
function AtendimentoTimer({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const confirmFn = useServerFn(confirmarAtendimento);
  const [now, setNow] = useState(() => Date.now());

  const confirmM = useMutation({
    mutationFn: () => confirmFn({ data: { leadId: lead.id } }),
    onSuccess: () => {
      toast.success("Atendimento confirmado. Timer pausado.");
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasDeadline = !!lead.atendimento_deadline && !lead.atendimento_confirmado_at;

  useEffect(() => {
    if (!hasDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [hasDeadline]);

  if (lead.atendimento_confirmado_at) {
    return (
      <div className="flex items-center gap-1 text-[10.5px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-semibold mt-1">
        <CheckCircle2 className="h-3 w-3" /> Atendimento confirmado
      </div>
    );
  }
  if (!hasDeadline) return null;

  const deadlineMs = new Date(lead.atendimento_deadline!).getTime();
  const diff = deadlineMs - now;
  const overdue = diff <= 0;
  const abs = Math.abs(diff);
  const hh = Math.floor(abs / 3_600_000);
  const mm = Math.floor((abs % 3_600_000) / 60_000);
  const label = overdue
    ? `Estourou há ${hh}h${String(mm).padStart(2, "0")}`
    : `Faltam ${hh}h${String(mm).padStart(2, "0")}`;

  return (
    <div className="space-y-1 mt-1.5">
      <div
        className={`flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-md font-bold ${
          overdue
            ? "bg-red-500/15 text-red-600"
            : diff < 30 * 60_000
              ? "bg-amber-500/15 text-amber-700"
              : "bg-blue-500/15 text-blue-700"
        }`}
      >
        <Timer className="h-3 w-3" /> {label} pra 1º contato
      </div>
    </div>
  );
}

/* ------------------------------ OfflineLeadModal (PAP) ------------------------------ */

function OfflineLeadModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const createOffline = useServerFn(createOfflineLead);

  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    cidade: "",
    estado: "PR",
    valor_conta: "",
    observacoes: "",
    origem: "Prospecção Ativa (PAP)",
  });

  const saveM = useMutation({
    mutationFn: () => createOffline({ data: form as any }),
    onSuccess: () => {
      toast.success("Lead cadastrado com sucesso!");
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
      onOpenChange(false);
      setForm({
        nome: "",
        telefone: "",
        cidade: "",
        estado: "PR",
        valor_conta: "",
        observacoes: "",
        origem: "Prospecção Ativa (PAP)",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = form.nome.trim().length >= 2 && form.telefone.replace(/\D/g, "").length >= 8;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Novo Lead (Prospecção / PAP / Avulso)</DialogTitle>
          <DialogDescription>
            Cadastre um novo lead e direcione-o imediatamente para sua esteira.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div>
            <Label htmlFor="off-nome">Nome do Lead *</Label>
            <Input
              id="off-nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Roberto Silva"
              className="rounded-xl mt-1"
            />
          </div>
          <div>
            <Label htmlFor="off-tel">Telefone / WhatsApp *</Label>
            <Input
              id="off-tel"
              inputMode="tel"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="Ex: (43) 99999-9999"
              className="rounded-xl mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="off-cid">Cidade</Label>
              <Input
                id="off-cid"
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                placeholder="Ex: Londrina"
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label htmlFor="off-uf">Estado</Label>
              <Input
                id="off-uf"
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
                className="rounded-xl mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="off-val">Gasto Médio com Energia</Label>
            <Input
              id="off-val"
              value={form.valor_conta}
              onChange={(e) => setForm({ ...form, valor_conta: e.target.value })}
              placeholder="Ex: R$ 650,00"
              className="rounded-xl mt-1"
            />
          </div>
          <div>
            <Label>Origem</Label>
            <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
              <SelectTrigger className="rounded-xl mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORIGEM_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="off-obs">Observações Iniciais</Label>
            <Textarea
              id="off-obs"
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Ex: Cliente tem mercado e quer usina no telhado..."
              className="rounded-xl mt-1"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={() => saveM.mutate()}
            disabled={saveM.isPending || !canSubmit}
            className="rounded-xl font-bold"
          >
            {saveM.isPending ? "Cadastrando..." : "Cadastrar Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
