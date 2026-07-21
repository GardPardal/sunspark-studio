import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  DollarSign,
  Users,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Trophy,
  MessageCircle,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  listTrafficSpend,
  upsertTrafficSpend,
  deleteTrafficSpend,
} from "@/lib/crm-advanced.functions";
import {
  listSellers,
  upsertSeller,
  deleteSeller,
  listManualSales,
  upsertManualSale,
  deleteManualSale,
} from "@/lib/manual-sales.functions";


/**
 * Painel Meta Ads — 100% conectado à tabela `traffic_spend`.
 * Cada linha é um criativo/campanha inserido manualmente pelo time (ou
 * futuramente importado pela integração Meta). O BI puxa da mesma base.
 *
 * Convenções:
 *  - `channel` = "Meta Ads"
 *  - `objective` = região / grupo (Londrina, Ponta Grossa, Demais Regiões,
 *     Mobilidade — Stefane, Mobilidade — Dayan)
 *  - `campaign` = nome do criativo (ex: EN - VD5)
 */

const REGIONS = [
  "Energia — Londrina",
  "Energia — Ponta Grossa",
  "Energia — Demais Regiões",
  "Mobilidade — Stefane",
  "Mobilidade — Dayan",
];

const REGION_COLORS: Record<string, string> = {
  "Energia — Londrina": "hsl(var(--primary))",
  "Energia — Ponta Grossa": "hsl(24 95% 53%)",
  "Energia — Demais Regiões": "hsl(142 76% 36%)",
  "Mobilidade — Stefane": "hsl(280 65% 55%)",
  "Mobilidade — Dayan": "hsl(200 90% 50%)",
};

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const num = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n || 0));

type Row = {
  id: string;
  channel: string;
  campaign: string | null;
  objective: string | null;
  amount: number;
  leads_count: number;
  clicks: number;
  impressions: number;
  spend_date: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  notes: string | null;
  platform_url: string | null;
};

