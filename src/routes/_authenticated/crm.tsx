import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { LogOut, ExternalLink, Sun, LayoutDashboard, RefreshCw, Trash2, GripVertical, UserPlus, TrendingUp, CalendarClock, Plus, Phone, MessageCircle, Smartphone } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listCrmLeads, updateLeadStage, deleteLead, updateLead } from "@/lib/crm.functions";
import { getMyRole } from "@/lib/admin-users.functions";
import { createOfflineLead, listLeadCadenceTasks, completeCadenceTask } from "@/lib/crm-advanced.functions";
import { CadenceBot } from "@/components/cadence-bot";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "CRM — LZ7 Energia" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CrmPage,
});

const STAGES: { key: LeadStage; label: string; tone: string }[] = [
  { key: "novo", label: "Novo", tone: "bg-blue-500" },
  { key: "atendimento", label: "Em atendimento", tone: "bg-amber-500" },
  { key: "nao_atendido", label: "Não atendido", tone: "bg-slate-500" },
  { key: "venda", label: "Venda", tone: "bg-emerald-500" },
  { key: "faturado", label: "Faturado", tone: "bg-primary" },
  { key: "perdido", label: "Perdido", tone: "bg-red-500" },
];

type LeadStage = "novo" | "atendimento" | "nao_atendido" | "venda" | "faturado" | "perdido";

const ORIGEM_OPTIONS = [
  "Google Ads", "Meta Ads", "TikTok Ads", "Indicação",
  "Site orgânico", "Feira/Evento", "Porta a porta", "Redes sociais", "Outros",
];
const CAPTACAO_OPTIONS = [
  "Formulário do site", "WhatsApp", "Ligação", "Indicação",
  "Feira/Evento", "Visita presencial", "Redes sociais", "Outro",
];
const PRODUTO_OPTIONS = [
  "Energia Solar Residencial",
  "Energia Solar Comercial",
  "Energia Solar Rural",
  "Energia Solar Industrial",
  "Usina Própria",
  "Autoconsumo Remoto",
  "Manutenção / O&M",
];

type Lead = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  valor_conta: string | null;
  mensagem: string | null;
  origem: string | null;
  produto_interesse: string | null;
  captacao_metodo: string | null;
  objetivo: string | null;
  padrao_eletrico: string | null;
  fatura_url: string | null;
  tipo_encaminhamento: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  gclid: string | null;
  fbclid: string | null;
  stage: LeadStage;
  sale_value: number | null;
  sale_notes: string | null;
  assigned_to: string | null;
  created_at: string;
  stage_updated_at: string | null;
  atendimento_deadline: string | null;
  atendimento_confirmado_at: string | null;
  is_prioridade_emergencia: boolean | null;
};

