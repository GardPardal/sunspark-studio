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
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listCrmLeads, updateLeadStage, deleteLead, updateLead } from "@/lib/crm.functions";
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
      { title: "CRM & Leads — Solar OS LZ7" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CrmPage,
});

export type LeadStage = "novo" | "atendimento" | "nao_atendido" | "venda" | "faturado" | "perdido";

const STAGES: {
  key: LeadStage;
  label: string;
  badgeTone: string;
  borderTone: string;
  bgLight: string;
}[] = [
  {
    key: "novo",
    label: "Novos & Triagem",
    badgeTone: "bg-blue-600 text-white",
    borderTone: "border-l-blue-500",
    bgLight: "bg-blue-500/5",
  },
  {
    key: "atendimento",
    label: "Em Atendimento",
    badgeTone: "bg-amber-500 text-white",
    borderTone: "border-l-amber-500",
    bgLight: "bg-amber-500/5",
  },
  {
    key: "nao_atendido",
    label: "Tentativa de Contato",
    badgeTone: "bg-slate-500 text-white",
    borderTone: "border-l-slate-400",
    bgLight: "bg-slate-500/5",
  },
  {
    key: "venda",
    label: "Proposta & Negociação",
    badgeTone: "bg-purple-600 text-white",
    borderTone: "border-l-purple-500",
    bgLight: "bg-purple-500/5",
  },
  {
    key: "faturado",
    label: "Venda Ganha / Fechado",
    badgeTone: "bg-emerald-600 text-white",
    borderTone: "border-l-emerald-500",
    bgLight: "bg-emerald-500/10",
  },
  {
    key: "perdido",
    label: "Perdido / Descarte",
    badgeTone: "bg-rose-500 text-white",
    borderTone: "border-l-rose-500",
    bgLight: "bg-rose-500/5",
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

const CAPTACAO_OPTIONS = [
  "Formulário Site",
  "Quiz Interativo",
  "WhatsApp Direto",
  "Ligação SDR",
  "Visita Presencial PAP",
  "Feira Comercial",
  "Indicação Parceiro",
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
};

function CrmPage() {
  const navigate = useNavigate();
  const getRole = useServerFn(getMyRole);
  const { data: role } = useQuery({ queryKey: ["my_role"], queryFn: () => getRole() });
  const fetchLeads = useServerFn(listCrmLeads);
  const leadsQuery = useQuery({
    queryKey: ["crm_leads"],
    queryFn: async (): Promise<Lead[]> => (await fetchLeads()) as Lead[],
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const search = Route.useSearch();
  const [view, setView] = useState<CrmView>(search.view ?? "meus");
  const [scope, setScope] = useState<CrmScope | undefined>(search.scope);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (search.view && search.view !== view) setView(search.view);
    if (search.scope !== scope) setScope(search.scope);
  }, [search.view, search.scope]);

  const myId = role?.userId;
  const allLeads = leadsQuery.data ?? [];

  const filtered = useMemo(() => {
    let base = allLeads;
    if (view === "brutos") base = allLeads.filter((l) => !l.assigned_to);
    else if (view === "offline")
      base = allLeads.filter((l: any) => l.is_offline && l.assigned_to === myId);
    else if (view === "todos") base = allLeads;
    else base = allLeads.filter((l) => l.assigned_to === myId);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(
        (l) =>
          l.nome.toLowerCase().includes(q) ||
          (l.telefone && l.telefone.includes(q)) ||
          (l.cidade && l.cidade.toLowerCase().includes(q)) ||
          (l.origem && l.origem.toLowerCase().includes(q)),
      );
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
  }, [allLeads, view, scope, myId, searchQuery]);

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
    <div className="min-h-screen bg-secondary/30 pb-20 font-sans text-foreground">
      <BackendTopBar
        title="CRM & Pipeline de Leads"
        subtitle="Quadro Kanban de Vendas · Direcionamento Comercial"
      />

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 space-y-4">
        {/* Barra Superior com Controles e Filtros */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3 sm:p-4 shadow-xs">
          <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full md:w-auto">
            <TabsList className="flex w-full md:w-auto flex-nowrap gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 no-scrollbar">
              <TabsTrigger value="meus" className="rounded-lg text-xs font-semibold px-3 py-1.5">
                Meus Leads
              </TabsTrigger>
              <TabsTrigger value="brutos" className="rounded-lg text-xs font-semibold px-3 py-1.5">
                Fila Comum (Sem Dono)
              </TabsTrigger>
              <TabsTrigger value="offline" className="rounded-lg text-xs font-semibold px-3 py-1.5">
                Leads PAP / Offline
              </TabsTrigger>
              {showTodos && (
                <TabsTrigger value="todos" className="rounded-lg text-xs font-semibold px-3 py-1.5">
                  Todos da Empresa
                </TabsTrigger>
              )}
              <TabsTrigger
                value="liz"
                className="rounded-lg text-xs font-semibold px-3 py-1.5 gap-1 text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Sparkles className="h-3.5 w-3.5" /> Liz IA Comercial
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-56">
              <Input
                placeholder="Buscar por nome, fone, cidade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 rounded-xl text-xs pl-3 bg-background border-border/60"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOfflineOpen(true)}
              className="rounded-xl h-8.5 text-xs font-semibold"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Novo Lead
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => leadsQuery.refetch()}
              disabled={leadsQuery.isFetching}
              className="rounded-xl h-8.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${leadsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {scope && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs">
            <span className="font-semibold text-primary">Filtro Ativo: {SCOPE_LABEL[scope]}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScope(undefined)}
              className="h-6 text-xs text-primary hover:bg-primary/20"
            >
              Limpar Filtro
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

/* ------------------------------ Kanban Board (Novo Layout Inspirado) ------------------------------ */

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

  // Se o lead aberto for atualizado no cache do query, mantém a referência fresca
  const currentDetails = useMemo(() => {
    if (!detailsTarget) return null;
    return leads.find((l) => l.id === detailsTarget.id) ?? detailsTarget;
  }, [detailsTarget, leads]);

  return (
    <section>
      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground text-sm rounded-2xl">
          Carregando pipeline de leads do CRM...
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-3.5 items-start">
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
                className={`flex flex-col rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xs shadow-xs transition-all ${
                  active ? "ring-2 ring-primary border-primary bg-primary/10 shadow-md" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col.key);
                }}
                onDragLeave={() => setDragOver((c) => (c === col.key ? null : c))}
                onDrop={(e) => onDrop(e, col.key)}
              >
                {/* Cabeçalho da Coluna (Estilo Moderno) */}
                <div className="p-3 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-display text-xs font-bold text-foreground truncate">
                      {col.label}
                    </span>
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-muted-foreground px-1.5">
                      {items.length}
                    </span>
                  </div>
                  {colTotal > 0 && (
                    <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                      {colTotal >= 1000
                        ? `R$ ${(colTotal / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`
                        : `R$ ${colTotal}`}
                    </span>
                  )}
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="p-2 space-y-2 min-h-[160px] max-h-[calc(100vh-280px)] overflow-y-auto">
                  {items.map((l) => (
                    <LeadKanbanCard
                      key={l.id}
                      lead={l}
                      borderTone={col.borderTone}
                      bgLight={col.bgLight}
                      isAdmin={isAdmin}
                      onMove={(s) => handleMove(l, s)}
                      onDelete={() => setDeleteTarget(l)}
                      onDragStart={(e) => onDragStart(e, l)}
                      onOpen={() => setDetailsTarget(l)}
                    />
                  ))}
                  {!items.length && (
                    <div className="flex flex-col items-center justify-center h-28 text-[11px] text-muted-foreground/60 border border-dashed border-border/50 rounded-xl">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir lead</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.nome}</strong>? Essa ação não
              pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => deleteTarget && removeMutation.mutate(deleteTarget.id)}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Central de Diagnóstico & Playbook 360 do Lead (Substitui abertura em edição bruta) */}
      <LeadPlaybookDialog
        lead={currentDetails}
        open={!!detailsTarget}
        onOpenChange={(o) => !o && setDetailsTarget(null)}
        onMoveStage={(st) => currentDetails && handleMove(currentDetails, st)}
      />
    </section>
  );
}

/* ------------------------------ Lead Kanban Card (Layout Clean da Imagem) ------------------------------ */

function LeadKanbanCard({
  lead,
  borderTone,
  bgLight,
  isAdmin,
  onMove,
  onDelete,
  onDragStart,
  onOpen,
}: {
  lead: Lead;
  borderTone: string;
  bgLight: string;
  isAdmin: boolean;
  onMove: (s: LeadStage) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onOpen: () => void;
}) {
  const phoneDigits = lead.telefone.replace(/\D/g, "");
  const initial = (lead.nome?.trim()?.[0] ?? "?").toUpperCase();

  // Origem resumida para badge
  let originLabel = lead.origem || "Orgânico";
  if (lead.quiz_data) originLabel = "Quiz Solar";
  else if (lead.fbclid) originLabel = "Meta Ads";
  else if (lead.gclid) originLabel = "Google Ads";
  else if (lead.utm_source) originLabel = lead.utm_source;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button,a,[role='combobox'],input,textarea,select")) return;
    onOpen();
  };

  // Cores de avatar agradáveis
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
      className={`group relative overflow-hidden rounded-xl border border-border/70 bg-card p-2.5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md cursor-pointer border-l-4 ${borderTone} ${
        lead.is_prioridade_emergencia ? "ring-2 ring-red-500/80 bg-red-500/5" : ""
      }`}
    >
      {/* Indicador de Emergência se houver */}
      {lead.is_prioridade_emergencia && (
        <div className="mb-1.5 flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-red-600">
          <AlertTriangle className="h-3 w-3" /> Emergência · Prioridade
        </div>
      )}

      {/* Topo do Card: Avatar + Nome + Botão de Abrir */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center font-display text-xs font-bold shadow-xs ${avatarClass}`}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <h4 className="font-display text-xs font-bold text-foreground truncate leading-tight group-hover:text-primary transition">
              {lead.nome}
            </h4>
            <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground mt-0.5">
              {lead.cidade ? (
                <span className="truncate flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5 shrink-0" /> {lead.cidade}
                </span>
              ) : (
                <span>{originLabel}</span>
              )}
            </div>
          </div>
        </div>

        {/* Ícone de Abertura / Detalhes (como na referência) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center transition"
          title="Ver ficha completa do lead"
        >
          <Edit3 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Badges de Valor e Origem */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge variant="secondary" className="text-[9.5px] font-medium px-1.5 py-0">
          {originLabel}
        </Badge>
        {lead.valor_conta && (
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
            ⚡ {lead.valor_conta}
          </span>
        )}
        {lead.sale_value != null && Number(lead.sale_value) > 0 && (
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            R$ {Number(lead.sale_value).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </span>
        )}
      </div>

      {/* Timer de Atendimento (se aplicável) */}
      <AtendimentoTimer lead={lead} />

      {/* Barra de Ações Rápidas no Rodapé do Card */}
      <div className="mt-2 flex items-center gap-1 border-t border-border/40 pt-1.5">
        <a
          href={`https://wa.me/55${phoneDigits}?text=${encodeURIComponent(
            `Olá ${lead.nome.split(" ")[0]}, tudo bem? Sou da LZ7 Energia Solar. Vi seu interesse e gostaria de apresentar a simulação para seu imóvel!`,
          )}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-6.5 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-[10.5px] font-semibold text-white shadow-xs transition"
          title="Chamar no WhatsApp"
        >
          <MessageCircle className="h-3 w-3" /> WhatsApp
        </a>

        {phoneDigits && (
          <a
            href={`tel:${phoneDigits}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-foreground hover:bg-secondary transition"
            title="Ligar"
          >
            <Phone className="h-3 w-3" />
          </a>
        )}

        <Select onValueChange={(v) => onMove(v as LeadStage)}>
          <SelectTrigger className="h-6.5 flex-1 rounded-lg px-1.5 text-[10px] font-medium">
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
            className="h-6.5 w-6.5 shrink-0 rounded-lg text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Excluir"
          >
            <Trash2 className="h-3 w-3" />
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

  // Formulário de Edição
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
      setActiveTab("norte"); // Sempre abre no Norte de Como Trabalhar
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

  // Determinação da Origem Clara
  let originLabel = lead.origem || "Orgânico";
  if (lead.quiz_data) originLabel = "Quiz Solar LZ7";
  else if (lead.fbclid) originLabel = "Meta Ads (Facebook/Instagram)";
  else if (lead.gclid) originLabel = "Google Ads";
  else if (lead.utm_source) originLabel = lead.utm_source;

  // Script Comercial Personalizado Sugerido
  let scriptSugerido = `Olá ${firstName}, tudo bem? Sou o consultor da LZ7 Energia Solar. Vi que você solicitou uma simulação de economia para sua conta de luz. Já montei o estudo preliminar com os painéis solares para você. Posso te enviar por aqui?`;
  if (originLabel.includes("Quiz")) {
    scriptSugerido = `Olá ${firstName}, aqui é da LZ7 Energia Solar! Recebi seu resultado da simulação pelo Quiz Solar onde você informou conta média de ${lead.valor_conta || "energia"}. Preparamos a proposta com a economia mensal garantida. Podemos conversar 2 minutinhos?`;
  } else if (
    originLabel.includes("Meta") ||
    originLabel.includes("Facebook") ||
    originLabel.includes("Instagram")
  ) {
    scriptSugerido = `Olá ${firstName}, tudo bem? Sou da equipe comercial da LZ7 Energia Solar. Você clicou no nosso anúncio sobre usinas solares de alta performance. Gostaria de entender melhor o padrão do seu imóvel para te apresentar a proposta sem compromisso!`;
  } else if (originLabel.includes("Indicação")) {
    scriptSugerido = `Olá ${firstName}, tudo bem? Sou da LZ7 Energia Solar. Fomos indicados para apresentar uma proposta personalizada de energia solar para você com condições exclusivas. Tem um momento para conversarmos?`;
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

            {/* Ações Rápidas de Contato no Cabeçalho */}
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

        {/* Seletor de Abas da Central do Lead */}
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

        {/* ABA 1: COMO TRABALHAR ESTE LEAD (O NORTE) */}
        {activeTab === "norte" && (
          <div className="space-y-4 py-2">
            {/* Quadro de Diagnóstico Rápido */}
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

            {/* Script Sugerido de Abordagem Comercial */}
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

            {/* Respostas do Quiz Solar ou Mensagem do Cliente */}
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

            {/* Fatura de Energia */}
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

            {/* Adicionar Nota Rápida de Atendimento */}
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

        {/* ABA 2: EDITAR INFORMAÇÕES & DADOS DO LEAD */}
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

        {/* ABA 3: CADÊNCIA & TAREFAS LIZ */}
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

/* ------------------------------ Cadence tasks (usado no detalhe do lead) ------------------------------ */

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
      <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-semibold mt-1">
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
        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold ${
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