type FormState = {
  id: string | null;
  campaign: string;
  objective: string;
  amount: string;
  leads_count: string;
  clicks: string;
  impressions: string;
  spend_date: string;
  status: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm: FormState = {
  id: null,
  campaign: "",
  objective: REGIONS[0],
  amount: "",
  leads_count: "",
  clicks: "",
  impressions: "",
  spend_date: today(),
  status: "active",
  notes: "",
};

export function MetaAdsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTrafficSpend);
  const upsertFn = useServerFn(upsertTrafficSpend);
  const delFn = useServerFn(deleteTrafficSpend);

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["traffic_spend"],
    queryFn: () => listFn(),
  });

  const rows: Row[] = useMemo(
    () => (allRows as Row[]).filter((r) => (r.channel || "").toLowerCase().includes("meta")),
    [allRows],
  );

  const [tab, setTab] = useState("visao");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openNew = () => {
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setForm({
      id: r.id,
      campaign: r.campaign ?? "",
      objective: r.objective ?? REGIONS[0],
      amount: String(r.amount ?? ""),
      leads_count: String(r.leads_count ?? ""),
      clicks: String(r.clicks ?? ""),
      impressions: String(r.impressions ?? ""),
      spend_date: r.spend_date ?? today(),
      status: r.status ?? "active",
      notes: r.notes ?? "",
    });
    setOpen(true);
  };

  const saveM = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: form.id ?? undefined,
          spend_date: form.spend_date,
          channel: "Meta Ads",
          campaign: form.campaign || null,
          amount: Number(String(form.amount).replace(",", ".")) || 0,
          notes: form.notes || null,
          start_date: form.spend_date,
          end_date: null,
          status: (form.status as any) || "active",
          impressions: Number(form.impressions) || 0,
          clicks: Number(form.clicks) || 0,
          leads_count: Number(form.leads_count) || 0,
          objective: form.objective || null,
          platform_url: null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["traffic_spend"] });
      qc.invalidateQueries({ queryKey: ["bi_metrics"] });
      setOpen(false);
      toast.success("Criativo salvo. BI atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["traffic_spend"] });
      qc.invalidateQueries({ queryKey: ["bi_metrics"] });
      toast.success("Removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---------- Agregações ---------- */
  const totals = useMemo(() => {
    const inv = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
    const leads = rows.reduce((a, r) => a + Number(r.leads_count || 0), 0);
    const clicks = rows.reduce((a, r) => a + Number(r.clicks || 0), 0);
    const impressions = rows.reduce((a, r) => a + Number(r.impressions || 0), 0);
    return {
      inv,
      leads,
      clicks,
      impressions,
      cpl: leads ? inv / leads : 0,
      cpc: clicks ? inv / clicks : 0,
    };
  }, [rows]);

  const byRegion = useMemo(() => {
    const map = new Map<string, { region: string; inv: number; leads: number; clicks: number; simpleCplSum: number; count: number }>();
    for (const r of rows) {
      const region = r.objective || "Sem região";
      const cur = map.get(region) ?? { region, inv: 0, leads: 0, clicks: 0, simpleCplSum: 0, count: 0 };
      cur.inv += Number(r.amount || 0);
      cur.leads += Number(r.leads_count || 0);
      cur.clicks += Number(r.clicks || 0);
      const cpl = Number(r.leads_count || 0) > 0 ? Number(r.amount || 0) / Number(r.leads_count) : 0;
      if (cpl > 0) {
        cur.simpleCplSum += cpl;
        cur.count += 1;
      }
      map.set(region, cur);
    }
    return Array.from(map.values()).map((g) => ({
      ...g,
      weightedCpl: g.leads ? g.inv / g.leads : 0,
      simpleCpl: g.count ? g.simpleCplSum / g.count : 0,
    }));
  }, [rows]);

  const enriched = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        cpl: r.leads_count > 0 ? Number(r.amount) / r.leads_count : 0,
        cpc: r.clicks > 0 ? Number(r.amount) / r.clicks : 0,
      })),
    [rows],
  );

  const topByCpl = useMemo(
    () => [...enriched].filter((c) => c.leads_count >= 5 && c.cpl > 0).sort((a, b) => a.cpl - b.cpl).slice(0, 8),
    [enriched],
  );
  const worstByCpl = useMemo(
    () => [...enriched].filter((c) => c.cpl > 0).sort((a, b) => b.cpl - a.cpl).slice(0, 5),
    [enriched],
  );
  const topByVolume = useMemo(
    () => [...enriched].sort((a, b) => b.leads_count - a.leads_count).slice(0, 8),
    [enriched],
  );

  const kpis = [
    { label: "Investimento total", value: money(totals.inv), icon: DollarSign },
    { label: "Leads gerados", value: num(totals.leads), icon: Users },
    { label: "CPL ponderado", value: money(totals.cpl), icon: Target },
    { label: "Cliques", value: num(totals.clicks), icon: TrendingUp },
    { label: "CPC médio", value: money(totals.cpc), icon: DollarSign },
    { label: "Criativos", value: num(rows.length), icon: Trophy },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-bold text-xl">
              <MessageCircle className="h-6 w-6 text-primary" />
              Meta Ads — Painel operacional
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Insira aqui os criativos que estão rodando no Facebook/Instagram → WhatsApp. Todos os
              números alimentam o BI em tempo real. Enquanto a integração automática com a Meta
              não está ligada, os dados são inseridos manualmente e ficam marcados como{" "}
              <b>Manual</b>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary">Manual</Badge>
            <Badge variant="outline">Alimenta o BI</Badge>
            <Button onClick={openNew} className="gap-1">
              <Plus className="h-4 w-4" /> Novo criativo
            </Button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <k.icon className="h-3 w-3" /> {k.label}
            </div>
            <div className="text-2xl font-bold mt-1 tabular-nums">{k.value}</div>
          </Card>
        ))}
      </div>

      {isLoading && (
        <Card className="p-6 text-center text-muted-foreground">Carregando criativos…</Card>
      )}

      {!isLoading && rows.length === 0 && (
        <Card className="p-8 text-center space-y-3">
          <div className="font-semibold">Nenhum criativo cadastrado ainda.</div>
          <div className="text-sm text-muted-foreground">
            Clique em <b>Novo criativo</b> para inserir o primeiro. Os dados aparecem
            automaticamente no BI.
          </div>
          <Button onClick={openNew} className="gap-1">
            <Plus className="h-4 w-4" /> Novo criativo
          </Button>
        </Card>
      )}

      {rows.length > 0 && (
        <>
          {/* Aviso sobre média */}
          <Card className="p-5 border-amber-500/40 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-3 flex-1">
                <div className="font-semibold text-base">Como o painel calcula o CPL</div>
                <div className="text-sm text-muted-foreground">
                  Usamos <b>CPL ponderado</b> (investimento ÷ leads) — reflete o custo real
                  da operação. A média simples da planilha (média dos CPLs de cada criativo)
                  distorce quando os volumes são muito diferentes. Comparativo por região:
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Região</TableHead>
                        <TableHead className="text-right">Investimento</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">CPL simples</TableHead>
                        <TableHead className="text-right">CPL ponderado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byRegion.map((g) => (
                        <TableRow key={g.region}>
                          <TableCell className="font-medium">{g.region}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(g.inv)}</TableCell>
                          <TableCell className="text-right tabular-nums">{num(g.leads)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground line-through">
                            {money(g.simpleCpl)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-emerald-600">
                            {money(g.weightedCpl)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </Card>

          {/* Rankings */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-5 max-w-2xl">
              <TabsTrigger value="visao">Melhores</TabsTrigger>
              <TabsTrigger value="volume">Volume</TabsTrigger>
              <TabsTrigger value="regioes">Regiões</TabsTrigger>
              <TabsTrigger value="tabela">Tudo</TabsTrigger>
              <TabsTrigger value="vendas">Vendas</TabsTrigger>
            </TabsList>


            <TabsContent value="visao" className="mt-4 space-y-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4 text-emerald-600" />
                  <div className="font-semibold">Menor CPL (≥ 5 leads)</div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topByCpl} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" fontSize={11} />
                      <YAxis type="category" dataKey="campaign" fontSize={11} width={140} />
                      <Tooltip
                        formatter={(v: any) => money(Number(v))}
                        labelFormatter={(l, p) => `${l} — ${p?.[0]?.payload?.objective ?? ""}`}
                      />
                      <Bar dataKey="cpl" radius={[0, 6, 6, 0]}>
                        {topByCpl.map((_, i) => (
                          <Cell key={i} fill="hsl(142 76% 36%)" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <div className="font-semibold">Piores CPL — candidatos a pausar</div>
                </div>
                <div className="grid gap-2">
                  {worstByCpl.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border p-3 bg-destructive/5"
                    >
                      <div>
                        <div className="font-semibold text-sm">{c.campaign || "—"}</div>
                        <div className="text-xs text-muted-foreground">{c.objective}</div>
                      </div>
                      <div className="flex gap-4 text-right">
                        <div>
                          <div className="text-xs text-muted-foreground">CPL</div>
                          <div className="font-bold text-destructive tabular-nums">{money(c.cpl)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Leads</div>
                          <div className="font-semibold tabular-nums">{num(c.leads_count)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Invest.</div>
                          <div className="font-semibold tabular-nums">{money(Number(c.amount))}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="volume" className="mt-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-primary" />
                  <div className="font-semibold">Criativos que mais trouxeram leads</div>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topByVolume} margin={{ bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        dataKey="campaign"
                        fontSize={10}
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                        height={70}
                      />
                      <YAxis fontSize={11} />
                      <Tooltip
                        labelFormatter={(l, p) => `${l} — ${p?.[0]?.payload?.objective ?? ""}`}
                      />
                      <Bar dataKey="leads_count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="regioes" className="mt-4 space-y-4">
              {byRegion.map((g) => (
                <Card key={g.region} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ background: REGION_COLORS[g.region] ?? "hsl(var(--primary))" }}
                      />
                      <div className="font-semibold">{g.region}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{money(g.inv)}</Badge>
                      <Badge variant="outline">{num(g.leads)} leads</Badge>
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">
                        CPL {money(g.weightedCpl)}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="tabela" className="mt-4">
              <Card className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criativo</TableHead>
                      <TableHead>Região</TableHead>
                      <TableHead className="text-right">Invest.</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">CPL</TableHead>
                      <TableHead className="text-right">Cliques</TableHead>
                      <TableHead className="text-right">CPC</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enriched.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{r.campaign || "—"}</TableCell>
                        <TableCell className="text-xs">{r.objective || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(Number(r.amount))}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(r.leads_count)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.cpl ? money(r.cpl) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(r.clicks)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.cpc ? money(r.cpc) : "—"}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(r.spend_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Remover "${r.campaign}"?`)) delM.mutate(r.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="vendas" className="mt-4">
              <SalesSection totalSpend={totals.inv} totalLeads={totals.leads} />
            </TabsContent>
          </Tabs>

        </>
      )}

      {/* Dialog Novo/Editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar criativo" : "Novo criativo Meta Ads"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Nome do criativo</Label>
              <Input
                placeholder="Ex: EN - VD5"
                value={form.campaign}
                onChange={(e) => setForm({ ...form, campaign: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Região / grupo</Label>
              <Select value={form.objective} onValueChange={(v) => setForm({ ...form, objective: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Investimento (R$)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="100,00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Leads</Label>
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  value={form.leads_count}
                  onChange={(e) => setForm({ ...form, leads_count: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Cliques</Label>
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  value={form.clicks}
                  onChange={(e) => setForm({ ...form, clicks: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Impressões</Label>
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  value={form.impressions}
                  onChange={(e) => setForm({ ...form, impressions: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.spend_date}
                  onChange={(e) => setForm({ ...form, spend_date: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Rodando</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="ended">Encerrada</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
              {saveM.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================= Vendas registradas ================= */

const UNIT_LABELS: Record<string, string> = {
  londrina: "Londrina",
  ponta_grossa: "Ponta Grossa",
  wenceslau_braz: "Wenceslau Braz",
};

type Seller = {
  id: string;
  name: string;
  unit: string | null;
  profile_id: string | null;
  active: boolean;
};
type Sale = {
  id: string;
  seller_id: string | null;
  sale_date: string;
  amount: number;
  city: string | null;
  campaign_ref: string | null;
  notes: string | null;
};

function SalesSection({ totalSpend, totalLeads }: { totalSpend: number; totalLeads: number }) {
  const qc = useQueryClient();
  const sellersFn = useServerFn(listSellers);
  const upSellerFn = useServerFn(upsertSeller);
  const delSellerFn = useServerFn(deleteSeller);
  const salesFn = useServerFn(listManualSales);
  const upSaleFn = useServerFn(upsertManualSale);
  const delSaleFn = useServerFn(deleteManualSale);

  const { data: sellers = [] } = useQuery<Seller[]>({
    queryKey: ["sales_sellers"],
    queryFn: () => sellersFn() as any,
  });
  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: ["manual_sales"],
    queryFn: () => salesFn() as any,
  });

  const [saleOpen, setSaleOpen] = useState(false);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [saleForm, setSaleForm] = useState({
    id: null as string | null,
    seller_id: "",
    sale_date: today(),
    amount: "",
    city: "",
    campaign_ref: "",
    notes: "",
  });
  const [sellerForm, setSellerForm] = useState({
    id: null as string | null,
    name: "",
    unit: "" as "" | "londrina" | "ponta_grossa" | "wenceslau_braz",
    active: true,
  });

  const openNewSale = () => {
    setSaleForm({
      id: null,
      seller_id: sellers[0]?.id ?? "",
      sale_date: today(),
      amount: "",
      city: "",
      campaign_ref: "",
      notes: "",
    });
    setSaleOpen(true);
  };
  const openEditSale = (s: Sale) => {
    setSaleForm({
      id: s.id,
      seller_id: s.seller_id ?? "",
      sale_date: s.sale_date,
      amount: String(s.amount ?? ""),
      city: s.city ?? "",
      campaign_ref: s.campaign_ref ?? "",
      notes: s.notes ?? "",
    });
    setSaleOpen(true);
  };

  const saveSale = useMutation({
    mutationFn: () =>
      upSaleFn({
        data: {
          id: saleForm.id ?? undefined,
          seller_id: saleForm.seller_id || null,
          sale_date: saleForm.sale_date,
          amount: Number(String(saleForm.amount).replace(",", ".")) || 0,
          city: saleForm.city || null,
          campaign_ref: saleForm.campaign_ref || null,
          notes: saleForm.notes || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual_sales"] });
      qc.invalidateQueries({ queryKey: ["bi_metrics"] });
      setSaleOpen(false);
      toast.success("Venda salva. BI atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delSale = useMutation({
    mutationFn: (id: string) => delSaleFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual_sales"] });
      qc.invalidateQueries({ queryKey: ["bi_metrics"] });
      toast.success("Venda removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNewSeller = () => {
    setSellerForm({ id: null, name: "", unit: "", active: true });
    setSellerOpen(true);
  };
  const openEditSeller = (s: Seller) => {
    setSellerForm({
      id: s.id,
      name: s.name,
      unit: (s.unit as any) ?? "",
      active: s.active,
    });
    setSellerOpen(true);
  };
  const saveSeller = useMutation({
    mutationFn: () =>
      upSellerFn({
        data: {
          id: sellerForm.id ?? undefined,
          name: sellerForm.name.trim(),
          unit: (sellerForm.unit || null) as any,
          active: sellerForm.active,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales_sellers"] });
      qc.invalidateQueries({ queryKey: ["bi_metrics"] });
      setSellerOpen(false);
      toast.success("Vendedor salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delSeller = useMutation({
    mutationFn: (id: string) => delSellerFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales_sellers"] });
      toast.success("Vendedor removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sellerName = (id: string | null) => sellers.find((s) => s.id === id)?.name ?? "—";

  const totals = useMemo(() => {
    const receita = sales.reduce((a, s) => a + Number(s.amount || 0), 0);
    const count = sales.length;
    return {
      receita,
      count,
      ticket: count ? receita / count : 0,
      cac: count ? totalSpend / count : 0,
      roas: totalSpend ? receita / totalSpend : 0,
      conversao: totalLeads ? (count / totalLeads) * 100 : 0,
    };
  }, [sales, totalSpend, totalLeads]);

  return (
    <div className="space-y-4">
      <Card className="p-5 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-bold text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-emerald-600" />
              Vendas registradas — Meta Ads → WhatsApp
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Vendas fechadas por consultores que <b>ainda não passam pelo CRM</b>. Cada linha
              conta como venda no BI (CAC, ROAS, ticket e ranking). Cadastro dos vendedores é
              independente do login — pode adicionar quem ainda não tem conta.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openNewSeller} className="gap-1">
              <Plus className="h-4 w-4" /> Vendedor
            </Button>
            <Button onClick={openNewSale} className="gap-1">
              <Plus className="h-4 w-4" /> Nova venda
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Receita registrada</div>
          <div className="text-2xl font-bold mt-1 tabular-nums text-emerald-600">{money(totals.receita)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Vendas</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{num(totals.count)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Ticket médio</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{money(totals.ticket)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">CAC (invest. Meta ÷ vendas)</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{money(totals.cac)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">ROAS</div>
          <div className="text-2xl font-bold mt-1 tabular-nums text-emerald-600">
            {totals.roas.toFixed(2)}x
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Conversão leads → venda</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">
            {totals.conversao.toFixed(2)}%
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold">Vendas</div>
          <Badge variant="outline">{sales.length} registro(s)</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Nenhuma venda registrada. Clique em <b>Nova venda</b>.
                </TableCell>
              </TableRow>
            )}
            {sales.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-xs">
                  {new Date(s.sale_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                </TableCell>
                <TableCell className="font-medium">{sellerName(s.seller_id)}</TableCell>
                <TableCell className="text-sm">{s.city ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.campaign_ref ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold text-emerald-600">
                  {money(Number(s.amount))}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => openEditSale(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Remover esta venda?")) delSale.mutate(s.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold">Vendedores cadastrados</div>
          <Badge variant="outline">{sellers.length}</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sellers.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.unit ? UNIT_LABELS[s.unit] ?? s.unit : "—"}</TableCell>
                <TableCell>
                  {s.active ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Ativo</Badge>
                  ) : (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => openEditSeller(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Remover ${s.name}?`)) delSeller.mutate(s.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog venda */}
      <Dialog open={saleOpen} onOpenChange={setSaleOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{saleForm.id ? "Editar venda" : "Nova venda"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Vendedor</Label>
              <Select
                value={saleForm.seller_id}
                onValueChange={(v) => setSaleForm({ ...saleForm, seller_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.unit ? ` — ${UNIT_LABELS[s.unit] ?? s.unit}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={saleForm.amount}
                  onChange={(e) => setSaleForm({ ...saleForm, amount: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={saleForm.sale_date}
                  onChange={(e) => setSaleForm({ ...saleForm, sale_date: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Cidade</Label>
                <Input
                  value={saleForm.city}
                  onChange={(e) => setSaleForm({ ...saleForm, city: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Referência da campanha</Label>
                <Input
                  placeholder="Ex: Meta Ads → WhatsApp (20/07)"
                  value={saleForm.campaign_ref}
                  onChange={(e) => setSaleForm({ ...saleForm, campaign_ref: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={saleForm.notes}
                onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaleOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveSale.mutate()}
              disabled={saveSale.isPending || !saleForm.seller_id || !saleForm.amount}
            >
              {saveSale.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog vendedor */}
      <Dialog open={sellerOpen} onOpenChange={setSellerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{sellerForm.id ? "Editar vendedor" : "Novo vendedor"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Nome</Label>
              <Input
                value={sellerForm.name}
                onChange={(e) => setSellerForm({ ...sellerForm, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Unidade</Label>
              <Select
                value={sellerForm.unit}
                onValueChange={(v) => setSellerForm({ ...sellerForm, unit: v as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="londrina">Londrina</SelectItem>
                  <SelectItem value="ponta_grossa">Ponta Grossa</SelectItem>
                  <SelectItem value="wenceslau_braz">Wenceslau Braz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sellerForm.active}
                onChange={(e) => setSellerForm({ ...sellerForm, active: e.target.checked })}
              />
              Ativo
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSellerOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveSeller.mutate()}
              disabled={saveSeller.isPending || !sellerForm.name.trim()}
            >
              {saveSeller.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