function CrmPage() {
  const navigate = useNavigate();
  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); };

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

  const [view, setView] = useState<"meus" | "brutos" | "offline" | "todos">("meus");
  const [offlineOpen, setOfflineOpen] = useState(false);

  const myId = role?.userId;
  const allLeads = leadsQuery.data ?? [];
  const filtered = useMemo(() => {
    if (view === "brutos") return allLeads.filter((l) => !l.assigned_to);
    if (view === "offline") return allLeads.filter((l: any) => l.is_offline && l.assigned_to === myId);
    if (view === "todos") return allLeads;
    // meus
    return allLeads.filter((l) => l.assigned_to === myId);
  }, [allLeads, view, myId]);

  const showTodos = !!(role?.isAdmin || role?.isCoordenador);

  return (
    <div className="min-h-screen bg-secondary/30 pb-24 sm:pb-8">
      <header className="border-b bg-primary text-primary-foreground sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold min-w-0">
            <Sun className="h-5 w-5 shrink-0" />
            <span className="truncate text-sm sm:text-base">LZ7 · CRM</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            {(role?.isAdmin || role?.isCoordenador) && (
              <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10 px-2 sm:px-3">
                <Link to="/coordenacao">
                  <TrendingUp className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Coordenação</span>
                </Link>
              </Button>
            )}
            {role?.isAdmin && (
              <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10 px-2 sm:px-3">
                <Link to="/admin">
                  <LayoutDashboard className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10 px-2 sm:px-3">
              <Link to="/app">
                <Smartphone className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">App</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10 px-2 sm:px-3">
              <Link to="/">
                <ExternalLink className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Site</span>
              </Link>
            </Button>
            <Button onClick={signOut} variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10 px-2 sm:px-3">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-8 space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full sm:w-auto">
            <TabsList className="w-full sm:w-auto overflow-x-auto flex-nowrap">
              <TabsTrigger value="meus" className="text-xs sm:text-sm">Meus</TabsTrigger>
              <TabsTrigger value="brutos" className="text-xs sm:text-sm">Brutos</TabsTrigger>
              <TabsTrigger value="offline" className="text-xs sm:text-sm">Offline</TabsTrigger>
              {showTodos && <TabsTrigger value="todos" className="text-xs sm:text-sm">Todos</TabsTrigger>}
            </TabsList>
          </Tabs>
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOfflineOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Novo lead
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => leadsQuery.refetch()}
              disabled={leadsQuery.isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${leadsQuery.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="sm:hidden"
            onClick={() => leadsQuery.refetch()}
            disabled={leadsQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${leadsQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {view === "brutos" && (
          <Card className="p-3 text-xs bg-amber-50 border-amber-200 text-amber-900">
            Fila comum: qualquer consultor pode assumir. Ao mover um lead daqui, você vira automaticamente o responsável.
          </Card>
        )}

        {leadsQuery.isError ? (
          <Card className="p-6 text-destructive">Erro ao carregar leads: {(leadsQuery.error as Error).message}</Card>
        ) : (
          <>
            <Dashboard leads={filtered} />
            <Kanban leads={filtered} isLoading={leadsQuery.isLoading} isAdmin={!!role?.isAdmin} />
          </>
        )}

        <OfflineLeadDialog open={offlineOpen} onOpenChange={setOfflineOpen} />
      </main>

      {/* Mobile FAB */}
      <Button
        onClick={() => setOfflineOpen(true)}
        size="lg"
        className="sm:hidden fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full shadow-lg p-0"
        aria-label="Novo lead"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {role?.isConsultor && <CadenceBot />}
    </div>
  );
}

/* ---------------------------- Dashboard ---------------------------- */

function Dashboard({ leads }: { leads: Lead[] }) {
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthLeads = leads.filter((l) => l.created_at >= monthStart);
    const atendidos = leads.filter((l) => l.stage !== "novo").length;
    const vendas = leads.filter((l) => l.stage === "venda" || l.stage === "faturado");
    const faturados = leads.filter((l) => l.stage === "faturado");
    const totalVendido = vendas.reduce((s, l) => s + Number(l.sale_value || 0), 0);
    const totalFaturado = faturados.reduce((s, l) => s + Number(l.sale_value || 0), 0);
    const conversao = atendidos > 0 ? (vendas.length / atendidos) * 100 : 0;
    const ticket = vendas.length ? totalVendido / vendas.length : 0;

    const porOrigem: Record<string, number> = {};
    for (const l of leads) {
      const src = l.gclid ? "Google Ads" : l.fbclid ? "Meta Ads" : l.utm_source || l.origem || "Orgânico";
      porOrigem[src] = (porOrigem[src] || 0) + 1;
    }

    return {
      mes: monthLeads.length,
      atendidos, vendas: vendas.length, faturados: faturados.length,
      totalVendido, totalFaturado, conversao, ticket, porOrigem,
    };
  }, [leads]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Leads no mês" value={stats.mes} />
        <Kpi label="Atendidos" value={stats.atendidos} />
        <Kpi label="Taxa de conversão" value={`${stats.conversao.toFixed(1)}%`} accent />
        <Kpi label="Ticket médio" value={fmt(stats.ticket)} />
        <Kpi label="Vendas" value={stats.vendas} />
        <Kpi label="Faturados" value={stats.faturados} />
        <Kpi label="Valor vendido" value={fmt(stats.totalVendido)} accent />
        <Kpi label="Valor faturado" value={fmt(stats.totalFaturado)} accent />
      </div>
      <Card className="mt-4 p-4">
        <div className="text-sm font-medium mb-2">Leads por origem</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.porOrigem).map(([k, v]) => (
            <Badge key={k} variant="secondary">{k}: {v}</Badge>
          ))}
          {!Object.keys(stats.porOrigem).length && <span className="text-sm text-muted-foreground">Sem dados ainda.</span>}
        </div>
      </Card>
    </section>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
    </Card>
  );
}

