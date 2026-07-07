import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlugZap, RefreshCw, TrendingUp, MousePointerClick, DollarSign, Users, Target, Percent, BarChart3 } from "lucide-react";
import {
  testMetaConnection,
  runMetaEntitiesSync,
  runMetaInsightsSync,
  getMetaOverview,
  getMetaRanking,
  getMetaSyncState,
} from "@/lib/meta-ads.functions";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

function fmtMoney(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(n || 0);
}
function fmtNum(n: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(n || 0));
}
function fmtPct(n: number) {
  return `${(n || 0).toFixed(2)}%`;
}
function fmtDec(n: number, d = 2) {
  return (n || 0).toFixed(d);
}

function isoDaysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}
function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export function MetaAdsPanel() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(isoToday());
  const [level, setLevel] = useState<"campaign" | "adset" | "ad">("campaign");
  const [orderBy, setOrderBy] = useState<"spend" | "leads" | "cpl" | "roas" | "clicks" | "ctr" | "purchases" | "revenue">("spend");

  const testFn = useServerFn(testMetaConnection);
  const syncEntFn = useServerFn(runMetaEntitiesSync);
  const syncInsFn = useServerFn(runMetaInsightsSync);
  const overviewFn = useServerFn(getMetaOverview);
  const rankFn = useServerFn(getMetaRanking);
  const stateFn = useServerFn(getMetaSyncState);

  const stateQ = useQuery({
    queryKey: ["meta_state"],
    queryFn: () => stateFn(),
  });

  const overviewQ = useQuery({
    queryKey: ["meta_overview", from, to],
    queryFn: () => overviewFn({ data: { from, to } }),
  });

  const rankQ = useQuery({
    queryKey: ["meta_rank", from, to, level, orderBy],
    queryFn: () => rankFn({ data: { from, to, level, orderBy, limit: 20 } }),
  });

  const testM = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r: any) => r.ok ? toast.success(`Conectado: ${r.name} (${r.currency})`) : toast.error(r.message),
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["meta_overview"] });
    qc.invalidateQueries({ queryKey: ["meta_rank"] });
    qc.invalidateQueries({ queryKey: ["meta_state"] });
  };

  const syncEntM = useMutation({
    mutationFn: () => syncEntFn(),
    onSuccess: (r: any) => { toast.success(`${r.campaigns} campanhas, ${r.adsets} conjuntos, ${r.ads} anúncios, ${r.creatives} criativos`); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncInsM = useMutation({
    mutationFn: () => syncInsFn({ data: { days: 30 } }),
    onSuccess: (r: any) => { toast.success(`${r.rows} linhas (${r.since} → ${r.until})`); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = overviewQ.data?.totals ?? { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, purchases: 0, revenue: 0 };
  const der = overviewQ.data?.derived ?? { ctr: 0, cpc: 0, cpm: 0, cpl: 0, cpa: 0, roas: 0, roi: 0, frequency: 0 };
  const daily = overviewQ.data?.daily ?? [];

  const account = stateQ.data?.accounts?.[0];
  const entitiesState = stateQ.data?.state?.find((s: any) => s.entity === "entities");
  const insightsState = stateQ.data?.state?.find((s: any) => s.entity === "insights");

  const kpis = useMemo(() => ([
    { label: "Investimento", value: fmtMoney(totals.spend), icon: DollarSign },
    { label: "Impressões", value: fmtNum(totals.impressions), icon: BarChart3 },
    { label: "Alcance", value: fmtNum(totals.reach), icon: Users },
    { label: "Frequência", value: fmtDec(der.frequency), icon: RefreshCw },
    { label: "Cliques", value: fmtNum(totals.clicks), icon: MousePointerClick },
    { label: "CTR", value: fmtPct(der.ctr), icon: Percent },
    { label: "CPC", value: fmtMoney(der.cpc), icon: DollarSign },
    { label: "CPM", value: fmtMoney(der.cpm), icon: DollarSign },
    { label: "Leads", value: fmtNum(totals.leads), icon: Target },
    { label: "CPL", value: fmtMoney(der.cpl), icon: DollarSign },
    { label: "Conversões", value: fmtNum(totals.purchases), icon: Target },
    { label: "Receita", value: fmtMoney(totals.revenue), icon: DollarSign },
    { label: "ROAS", value: fmtDec(der.roas, 2), icon: TrendingUp },
    { label: "ROI", value: fmtPct((der.roi ?? 0) * 100), icon: TrendingUp },
  ]), [totals, der]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho / Conexão */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold text-lg">
              <PlugZap className="h-5 w-5 text-primary" /> Meta Ads — BI em tempo (quase) real
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Sincroniza contas, campanhas, conjuntos, anúncios e métricas diárias diretamente do Meta Marketing API.
              Todo o painel lê do banco — não faz chamada à Meta ao abrir.
            </p>
            {account && (
              <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">Conta: {account.name} ({account.id})</Badge>
                {account.currency && <Badge variant="outline">Moeda: {account.currency}</Badge>}
                {entitiesState?.last_run_at && <Badge variant="outline">Entidades: {new Date(entitiesState.last_run_at).toLocaleString("pt-BR")}</Badge>}
                {insightsState?.last_run_at && <Badge variant="outline">Insights: {new Date(insightsState.last_run_at).toLocaleString("pt-BR")}</Badge>}
              </div>
            )}
            {(entitiesState?.last_status === "error" || insightsState?.last_status === "error") && (
              <div className="text-xs text-destructive mt-2">
                Último erro: {entitiesState?.last_message ?? insightsState?.last_message}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => testM.mutate()} disabled={testM.isPending}>
              <PlugZap className="h-4 w-4 mr-2" />{testM.isPending ? "Testando..." : "Testar conexão"}
            </Button>
            <Button onClick={() => syncEntM.mutate()} disabled={syncEntM.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncEntM.isPending ? "animate-spin" : ""}`} />
              Sync entidades
            </Button>
            <Button onClick={() => syncInsM.mutate()} disabled={syncInsM.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncInsM.isPending ? "animate-spin" : ""}`} />
              Sync métricas (30d)
            </Button>
          </div>
        </div>

        {!account && (
          <div className="mt-4 rounded-lg border border-dashed p-4 text-sm bg-secondary/40 space-y-3">
            <div className="font-semibold">Nenhuma conta conectada ainda</div>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Acesse <a className="underline" href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer">business.facebook.com → Usuários do Sistema</a> e crie um <b>System User</b> com acesso à sua conta de anúncios.</li>
              <li>Gere um token com as permissões <code>ads_read</code>, <code>ads_management</code> e <code>business_management</code> (nunca expira).</li>
              <li>Copie o ID da conta de anúncios no formato <code>act_1234567890</code> (canto superior do Gerenciador de Anúncios).</li>
              <li>Volte aqui e me peça no chat: <b>"configurar Meta Ads"</b> — vou abrir a caixinha segura pra você colar o token e o ID sem precisar mostrar em tela.</li>
            </ol>
            <div className="text-xs">
              Secrets necessárias: <code>META_SYSTEM_USER_TOKEN</code> e <code>META_AD_ACCOUNT_ID</code>.
              Ficam armazenadas cifradas no backend, nunca sobem pro navegador.
            </div>
          </div>
        )}
      </Card>

      {/* Filtros de período */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <div className="flex gap-1">
            {[
              { label: "Hoje", d: 0 },
              { label: "7d", d: 7 },
              { label: "30d", d: 30 },
              { label: "90d", d: 90 },
            ].map((p) => (
              <Button key={p.label} size="sm" variant="outline"
                onClick={() => { setFrom(isoDaysAgo(p.d)); setTo(isoToday()); }}>
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <k.icon className="h-3 w-3" /> {k.label}
            </div>
            <div className="text-lg font-semibold mt-1 tabular-nums">{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Gráfico diário */}
      <Card className="p-4">
        <div className="font-semibold mb-3">Evolução diária</div>
        <div className="h-72">
          {daily.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Sem dados no período. Rode "Sync métricas" ou ajuste as datas.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis yAxisId="left" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" fontSize={11} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="spend" name="Investimento" stroke="hsl(var(--primary))" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--destructive))" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="clicks" name="Cliques" stroke="hsl(var(--muted-foreground))" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Ranking */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="font-semibold">Ranking</div>
          <div className="flex gap-2">
            <Select value={level} onValueChange={(v: any) => setLevel(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="campaign">Campanhas</SelectItem>
                <SelectItem value="adset">Conjuntos</SelectItem>
                <SelectItem value="ad">Anúncios</SelectItem>
              </SelectContent>
            </Select>
            <Select value={orderBy} onValueChange={(v: any) => setOrderBy(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="spend">Maior investimento</SelectItem>
                <SelectItem value="leads">Mais leads</SelectItem>
                <SelectItem value="cpl">Menor CPL</SelectItem>
                <SelectItem value="roas">Maior ROAS</SelectItem>
                <SelectItem value="clicks">Mais cliques</SelectItem>
                <SelectItem value="ctr">Melhor CTR</SelectItem>
                <SelectItem value="purchases">Mais conversões</SelectItem>
                <SelectItem value="revenue">Maior receita</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Investimento</TableHead>
                <TableHead className="text-right">Impressões</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">CPL</TableHead>
                <TableHead className="text-right">Conv.</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rankQ.data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-6">Sem dados</TableCell></TableRow>
              ) : (
                (rankQ.data as any[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium max-w-xs truncate" title={r.name}>{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(r.spend)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(r.impressions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(r.clicks)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(r.ctr)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(r.leads)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(r.cpl)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(r.purchases)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(r.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtDec(r.roas)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
