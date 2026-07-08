import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { BackendTopBar } from '@/components/backend-shell';
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { LogOut, ExternalLink, Sun, LayoutDashboard, ArrowRightLeft, Kanban as KanbanIcon, Dices, Snowflake, RotateCcw } from "lucide-react";
import { listCrmLeads } from "@/lib/crm.functions";
import { RoulettePanel } from "@/components/roulette-panel";
import { RoulettePriorityPanel } from "@/components/roulette-priority-panel";
import { listConsultants, transferLead } from "@/lib/crm-advanced.functions";
import { listFrozenConsultants, unfreezeConsultant } from "@/lib/atendimento.functions";
import { getMyRole } from "@/lib/admin-users.functions";
import { BiDashboard } from "@/components/bi-dashboard";

export const Route = createFileRoute("/_authenticated/coordenacao")({
  head: () => ({
    meta: [
      { title: "Coordenação Comercial — LZ7 Energia" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CoordPage,
});

const STAGES = [
  { key: "novo", label: "Novo", tone: "bg-blue-500" },
  { key: "atendimento", label: "Em atendimento", tone: "bg-amber-500" },
  { key: "nao_atendido", label: "Não atendido", tone: "bg-slate-500" },
  { key: "venda", label: "Venda", tone: "bg-emerald-500" },
  { key: "faturado", label: "Faturado", tone: "bg-primary" },
  { key: "perdido", label: "Perdido", tone: "bg-red-500" },
] as const;

function CoordPage() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <BackendTopBar title="Coordenação" subtitle="Roleta, ranking e time" />

      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-8">
        <Tabs defaultValue="bi">
          <TabsList className="flex w-full flex-nowrap gap-1 overflow-x-auto rounded-full bg-secondary p-1 no-scrollbar">
            <TabsTrigger value="bi" className="shrink-0 rounded-full text-xs sm:text-sm">📊 BI</TabsTrigger>
            <TabsTrigger value="roleta" className="shrink-0 rounded-full text-xs sm:text-sm"><Dices className="h-3.5 w-3.5 mr-1" /> Roleta</TabsTrigger>
            <TabsTrigger value="ranking" className="shrink-0 rounded-full text-xs sm:text-sm">Ranking</TabsTrigger>
            <TabsTrigger value="congelados" className="shrink-0 rounded-full text-xs sm:text-sm"><Snowflake className="h-3.5 w-3.5 mr-1" /> Congelados</TabsTrigger>
            <TabsTrigger value="kanban" className="shrink-0 rounded-full text-xs sm:text-sm">Kanban</TabsTrigger>
          </TabsList>
          <TabsContent value="roleta" className="mt-6"><RoulettePanel /></TabsContent>
          <TabsContent value="ranking" className="mt-6"><RoulettePriorityPanel /></TabsContent>
          <TabsContent value="bi" className="mt-6"><BiDashboard /></TabsContent>
          <TabsContent value="congelados" className="mt-6"><FrozenConsultantsPanel /></TabsContent>
          <TabsContent value="kanban" className="mt-6"><KanbanPorConsultor /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function KanbanPorConsultor() {
  const qc = useQueryClient();
  const fetchLeads = useServerFn(listCrmLeads);
  const fetchConsultants = useServerFn(listConsultants);
  const transferFn = useServerFn(transferLead);

  const leadsQuery = useQuery({
    queryKey: ["crm_leads"],
    queryFn: () => fetchLeads(),
    refetchInterval: 30000,
  });
  const consQuery = useQuery({ queryKey: ["consultants"], queryFn: () => fetchConsultants() });

  const [selected, setSelected] = useState<string>("all");
  const [transferOpen, setTransferOpen] = useState<any>(null);
  const [toUser, setToUser] = useState<string>("");
  const [reason, setReason] = useState("");

  const consultants = consQuery.data ?? [];
  const nameById = new Map(consultants.map((c: any) => [c.id, c.name]));

  const filteredLeads = useMemo(() => {
    const list = (leadsQuery.data ?? []) as any[];
    if (selected === "all") return list;
    if (selected === "none") return list.filter((l) => !l.assigned_to);
    return list.filter((l) => l.assigned_to === selected);
  }, [leadsQuery.data, selected]);

  const transferM = useMutation({
    mutationFn: (v: { leadId: string; toUserId: string; reason: string | null }) => transferFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
      toast.success("Lead transferido.");
      setTransferOpen(null); setToUser(""); setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <Label>Ver leads de:</Label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os consultores</SelectItem>
            <SelectItem value="none">Sem responsável (leads brutos)</SelectItem>
            {consultants.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground">
          {filteredLeads.length} lead(s) no filtro selecionado.
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        {STAGES.map((col) => {
          const items = filteredLeads.filter((l) => l.stage === col.key);
          return (
            <div key={col.key} className="rounded-lg border bg-background">
              <div className={`flex items-center justify-between rounded-t-lg px-3 py-2 text-white ${col.tone}`}>
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="text-xs opacity-90">{items.length}</span>
              </div>
              <div className="space-y-2 p-2 min-h-[80px]">
                {items.map((l: any) => (
                  <Card key={l.id} className="p-3 space-y-1">
                    <div className="font-medium truncate">{l.nome}</div>
                    <a className="text-xs text-primary hover:underline" href={`https://wa.me/${l.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{l.telefone}</a>
                    <div className="text-xs text-muted-foreground">
                      Resp: {l.assigned_to ? (nameById.get(l.assigned_to) ?? "—") : <em>sem dono</em>}
                    </div>
                    {l.sale_value != null && (
                      <div className="text-xs font-semibold text-primary">
                        {Number(l.sale_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                      onClick={() => { setTransferOpen(l); setToUser(l.assigned_to ?? ""); }}
                    >
                      <ArrowRightLeft className="h-3 w-3 mr-1" /> Transferir
                    </Button>
                  </Card>
                ))}
                {!items.length && <div className="text-xs text-muted-foreground p-2">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!transferOpen} onOpenChange={(o) => !o && setTransferOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir lead</DialogTitle>
            <DialogDescription>
              {transferOpen?.nome} — atualmente com {transferOpen?.assigned_to ? (nameById.get(transferOpen.assigned_to) ?? "—") : "ninguém"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Novo responsável</Label>
              <Select value={toUser} onValueChange={setToUser}>
                <SelectTrigger><SelectValue placeholder="Escolha um consultor" /></SelectTrigger>
                <SelectContent>
                  {consultants.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTransferOpen(null)}>Cancelar</Button>
            <Button
              disabled={!toUser || transferM.isPending}
              onClick={() => transferM.mutate({ leadId: transferOpen.id, toUserId: toUser, reason: reason || null })}
            >
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- FrozenConsultantsPanel -------------------- */
function FrozenConsultantsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFrozenConsultants);
  const unfreezeFn = useServerFn(unfreezeConsultant);
  const q = useQuery({
    queryKey: ["frozen_consultants"],
    queryFn: () => listFn(),
    refetchInterval: 30000,
  });
  const unfreezeM = useMutation({
    mutationFn: (userId: string) => unfreezeFn({ data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["frozen_consultants"] });
      qc.invalidateQueries({ queryKey: ["roulette-consultants"] });
      toast.success("Consultor devolvido à fila.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (q.data ?? []) as any[];

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <Snowflake className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Consultores congelados</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Consultores que não confirmaram atendimento em 2h úteis. Ficam de fora da roleta até você devolvê-los à fila.
      </p>
      {rows.length === 0 && (
        <div className="text-sm text-muted-foreground p-6 text-center border rounded-lg">
          Nenhum consultor congelado no momento. 🎉
        </div>
      )}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background">
            <Snowflake className="h-4 w-4 text-blue-400" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{r.full_name || r.email}</div>
              <div className="text-xs text-muted-foreground truncate">
                {r.unit ?? "sem unidade"} · congelado {r.queue_frozen_at ? new Date(r.queue_frozen_at).toLocaleString("pt-BR") : ""}
              </div>
              {r.queue_frozen_reason && (
                <div className="text-[11px] text-muted-foreground truncate">Motivo: {r.queue_frozen_reason}</div>
              )}
            </div>
            <Button
              size="sm"
              disabled={unfreezeM.isPending}
              onClick={() => unfreezeM.mutate(r.id)}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Devolver à fila
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