/* ------------------------------ Kanban ------------------------------ */

function Kanban({ leads, isLoading, isAdmin }: { leads: Lead[]; isLoading: boolean; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [saleModal, setSaleModal] = useState<{ lead: Lead; stage: LeadStage } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Lead | null>(null);
  const [dragOver, setDragOver] = useState<LeadStage | null>(null);

  // keep the details modal in sync with the freshest lead data after refetch
  const currentDetails = detailsTarget ? leads.find((l) => l.id === detailsTarget.id) ?? detailsTarget : null;

  const updateStage = useServerFn(updateLeadStage);
  const mutation = useMutation({
    mutationFn: (v: { leadId: string; stage: LeadStage; saleValue?: number | null; saleNotes?: string | null }) =>
      updateStage({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
      qc.invalidateQueries({ queryKey: ["admin_leads"] });
      toast.success("Lead atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeFn = useServerFn(deleteLead);
  const removeMutation = useMutation({
    mutationFn: (leadId: string) => removeFn({ data: { leadId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
      qc.invalidateQueries({ queryKey: ["admin_leads"] });
      toast.success("Lead excluído.");
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

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">Kanban de leads</h2>
      <p className="text-xs text-muted-foreground mb-3">Dica: clique e arraste um card para outra coluna para mudar o status.</p>
      {isLoading ? (
        <Card className="p-6 text-muted-foreground">Carregando...</Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {STAGES.map((col) => {
            const items = leads.filter((l) => l.stage === col.key);
            const active = dragOver === col.key;
            return (
              <div
                key={col.key}
                className={`rounded-lg border bg-background transition-colors ${active ? "ring-2 ring-primary" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
                onDragLeave={() => setDragOver((c) => (c === col.key ? null : c))}
                onDrop={(e) => onDrop(e, col.key)}
              >
                <div className={`flex items-center justify-between rounded-t-lg px-3 py-2 text-white ${col.tone}`}>
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-xs opacity-90">{items.length}</span>
                </div>
                <div className="space-y-2 p-2 min-h-[120px]">
                  {items.map((l) => (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      isAdmin={isAdmin}
                      onMove={(s) => handleMove(l, s)}
                      onDelete={() => setDeleteTarget(l)}
                      onDragStart={(e) => onDragStart(e, l)}
                      onOpen={() => setDetailsTarget(l)}
                    />
                  ))}
                  {!items.length && <div className="text-xs text-muted-foreground p-2">—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SaleDialog
        open={!!saleModal}
        onOpenChange={(o) => !o && setSaleModal(null)}
        lead={saleModal?.lead}
        stage={saleModal?.stage}
        onConfirm={(v, n) => {
          if (!saleModal) return;
          mutation.mutate({ leadId: saleModal.lead.id, stage: saleModal.stage, saleValue: v, saleNotes: n });
          setSaleModal(null);
        }}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir lead</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.nome}</strong>? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
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

      <LeadDetailsDialog
        lead={currentDetails}
        open={!!detailsTarget}
        onOpenChange={(o) => !o && setDetailsTarget(null)}
      />
    </section>
  );
}

/* ------------------------------ Currency helpers ------------------------------ */

// Digits-only string of cents -> "R$ 1.234,56"
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
  id, value, onChange, placeholder,
}: {
  id?: string;
  value: string; // digits-only cents
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
    />
  );
}

/* ------------------------------ LeadCard ------------------------------ */

function LeadCard({
  lead, onMove, isAdmin, onDelete, onDragStart, onOpen,
}: {
  lead: Lead;
  onMove: (s: LeadStage) => void;
  isAdmin: boolean;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onOpen: () => void;
}) {
  const src = lead.gclid ? "Google Ads" : lead.fbclid ? "Meta Ads" : lead.utm_source || lead.origem || "Orgânico";

  // Only treat clicks on non-interactive areas as "open details"
  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button,a,[role='combobox'],input,textarea,select")) return;
    onOpen();
  };

  const phoneDigits = lead.telefone.replace(/\D/g, "");
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onClick={handleCardClick}
      className="p-3 space-y-2 cursor-pointer hover:shadow-md active:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1 min-w-0 flex-1">
          <GripVertical className="hidden sm:block h-4 w-4 text-muted-foreground shrink-0 mt-0.5 cursor-grab active:cursor-grabbing" />
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{lead.nome}</div>
            <div className="text-xs text-muted-foreground truncate">{lead.telefone}</div>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">{src}</Badge>
      </div>
      {lead.produto_interesse && (
        <div className="text-[11px] text-muted-foreground truncate">📦 {lead.produto_interesse}</div>
      )}
      {(lead.cidade || lead.valor_conta) && (
        <div className="text-xs text-muted-foreground truncate">
          {lead.cidade ? `${lead.cidade}${lead.estado ? "/" + lead.estado : ""}` : ""}
          {lead.valor_conta ? ` · Conta: ${lead.valor_conta}` : ""}
        </div>
      )}
      {lead.sale_value != null && (
        <div className="text-xs font-semibold text-primary">
          Venda: {Number(lead.sale_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <a
          href={`https://wa.me/${phoneDigits}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white hover:bg-emerald-600"
          title="WhatsApp"
          aria-label="Abrir WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
        </a>
        <a
          href={`tel:${phoneDigits}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border hover:bg-secondary"
          title="Ligar"
          aria-label="Ligar"
        >
          <Phone className="h-4 w-4" />
        </a>
        <Select onValueChange={(v) => onMove(v as LeadStage)}>
          <SelectTrigger className="h-9 text-xs flex-1 min-w-0"><SelectValue placeholder="Mover..." /></SelectTrigger>
          <SelectContent>
            {STAGES.filter((s) => s.key !== lead.stage).map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Excluir lead"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------ SaleDialog ------------------------------ */

function SaleDialog({
  open, onOpenChange, lead, stage, onConfirm,
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
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setDigits(""); setNotes(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar {stage === "faturado" ? "faturamento" : "venda"}</DialogTitle>
          <DialogDescription>
            Ao confirmar, a conversão é enviada para Meta, Google e TikTok automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Lead</Label>
            <div className="text-sm text-muted-foreground">{lead?.nome} — {lead?.telefone}</div>
          </div>
          <div>
            <Label htmlFor="sv">Valor</Label>
            <CurrencyInput id="sv" value={digits} onChange={setDigits} />
            <p className="text-[11px] text-muted-foreground mt-1">Digite os centavos — a formatação é automática.</p>
          </div>
          <div>
            <Label htmlFor="sn">Observações (opcional)</Label>
            <Textarea id="sn" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onConfirm(centsToNumber(digits), notes || null)} disabled={!digits || centsToNumber(digits) <= 0}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ LeadDetailsDialog ------------------------------ */

function LeadDetailsDialog({
  lead, open, onOpenChange,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateLead);
  const [form, setForm] = useState({
    nome: "", telefone: "", email: "", cidade: "", estado: "",
    valor_conta: "", mensagem: "", sale_notes: "",
    origem: "", produto_interesse: "", captacao_metodo: "",
    objetivo: "", padrao_eletrico: "", tipo_encaminhamento: "", fatura_url: "",
  });
  const [saleDigits, setSaleDigits] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [uploadingFatura, setUploadingFatura] = useState(false);

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
  }

  const mutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      updateFn({ data: { leadId: lead!.id, patch: patch as any } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
      qc.invalidateQueries({ queryKey: ["admin_leads"] });
      toast.success("Lead atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleClose = (o: boolean) => {
    if (!o) setLoadedFor(null);
    onOpenChange(o);
  };

  const handleFaturaUpload = async (file: File) => {
    if (!lead) return;
    setUploadingFatura(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${lead.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("faturas").upload(path, file, { upsert: true });
      if (error) throw error;
      setForm((f) => ({ ...f, fatura_url: path }));
      toast.success("Fatura enviada. Não esqueça de salvar.");
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar fatura.");
    } finally {
      setUploadingFatura(false);
    }
  };

  const openFatura = async () => {
    if (!form.fatura_url) return;
    const { data } = await supabase.storage.from("faturas").createSignedUrl(form.fatura_url, 60 * 10);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleSave = () => {
    if (!lead) return;
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

  const src = lead
    ? (lead.gclid ? "Google Ads" : lead.fbclid ? "Meta Ads" : lead.utm_source || lead.origem || "Orgânico")
    : "";
  const phoneDigits = lead?.telefone.replace(/\D/g, "") ?? "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Detalhes do lead</DialogTitle>
          <DialogDescription>
            {lead ? <>Origem: <strong>{src}</strong> · Criado em {new Date(lead.created_at).toLocaleString("pt-BR")}</> : null}
          </DialogDescription>
        </DialogHeader>

        {lead && (
          <div className="space-y-4">
            {/* Quick actions */}
            <div className="flex gap-2">
              <Button asChild size="sm" className="flex-1 bg-emerald-500 hover:bg-emerald-600">
                <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                </a>
              </Button>
              <Button asChild size="sm" variant="outline" className="flex-1">
                <a href={`tel:${phoneDigits}`}><Phone className="h-4 w-4 mr-2" /> Ligar</a>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label htmlFor="d-nome">Nome *</Label>
                <Input id="d-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="d-tel">Telefone *</Label>
                <Input id="d-tel" inputMode="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="d-email">E-mail</Label>
                <Input id="d-email" type="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Produto de interesse</Label>
                <Select value={form.produto_interesse || undefined} onValueChange={(v) => setForm({ ...form, produto_interesse: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {PRODUTO_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gasto médio de energia</Label>
                <Input inputMode="decimal" value={form.valor_conta} onChange={(e) => setForm({ ...form, valor_conta: e.target.value })} placeholder="Ex.: R$ 800" />
              </div>
              <div>
                <Label>Origem do lead</Label>
                <Select value={form.origem || undefined} onValueChange={(v) => setForm({ ...form, origem: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {ORIGEM_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Como foi captado?</Label>
                <Select value={form.captacao_metodo || undefined} onValueChange={(v) => setForm({ ...form, captacao_metodo: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {CAPTACAO_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="d-cidade">Cidade</Label>
                <Input id="d-cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="d-estado">Estado (UF)</Label>
                <Input id="d-estado" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} />
              </div>
            </div>

            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-primary">Qualificação SDR</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Objetivo</Label>
                  <Select value={form.objetivo || undefined} onValueChange={(v) => setForm({ ...form, objetivo: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="economia">Apenas economia</SelectItem>
                      <SelectItem value="aumento_consumo">Pretende aumentar consumo</SelectItem>
                      <SelectItem value="ambos">Economia + expansão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Padrão elétrico</Label>
                  <Select value={form.padrao_eletrico || undefined} onValueChange={(v) => setForm({ ...form, padrao_eletrico: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monofasico">Monofásico</SelectItem>
                      <SelectItem value="bifasico">Bifásico</SelectItem>
                      <SelectItem value="trifasico">Trifásico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de encaminhamento</Label>
                  <Select value={form.tipo_encaminhamento || undefined} onValueChange={(v) => setForm({ ...form, tipo_encaminhamento: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="orcamento">Orçamento (roleta comum)</SelectItem>
                      <SelectItem value="visita_tecnica">Visita técnico-comercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fatura de energia</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      disabled={uploadingFatura}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFaturaUpload(f); }}
                    />
                    {form.fatura_url && (
                      <Button type="button" size="sm" variant="outline" onClick={openFatura}>Ver</Button>
                    )}
                  </div>
                  {uploadingFatura && <div className="text-xs text-muted-foreground mt-1">Enviando...</div>}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="d-msg">Observação do lead</Label>
              <Textarea id="d-msg" rows={3} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} />
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
              <div>
                <Label htmlFor="d-sv">Valor da venda</Label>
                <CurrencyInput id="d-sv" value={saleDigits} onChange={setSaleDigits} />
              </div>
              <div>
                <Label htmlFor="d-sn">Observações da venda</Label>
                <Textarea id="d-sn" rows={2} value={form.sale_notes} onChange={(e) => setForm({ ...form, sale_notes: e.target.value })} />
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
              <div>Status atual: <strong className="text-foreground capitalize">{lead.stage.replace("_", " ")}</strong></div>
              {lead.utm_campaign && <div>Campanha: {lead.utm_campaign}</div>}
              {lead.gclid && <div>gclid: <code className="text-[10px]">{lead.gclid}</code></div>}
              {lead.fbclid && <div>fbclid: <code className="text-[10px]">{lead.fbclid}</code></div>}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => handleClose(false)} className="w-full sm:w-auto">Fechar</Button>
          <Button onClick={handleSave} disabled={mutation.isPending || !lead} className="w-full sm:w-auto">
            {mutation.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ OfflineLeadDialog ------------------------------ */

function OfflineLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createOfflineLead);
  const empty = {
    nome: "", telefone: "", email: "", cidade: "", estado: "",
    valor_conta: "", origem: "Indicação", mensagem: "",
    produto_interesse: "", captacao_metodo: "",
  };
  const [form, setForm] = useState(empty);

  const saveM = useMutation({
    mutationFn: () => createFn({
      data: {
        nome: form.nome,
        telefone: form.telefone,
        email: form.email || null,
        cidade: form.cidade || null,
        estado: form.estado || null,
        valor_conta: form.valor_conta || null,
        origem: form.origem || "Offline",
        produto_interesse: form.produto_interesse || null,
        captacao_metodo: form.captacao_metodo || null,
        mensagem: form.mensagem || null,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
      toast.success("Lead cadastrado.");
      setForm(empty);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = form.nome.trim().length >= 2 && form.telefone.trim().length >= 8;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-1rem)] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
          <DialogDescription>
            Cadastre um lead que você captou em campo, indicação ou WhatsApp. Ele já entra em "Em atendimento" e vira seu.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome *</Label>
            <Input autoFocus value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" />
          </div>
          <div className="sm:col-span-2">
            <Label>Telefone *</Label>
            <Input inputMode="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
          </div>
          <div className="sm:col-span-2">
            <Label>Produto de interesse</Label>
            <Select value={form.produto_interesse || undefined} onValueChange={(v) => setForm({ ...form, produto_interesse: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {PRODUTO_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Gasto médio de energia</Label>
            <Input inputMode="decimal" value={form.valor_conta} onChange={(e) => setForm({ ...form, valor_conta: e.target.value })} placeholder="Ex: R$ 500" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Origem do lead</Label>
            <Select value={form.origem || undefined} onValueChange={(v) => setForm({ ...form, origem: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {ORIGEM_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Como foi captado?</Label>
            <Select value={form.captacao_metodo || undefined} onValueChange={(v) => setForm({ ...form, captacao_metodo: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {CAPTACAO_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          </div>
          <div>
            <Label>UF</Label>
            <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} placeholder="SP" />
          </div>
          <div className="sm:col-span-2">
            <Label>Observação do lead</Label>
            <Textarea rows={3} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} placeholder="Anotações sobre o cliente, próximos passos..." />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancelar</Button>
          <Button
            onClick={() => saveM.mutate()}
            disabled={saveM.isPending || !canSubmit}
            className="w-full sm:w-auto"
          >
            {saveM.isPending ? "Salvando..." : "Cadastrar lead"}
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cadence_tasks", leadId] }); toast.success("Passo concluído."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const now = Date.now();
  return (
    <div className="space-y-1">
      {!tasks.length && <div className="text-xs text-muted-foreground">Nenhuma tarefa de cadência.</div>}
      {tasks.map((t: any) => {
        const overdue = !t.completed_at && new Date(t.due_at).getTime() < now;
        return (
          <div key={t.id} className={`flex items-center gap-2 rounded border p-2 text-xs ${overdue ? "border-red-300 bg-red-50" : t.completed_at ? "opacity-60" : ""}`}>
            <CalendarClock className="h-3.5 w-3.5" />
            <div className="flex-1">
              <div className="font-medium">{t.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(t.due_at).toLocaleString("pt-BR")} · {t.channel}
              </div>
            </div>
            {!t.completed_at && canWrite && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => doneM.mutate(t.id)}>
                Concluir
              </Button>
            )}
            {t.completed_at && <span className="text-[11px] text-emerald-700">✓ feito</span>}
          </div>
        );
      })}
    </div>
  );
}
