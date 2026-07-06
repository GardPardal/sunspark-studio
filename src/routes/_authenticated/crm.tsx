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
import { LogOut, ExternalLink, Sun, LayoutDashboard, RefreshCw, Trash2, GripVertical } from "lucide-react";
import { listCrmLeads, updateLeadStage, deleteLead, updateLead } from "@/lib/crm.functions";
import { getMyRole } from "@/lib/admin-users.functions";

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

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Sun className="h-5 w-5" /> LZ7 Energia · CRM
          </Link>
          <div className="flex items-center gap-2">
            {role?.isAdmin && (
              <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/admin"><LayoutDashboard className="h-4 w-4 mr-2" /> Painel Admin</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/"><ExternalLink className="h-4 w-4 mr-2" /> Site</Link>
            </Button>
            <Button onClick={signOut} variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => leadsQuery.refetch()}
            disabled={leadsQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${leadsQuery.isFetching ? "animate-spin" : ""}`} />
            Atualizar leads
          </Button>
        </div>
        {leadsQuery.isError ? (
          <Card className="p-6 text-destructive">Erro ao carregar leads: {(leadsQuery.error as Error).message}</Card>
        ) : (
          <>
            <Dashboard leads={leadsQuery.data ?? []} />
            <Kanban leads={leadsQuery.data ?? []} isLoading={leadsQuery.isLoading} isAdmin={!!role?.isAdmin} />
          </>
        )}
      </main>
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
    </section>
  );
}

function LeadCard({
  lead, onMove, isAdmin, onDelete, onDragStart,
}: {
  lead: Lead;
  onMove: (s: LeadStage) => void;
  isAdmin: boolean;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const src = lead.gclid ? "Google Ads" : lead.fbclid ? "Meta Ads" : lead.utm_source || lead.origem || "Orgânico";
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      className="p-3 space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1 min-w-0">
          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-medium truncate">{lead.nome}</div>
            <a className="text-xs text-primary hover:underline" href={`https://wa.me/${lead.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
              {lead.telefone}
            </a>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">{src}</Badge>
      </div>
      {lead.cidade && <div className="text-xs text-muted-foreground">{lead.cidade}/{lead.estado} · Conta: {lead.valor_conta || "—"}</div>}
      {lead.sale_value != null && (
        <div className="text-xs font-semibold text-primary">
          Venda: {Number(lead.sale_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Select onValueChange={(v) => onMove(v as LeadStage)}>
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Mover para..." /></SelectTrigger>
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
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            title="Excluir lead"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function SaleDialog({
  open, onOpenChange, lead, stage, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead?: Lead;
  stage?: LeadStage;
  onConfirm: (value: number, notes: string | null) => void;
}) {
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setValue(""); setNotes(""); } }}>
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
            <Label htmlFor="sv">Valor (R$)</Label>
            <Input id="sv" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label htmlFor="sn">Observações (opcional)</Label>
            <Textarea id="sn" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onConfirm(Number(value || 0), notes || null)} disabled={!value}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
