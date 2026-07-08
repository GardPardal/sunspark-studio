import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import { LogOut, ExternalLink, Sun, LayoutDashboard, ArrowRightLeft, Kanban as KanbanIcon, Dices } from "lucide-react";
import { listCrmLeads } from "@/lib/crm.functions";
import { RoulettePanel } from "@/components/roulette-panel";
import { listConsultants, transferLead } from "@/lib/crm-advanced.functions";
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
  const navigate = useNavigate();
  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); };

  const getRole = useServerFn(getMyRole);
  const { data: role } = useQuery({ queryKey: ["my_role"], queryFn: () => getRole() });

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Sun className="h-5 w-5" /> LZ7 Energia · Coordenação
          </Link>
          <div className="flex items-center gap-2">
            {role?.isAdmin && (
              <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/admin"><LayoutDashboard className="h-4 w-4 mr-2" /> Admin</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/crm"><KanbanIcon className="h-4 w-4 mr-2" /> CRM</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/"><ExternalLink className="h-4 w-4 mr-2" /> Site</Link>
            </Button>
            <Button onClick={signOut} variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Tabs defaultValue="roleta">
          <TabsList>
            <TabsTrigger value="roleta"><Dices className="h-3.5 w-3.5 mr-1" /> Roleta SDR</TabsTrigger>
            <TabsTrigger value="bi">BI · Tráfego × Vendas</TabsTrigger>
            <TabsTrigger value="kanban">Kanban por consultor</TabsTrigger>
          </TabsList>
          <TabsContent value="roleta" className="mt-6"><RoulettePanel /></TabsContent>
          <TabsContent value="bi" className="mt-6"><BiDashboard /></TabsContent>
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
