import { Component, type ReactNode, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const [range, setRange] = useState({ from: daysAgo(7), to: today() });
  const [level, setLevel] = useState<Level>("ad");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [insightDays, setInsightDays] = useState(7);

  const { data: catalog, error: catalogErr } = useQuery({
    queryKey: ["meta_catalog"],
    queryFn: () => catalogFn(),
    retry: false,
  });
  const { data: state, error: stateErr } = useQuery({
    queryKey: ["meta_state"],
    queryFn: () => stateFn(),
    refetchInterval: 15000,
    retry: false,
  });

  const filterKey = {
    campaignIds: level === "campaign" ? selectedIds : undefined,
    adsetIds: level === "adset" ? selectedIds : undefined,
    adIds: level === "ad" ? selectedIds : undefined,
  };

  const { data: overview, isLoading: loadingOverview, isError, error } = useQuery({
    queryKey: ["meta_overview", range.from, range.to, level, selectedIds.join(",")],
    queryFn: () => overviewFn({ data: { ...range, ...filterKey } }),
  });

  const { data: ranking = [] } = useQuery({
    queryKey: ["meta_ranking", range.from, range.to, level],
    queryFn: () =>
      rankingFn({ data: { ...range, level, orderBy: "spend", limit: 20 } }),
  });

  const testM = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r: any) =>
      r?.ok
        ? toast.success(`Conectado: ${r.name} (${r.currency})`)
        : toast.error(r?.message ?? "Falha ao conectar"),
    onError: (e: Error) => toast.error(e.message),
  });
  const syncEntM = useMutation({
    mutationFn: () => syncEntFn(),
    onSuccess: (r: any) => {
      toast.success(`Sync entidades OK: ${r.campaigns} camp · ${r.adsets} adset · ${r.ads} ads`);
      qc.invalidateQueries({ queryKey: ["meta_catalog"] });
      qc.invalidateQueries({ queryKey: ["meta_state"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const syncInsM = useMutation({
    mutationFn: () => syncInsFn({ data: { days: insightDays } }),
    onSuccess: (r: any) => {
      toast.success(`Sync insights OK: ${r.rows} linhas (${r.since} → ${r.until})`);
      qc.invalidateQueries({ queryKey: ["meta_overview"] });
      qc.invalidateQueries({ queryKey: ["meta_ranking"] });
      qc.invalidateQueries({ queryKey: ["meta_state"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const accounts = state?.accounts ?? [];
  const isConnected = accounts.length > 0;

  const options = useMemo(() => {
    if (!catalog) return [] as Array<{ id: string; name: string; sub?: string; status?: string }>;
    const q = search.trim().toLowerCase();
    const filt = <T extends { name?: string; id: string }>(arr: T[]) =>
      q ? arr.filter((x) => (x.name || "").toLowerCase().includes(q) || x.id.includes(q)) : arr;
    if (level === "campaign") return filt(catalog.campaigns as any[]).map((c: any) => ({ id: c.id, name: c.name, sub: undefined, status: c.effective_status }));
    if (level === "adset") {
      const cmap = new Map((catalog.campaigns as any[]).map((c: any) => [c.id, c.name]));
      return filt(catalog.adsets as any[]).map((a: any) => ({ id: a.id, name: a.name, sub: cmap.get(a.campaign_id) as string | undefined, status: a.effective_status }));
    }
    const cmap = new Map((catalog.campaigns as any[]).map((c: any) => [c.id, c.name]));
    return filt(catalog.ads as any[]).map((a: any) => ({ id: a.id, name: a.name, sub: cmap.get(a.campaign_id) as string | undefined, status: a.effective_status }));
  }, [catalog, level, search]);

  const toggle = (id: string) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const clearFilter = () => setSelectedIds([]);

  const totals = overview?.totals;
  const derived = overview?.derived;
  const daily = overview?.daily ?? [];

  const kpis = totals && derived
    ? [
        { label: "Investimento", value: money(totals.spend), icon: DollarSign },
        { label: "Leads", value: num(totals.leads), icon: Users },
        { label: "CPL", value: money(derived.cpl), icon: Target },
        { label: "Impressões", value: num(totals.impressions), icon: TrendingUp },
        { label: "Cliques", value: num(totals.clicks), icon: MousePointerClick },
        { label: "CTR", value: pct(derived.ctr), icon: Zap },
        { label: "CPC", value: money(derived.cpc), icon: DollarSign },
        { label: "CPM", value: money(derived.cpm), icon: DollarSign },
      ]
    : [];

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
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> Sem conexão — configure META_SYSTEM_USER_TOKEN e META_AD_ACCOUNT_ID
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
              <Button size="sm" onClick={() => syncInsM.mutate()} disabled={syncInsM.isPending} className="gap-1">
                <RefreshCw className={`h-4 w-4 ${syncInsM.isPending ? "animate-spin" : ""}`} /> Sync insights ({insightDays}d)
              </Button>
            </div>
          </div>
        </div>
      </Card>

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
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={selectedIds.length ? "default" : "secondary"} className="gap-1">
              <Filter className="h-3 w-3" />
              {selectedIds.length ? `${selectedIds.length} selecionado(s)` : "Conta inteira"}
            </Badge>
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
      {loadingOverview && <Card className="p-6 text-center text-muted-foreground">Carregando indicadores…</Card>}

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

      <Tabs defaultValue="selecao">
        <TabsList>
          <TabsTrigger value="selecao">Selecionar {level === "campaign" ? "campanhas" : level === "adset" ? "conjuntos" : "anúncios"}</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

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
