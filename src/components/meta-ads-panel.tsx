import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, Legend,
} from "recharts";
import {
  DollarSign, Users, Target, TrendingUp, MousePointerClick, Zap,
  RefreshCw, PlugZap, CheckCircle2, XCircle, Filter, Search,
  ChevronRight, ChevronDown, Activity,
} from "lucide-react";
import {
  getMetaOverview,
  getMetaRanking,
  getMetaSyncState,
  runMetaEntitiesSync,
  runMetaInsightsSync,
  testMetaConnection,
  listMetaAdsCatalog,
} from "@/lib/meta-ads.functions";

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const num = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n || 0));
const pct = (n: number) => `${(n || 0).toFixed(2)}%`;

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (d: number) =>
  new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const daysSinceFirstOfMonth = () => {
  const now = new Date();
  return now.getDate();
};

type Level = "campaign" | "adset" | "ad";

class PanelErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error("[MetaAdsPanel] render error", err); }
  render() {
    if (this.state.err) {
      return (
        <Card className="p-6 border-destructive/40 bg-destructive/10 space-y-2">
          <div className="font-bold text-destructive">Falha ao renderizar o painel Meta Ads</div>
          <div className="text-xs font-mono whitespace-pre-wrap break-all">{this.state.err.message}</div>
          <Button size="sm" variant="outline" onClick={() => this.setState({ err: null })}>Tentar novamente</Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

export function MetaAdsPanel() {
  return (
    <PanelErrorBoundary>
      <MetaAdsPanelInner />
    </PanelErrorBoundary>
  );
}

function MetaAdsPanelInner() {
  const qc = useQueryClient();

  const overviewFn = useServerFn(getMetaOverview);
  const rankingFn = useServerFn(getMetaRanking);
  const stateFn = useServerFn(getMetaSyncState);
  const catalogFn = useServerFn(listMetaAdsCatalog);
  const testFn = useServerFn(testMetaConnection);
  const syncEntFn = useServerFn(runMetaEntitiesSync);
  const syncInsFn = useServerFn(runMetaInsightsSync);

  const [range, setRange] = useState({ from: firstOfMonth(), to: today() });
  const [level, setLevel] = useState<Level>("campaign");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [insightDays, setInsightDays] = useState(Math.max(daysSinceFirstOfMonth(), 7));
  const [onlyActive, setOnlyActive] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Query paralela sempre no mês atual (MTD), independente do filtro do usuário
  const { data: mtdOverview } = useQuery({
    queryKey: ["meta_mtd", firstOfMonth(), today()],
    queryFn: () => overviewFn({ data: { from: firstOfMonth(), to: today() } }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    retry: false,
  });

  const { data: catalog, error: catalogErr } = useQuery({
    queryKey: ["meta_catalog"],
    queryFn: () => catalogFn(),
    retry: false,
    refetchInterval: 60_000,
  });
  const { data: state, error: stateErr } = useQuery({
    queryKey: ["meta_state"],
    queryFn: () => stateFn(),
    refetchInterval: 30_000,
    retry: false,
  });

  const filterKey = {
    campaignIds: level === "campaign" ? selectedIds : undefined,
    adsetIds: level === "adset" ? selectedIds : undefined,
    adIds: level === "ad" ? selectedIds : undefined,
  };

  const { data: overview, isFetching: fetchingOverview, isError, error } = useQuery({
    queryKey: ["meta_overview", range.from, range.to, level, selectedIds.join(",")],
    queryFn: () => overviewFn({ data: { ...range, ...filterKey } }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    retry: false,
  });

  const { data: ranking = [], isFetching: fetchingRanking } = useQuery({
    queryKey: ["meta_ranking", range.from, range.to, level],
    queryFn: () =>
      rankingFn({ data: { ...range, level, orderBy: "spend", limit: 50 } }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    retry: false,
  });

  const testM = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r: any) =>
      r?.ok
        ? toast.success(`Conectado: ${r.name} (${r.currency})`)
        : toast.error(r?.message ?? "Falha ao conectar"),
    onError: (e: Error) => toast.error(e.message),
  });
  const syncInsM = useMutation({
    mutationFn: (days?: number) => syncInsFn({ data: { days: days ?? insightDays } }),
    onSuccess: (r: any) => {
      toast.success(`Sync insights OK: ${r.rows} linhas (${r.since} → ${r.until})`);
      qc.invalidateQueries({ queryKey: ["meta_overview"] });
      qc.invalidateQueries({ queryKey: ["meta_ranking"] });
      qc.invalidateQueries({ queryKey: ["meta_state"] });
    },
    onError: (e: Error) => toast.error(`Insights: ${e.message}`),
  });
  const syncEntM = useMutation({
    mutationFn: () => syncEntFn(),
    onSuccess: (r: any) => {
      toast.success(`Sync entidades OK: ${r.campaigns} camp · ${r.adsets} adset · ${r.ads} ads`);
      qc.invalidateQueries({ queryKey: ["meta_catalog"] });
      qc.invalidateQueries({ queryKey: ["meta_state"] });
      // Encadeia insights automaticamente após sync de entidades
      syncInsM.mutate(insightDays);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const accounts = state?.accounts ?? [];
  const isConnected = accounts.length > 0;

  // Auto-dispara sync de insights se conectado e nunca sincronizado
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    if (!isConnected || !state) return;
    const entries = (state as any)?.state ?? [];
    const list = Array.isArray(entries) ? entries : [];

    const hasInsights = list.some((s: any) => s.entity === "insights" && (s.items_processed ?? 0) > 0);
    if (!hasInsights && !syncInsM.isPending) {
      autoRan.current = true;
      syncInsM.mutate(insightDays);
    }
  }, [isConnected, state, syncInsM, insightDays]);


  // Índices auxiliares para hierarquia e status
  const campaignsCat = (catalog?.campaigns ?? []) as any[];
  const adsetsCat = (catalog?.adsets ?? []) as any[];
  const adsCat = (catalog?.ads ?? []) as any[];

  const activeCampIds = useMemo(
    () => new Set(campaignsCat.filter((c) => String(c.effective_status).toUpperCase() === "ACTIVE").map((c) => c.id)),
    [campaignsCat],
  );
  const activeAdsetIds = useMemo(
    () => new Set(adsetsCat.filter((a) => String(a.effective_status).toUpperCase() === "ACTIVE").map((a) => a.id)),
    [adsetsCat],
  );
  const activeAdIds = useMemo(
    () => new Set(adsCat.filter((a) => String(a.effective_status).toUpperCase() === "ACTIVE").map((a) => a.id)),
    [adsCat],
  );

  const campNameById = useMemo(() => new Map(campaignsCat.map((c) => [c.id, c.name])), [campaignsCat]);
  const adsetsByCamp = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const a of adsetsCat) {
      const arr = m.get(a.campaign_id) ?? [];
      arr.push(a);
      m.set(a.campaign_id, arr);
    }
    return m;
  }, [adsetsCat]);
  const adsByAdset = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const a of adsCat) {
      const arr = m.get(a.adset_id) ?? [];
      arr.push(a);
      m.set(a.adset_id, arr);
    }
    return m;
  }, [adsCat]);

  // Totais filtrados por "somente ativas"
  const campBreakdown = (overview as any)?.campaigns ?? [];
  const activeTotals = useMemo(() => {
    const rows = onlyActive
      ? campBreakdown.filter((r: any) => activeCampIds.has(r.campaign_id))
      : campBreakdown;
    const t = rows.reduce(
      (acc: any, r: any) => {
        acc.spend += r.spend; acc.impressions += r.impressions; acc.clicks += r.clicks;
        acc.leads += r.leads; acc.purchases += r.purchases; acc.revenue += r.revenue;
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, revenue: 0 },
    );
    return {
      ...t,
      cpl: t.leads ? t.spend / t.leads : 0,
      ctr: t.impressions ? (t.clicks / t.impressions) * 100 : 0,
      cpc: t.clicks ? t.spend / t.clicks : 0,
      cpm: t.impressions ? (t.spend / t.impressions) * 1000 : 0,
      roas: t.spend ? t.revenue / t.spend : 0,
      activeCount: rows.length,
    };
  }, [campBreakdown, activeCampIds, onlyActive]);

  const options = useMemo(() => {
    if (!catalog) return [] as Array<{ id: string; name: string; sub?: string; status?: string }>;
    const q = search.trim().toLowerCase();
    const filt = <T extends { name?: string; id: string }>(arr: T[]) =>
      q ? arr.filter((x) => (x.name || "").toLowerCase().includes(q) || x.id.includes(q)) : arr;
    if (level === "campaign") return filt(campaignsCat).map((c: any) => ({ id: c.id, name: c.name, sub: undefined, status: c.effective_status }));
    if (level === "adset") {
      return filt(adsetsCat).map((a: any) => ({ id: a.id, name: a.name, sub: campNameById.get(a.campaign_id) as string | undefined, status: a.effective_status }));
    }
    return filt(adsCat).map((a: any) => ({ id: a.id, name: a.name, sub: campNameById.get(a.campaign_id) as string | undefined, status: a.effective_status }));
  }, [catalog, level, search, campaignsCat, adsetsCat, adsCat, campNameById]);

  const toggle = (id: string) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const clearFilter = () => setSelectedIds([]);
  const toggleExpand = (id: string) =>
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const kpis = [
    { label: onlyActive ? "Invest. ativas" : "Investimento", value: money(activeTotals.spend), icon: DollarSign },
    { label: "Leads", value: num(activeTotals.leads), icon: Users },
    { label: "CPL", value: money(activeTotals.cpl), icon: Target },
    { label: "Impressões", value: num(activeTotals.impressions), icon: TrendingUp },
    { label: "Cliques", value: num(activeTotals.clicks), icon: MousePointerClick },
    { label: "CTR", value: pct(activeTotals.ctr), icon: Zap },
    { label: "CPC", value: money(activeTotals.cpc), icon: DollarSign },
    { label: "CPM", value: money(activeTotals.cpm), icon: DollarSign },
  ];

  const daily = (overview as any)?.daily ?? [];


  return (
    <div className="space-y-6">
      {/* Header + conexão */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-bold text-xl">
              <PlugZap className="h-6 w-6 text-primary" />
              Meta Ads — Tempo real
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Números puxados direto da Meta Marketing API (Facebook + Instagram). Escolha campanhas / conjuntos / anúncios para filtrar; sem seleção o painel mostra a conta inteira.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {isConnected ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Conectado: {accounts[0].name}
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" /> Ainda não sincronizado — clique em <b>Testar conexão</b> e depois <b>Sync campanhas</b>
                </Badge>
              )}
              {(state?.state ?? []).map((s: any) => (
                <Badge key={s.entity} variant="outline">
                  {s.entity}: {s.last_status ?? "—"}
                  {s.last_run_at ? ` · ${new Date(s.last_run_at).toLocaleString("pt-BR")}` : ""}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" size="sm" onClick={() => testM.mutate()} disabled={testM.isPending} className="gap-1">
              <PlugZap className="h-4 w-4" /> Testar conexão
            </Button>
            <Button variant="outline" size="sm" onClick={() => syncEntM.mutate()} disabled={syncEntM.isPending} className="gap-1">
              <RefreshCw className={`h-4 w-4 ${syncEntM.isPending ? "animate-spin" : ""}`} /> Sync campanhas
            </Button>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={90}
                value={insightDays}
                onChange={(e) => setInsightDays(Number(e.target.value) || 7)}
                className="h-8 w-16"
              />
              <Button size="sm" onClick={() => syncInsM.mutate(insightDays)} disabled={syncInsM.isPending} className="gap-1">
                <RefreshCw className={`h-4 w-4 ${syncInsM.isPending ? "animate-spin" : ""}`} /> Sync insights ({insightDays}d)
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {(catalogErr || stateErr) && (
        <Card className="p-4 border-destructive/40 bg-destructive/10 text-sm space-y-1">
          <div className="font-semibold text-destructive">Não foi possível carregar dados do backend</div>
          {catalogErr && <div className="text-xs font-mono">catálogo: {(catalogErr as Error).message}</div>}
          {stateErr && <div className="text-xs font-mono">estado: {(stateErr as Error).message}</div>}
          <div className="text-xs text-muted-foreground">
            Confira seu login (precisa ser admin/coordenador) e clique em <b>Testar conexão</b>.
          </div>
        </Card>
      )}

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Nível</Label>
            <Select value={level} onValueChange={(v) => { setLevel(v as Level); setSelectedIds([]); }}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="campaign">Campanhas</SelectItem>
                <SelectItem value="adset">Conjuntos</SelectItem>
                <SelectItem value="ad">Anúncios</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1">
            {[7, 15, 30, 60].map((d) => (
              <Button key={d} variant="outline" size="sm" onClick={() => setRange({ from: daysAgo(d - 1), to: today() })}>
                {d}d
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 pl-2 border-l">
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            <Label htmlFor="onlyactive" className="text-xs cursor-pointer">Somente ativas</Label>
            <Switch id="onlyactive" checked={onlyActive} onCheckedChange={setOnlyActive} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={selectedIds.length ? "default" : "secondary"} className="gap-1">
              <Filter className="h-3 w-3" />
              {selectedIds.length ? `${selectedIds.length} selecionado(s)` : `${activeTotals.activeCount} ${onlyActive ? "ativas" : "campanhas"}`}
            </Badge>
            {(fetchingOverview || fetchingRanking) && (
              <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-600/40">
                <RefreshCw className="h-3 w-3 animate-spin" /> atualizando
              </Badge>
            )}
            {selectedIds.length > 0 && (
              <Button size="sm" variant="ghost" onClick={clearFilter}>Limpar</Button>
            )}
          </div>
        </div>
      </Card>

      {/* KPIs */}
      {isError && (
        <Card className="p-4 border-destructive/40 bg-destructive/10 text-destructive text-sm">
          {(error as Error).message}
        </Card>
      )}


      {kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {kpis.map((k) => (
            <Card key={k.label} className="p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <k.icon className="h-3 w-3" /> {k.label}
              </div>
              <div className="text-xl font-bold mt-1 tabular-nums">{k.value}</div>
            </Card>
          ))}
        </div>
      )}

      {daily.length > 0 && (
        <Card className="p-5">
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Série diária</div>
            <div className="font-bold">Investimento × Leads × Cliques</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F26A21" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#F26A21" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0E6A3C" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0E6A3C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis yAxisId="l" fontSize={10} />
                <YAxis yAxisId="r" orientation="right" fontSize={10} />
                <Tooltip
                  formatter={(v: any, k: any) =>
                    k === "spend" ? money(Number(v)) : num(Number(v))
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="l" type="monotone" dataKey="spend" name="Investimento" stroke="#F26A21" fill="url(#gS)" strokeWidth={2} />
                <Area yAxisId="r" type="monotone" dataKey="leads" name="Leads" stroke="#0E6A3C" fill="url(#gL)" strokeWidth={2} />
                <Area yAxisId="r" type="monotone" dataKey="clicks" name="Cliques" stroke="#3b82f6" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Tabs defaultValue="hierarquia">
        <TabsList>
          <TabsTrigger value="hierarquia">Hierarquia</TabsTrigger>
          <TabsTrigger value="selecao">Selecionar {level === "campaign" ? "campanhas" : level === "adset" ? "conjuntos" : "anúncios"}</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="hierarquia" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-3 flex items-center gap-2 border-b bg-muted/40">
              <div className="text-xs text-muted-foreground">
                Estrutura real da conta: <b>Campanha</b> → <b>Conjunto</b> → <b>Anúncio</b>. Clique para expandir. Números do período selecionado.
              </div>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Investimento</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">CPL</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const campList = (onlyActive
                      ? campaignsCat.filter((c) => activeCampIds.has(c.id))
                      : campaignsCat
                    ).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

                    // Aggregate metrics for adset/ad from ranking cache when available
                    const rankById = new Map((ranking as any[]).map((r) => [r.id, r]));
                    const campMetrics = new Map((campBreakdown as any[]).map((c) => [c.campaign_id, c]));

                    const rows: ReactNode[] = [];
                    if (campList.length === 0) {
                      rows.push(
                        <TableRow key="empty"><TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                          {isConnected ? "Sem campanhas. Rode Sync campanhas." : "Conecte a Meta e rode Sync campanhas."}
                        </TableCell></TableRow>,
                      );
                    }
                    for (const c of campList) {
                      const isOpen = expanded.has(c.id);
                      const m = campMetrics.get(c.id) ?? { spend: 0, leads: 0, clicks: 0, impressions: 0 };
                      const cpl = m.leads ? m.spend / m.leads : 0;
                      const ctr = m.impressions ? (m.clicks / m.impressions) * 100 : 0;
                      rows.push(
                        <TableRow key={c.id} className="cursor-pointer bg-muted/30" onClick={() => toggleExpand(c.id)}>
                          <TableCell className="font-semibold">
                            <span className="inline-flex items-center gap-2">
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {c.name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={activeCampIds.has(c.id) ? "default" : "secondary"} className={`text-[10px] ${activeCampIds.has(c.id) ? "bg-emerald-600 hover:bg-emerald-600" : ""}`}>
                              {c.effective_status ?? "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">{money(m.spend)}</TableCell>
                          <TableCell className="text-right tabular-nums">{num(m.leads)}</TableCell>
                          <TableCell className="text-right tabular-nums">{cpl ? money(cpl) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{pct(ctr)}</TableCell>
                        </TableRow>,
                      );
                      if (!isOpen) continue;
                      const setsAll = adsetsByCamp.get(c.id) ?? [];
                      const sets = onlyActive ? setsAll.filter((s) => activeAdsetIds.has(s.id)) : setsAll;
                      if (sets.length === 0) {
                        rows.push(
                          <TableRow key={`${c.id}-empty`}><TableCell colSpan={6} className="pl-10 text-xs text-muted-foreground py-2">
                            Nenhum conjunto {onlyActive ? "ativo" : ""} nesta campanha.
                          </TableCell></TableRow>,
                        );
                      }
                      for (const s of sets) {
                        const isOpenS = expanded.has(s.id);
                        const rm = rankById.get(s.id) ?? { spend: 0, leads: 0, cpl: 0, ctr: 0 };
                        rows.push(
                          <TableRow key={s.id} className="cursor-pointer" onClick={() => toggleExpand(s.id)}>
                            <TableCell className="pl-10">
                              <span className="inline-flex items-center gap-2">
                                {isOpenS ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                <span className="text-sm">{s.name}</span>
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${activeAdsetIds.has(s.id) ? "border-emerald-600/50 text-emerald-700" : ""}`}>
                                {s.effective_status ?? "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{money(rm.spend)}</TableCell>
                            <TableCell className="text-right tabular-nums">{num(rm.leads)}</TableCell>
                            <TableCell className="text-right tabular-nums">{rm.cpl ? money(rm.cpl) : "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{pct(rm.ctr)}</TableCell>
                          </TableRow>,
                        );
                        if (!isOpenS) continue;
                        const adsAll = adsByAdset.get(s.id) ?? [];
                        const ads = onlyActive ? adsAll.filter((a) => activeAdIds.has(a.id)) : adsAll;
                        if (ads.length === 0) {
                          rows.push(
                            <TableRow key={`${s.id}-empty`}><TableCell colSpan={6} className="pl-16 text-xs text-muted-foreground py-2">
                              Nenhum anúncio {onlyActive ? "ativo" : ""} neste conjunto.
                            </TableCell></TableRow>,
                          );
                        }
                        for (const a of ads) {
                          const am = rankById.get(a.id) ?? { spend: 0, leads: 0, cpl: 0, ctr: 0 };
                          rows.push(
                            <TableRow key={a.id}>
                              <TableCell className="pl-16 text-xs text-muted-foreground">{a.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] ${activeAdIds.has(a.id) ? "border-emerald-600/50 text-emerald-700" : ""}`}>
                                  {a.effective_status ?? "—"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-xs">{money(am.spend)}</TableCell>
                              <TableCell className="text-right tabular-nums text-xs">{num(am.leads)}</TableCell>
                              <TableCell className="text-right tabular-nums text-xs">{am.cpl ? money(am.cpl) : "—"}</TableCell>
                              <TableCell className="text-right tabular-nums text-xs">{pct(am.ctr)}</TableCell>
                            </TableRow>,
                          );
                        }
                      }
                    }
                    return rows;
                  })()}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>



        <TabsContent value="selecao" className="mt-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 max-w-md"
              />
              <span className="text-xs text-muted-foreground ml-auto">
                {options.length} item(ns) · marque para filtrar o relatório acima
              </span>
            </div>
            <div className="max-h-[420px] overflow-auto rounded border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {options.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {isConnected ? "Nenhum item encontrado. Rode Sync campanhas." : "Conecte a Meta para listar campanhas/anúncios."}
                    </TableCell></TableRow>
                  )}
                  {options.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => toggle(o.id)}>
                      <TableCell>
                        <Checkbox checked={selectedIds.includes(o.id)} onCheckedChange={() => toggle(o.id)} />
                      </TableCell>
                      <TableCell className="font-medium">{o.name || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{o.sub ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={String(o.status).toUpperCase() === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">
                          {o.status ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">{o.id}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="mt-4 space-y-4">
          <Card className="p-4">
            <div className="mb-3 font-semibold">Top {level === "campaign" ? "campanhas" : level === "adset" ? "conjuntos" : "anúncios"} — por investimento</div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(ranking as any[]).slice(0, 10)} layout="vertical" margin={{ left: 140 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" fontSize={10} />
                  <YAxis type="category" dataKey="name" fontSize={10} width={180} />
                  <Tooltip formatter={(v: any) => money(Number(v))} />
                  <Bar dataKey="spend" radius={[0, 6, 6, 0]}>
                    {(ranking as any[]).slice(0, 10).map((_, i) => (<Cell key={i} fill="#F26A21" />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Investimento</TableHead>
                  <TableHead className="text-right">Impr.</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ranking as any[]).length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem dados no período.</TableCell></TableRow>
                )}
                {(ranking as any[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium max-w-[260px] truncate">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.spend)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(r.impressions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(r.clicks)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(r.ctr)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(r.leads)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.cpl ? money(r.cpl) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.roas ? `${r.roas.toFixed(2)}x` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
