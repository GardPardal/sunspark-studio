import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  CheckCircle2,
} from "lucide-react";

/**
 * Snapshot real — últimos 5 dias (planilha LZ7 20/07).
 * Meta Ads → Facebook + Instagram → WhatsApp direto.
 * Ainda não passa pela nossa ferramenta de leads (por isso CAC/ROI/ROAS ficam pendentes).
 */

type Creative = { name: string; cpl: number; cpc: number; inv: number; leads: number };
type Group = { key: string; label: string; color: string; creatives: Creative[]; plannedAvgCpl?: number };

const GROUPS: Group[] = [
  {
    key: "londrina",
    label: "Energia — Londrina",
    color: "hsl(var(--primary))",
    plannedAvgCpl: 21.6225,
    creatives: [
      { name: "EN - VD10", cpl: 20.92, cpc: 3.27, inv: 104.6, leads: 5 },
      { name: "EN - VD1 — Híbrido", cpl: 12.5, cpc: 7.69, inv: 100, leads: 8 },
      { name: "EN - VD4", cpl: 26, cpc: 2.12, inv: 103.98, leads: 4 },
      { name: "EN - VD5", cpl: 7.82, cpc: 1.54, inv: 101.61, leads: 13 },
      { name: "EN - VD6", cpl: 53.39, cpc: 3.81, inv: 106.77, leads: 2 },
      { name: "EN - VD7", cpl: 25.97, cpc: 3.35, inv: 103.86, leads: 4 },
      { name: "EN - VD8", cpl: 14.96, cpc: 1.84, inv: 104.74, leads: 7 },
      { name: "EN - VD9", cpl: 11.42, cpc: 2.7, inv: 102.76, leads: 9 },
    ],
  },
  {
    key: "pg",
    label: "Energia — Ponta Grossa",
    color: "hsl(24 95% 53%)",
    plannedAvgCpl: 24.146,
    creatives: [
      { name: "EN - VD 2.1", cpl: 21.08, cpc: 6.2, inv: 105.4, leads: 5 },
      { name: "EN - VD 1.1 Híbrido", cpl: 25.31, cpc: 7.23, inv: 101.25, leads: 4 },
      { name: "EN - VD4", cpl: 20.45, cpc: 3.93, inv: 102.27, leads: 5 },
      { name: "EN - VD 5.1", cpl: 49.55, cpc: 7.62, inv: 99.1, leads: 2 },
      { name: "EN - VD 4.1", cpl: 12.78, cpc: 3.41, inv: 102.21, leads: 8 },
      { name: "EN - VD 5", cpl: 12.27, cpc: 7.01, inv: 98.16, leads: 8 },
      { name: "EN - VD2", cpl: 51.03, cpc: 10.21, inv: 102.06, leads: 2 },
      { name: "EN - VD 1 Híbrido", cpl: 33.45, cpc: 9.12, inv: 100.36, leads: 3 },
      { name: "EN - VD 3", cpl: 7.21, cpc: 3.61, inv: 100.99, leads: 14 },
      { name: "EN - VD 3.1", cpl: 8.33, cpc: 3.33, inv: 99.97, leads: 12 },
    ],
  },
  {
    key: "demais",
    label: "Energia — Demais Regiões",
    color: "hsl(142 76% 36%)",
    plannedAvgCpl: 15.336,
    creatives: [
      { name: "EN - VD3", cpl: 14.36, cpc: 3.72, inv: 100.51, leads: 7 },
      { name: "EN - VD1 — Híbrido", cpl: 14.81, cpc: 5.19, inv: 103.7, leads: 7 },
      { name: "EN - VD 2.1", cpl: 34.3, cpc: 5.42, inv: 102.91, leads: 3 },
      { name: "EN - VD2", cpl: 17.45, cpc: 6.16, inv: 104.72, leads: 6 },
      { name: "EN - VD 5.1", cpl: 6.57, cpc: 3.79, inv: 98.6, leads: 15 },
      { name: "EN - VD 1.1 — Híbrido", cpl: 17, cpc: 8.5, inv: 101.99, leads: 6 },
      { name: "EN - VD 3,1 (duplicado?)", cpl: 8.36, cpc: 3.23, inv: 100.28, leads: 12 },
      { name: "EN - VD 4.1", cpl: 7.24, cpc: 2.67, inv: 101.3, leads: 14 },
      { name: "EN - VD4", cpl: 8.54, cpc: 3.11, inv: 102.49, leads: 12 },
      { name: "EN - VD5", cpl: 24.73, cpc: 8.24, inv: 98.93, leads: 4 },
    ],
  },
  {
    key: "mob-stefane",
    label: "Mobilidade — Stefane",
    color: "hsl(280 65% 55%)",
    creatives: [{ name: "VD1", cpl: 5.22, cpc: 2.81, inv: 693.65, leads: 133 }],
  },
  {
    key: "mob-dayan",
    label: "Mobilidade — Dayan",
    color: "hsl(200 90% 50%)",
    creatives: [{ name: "VD1", cpl: 4.79, cpc: 2.52, inv: 229.7, leads: 48 }],
  },
];

function money(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}
function num(n: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(n || 0));
}

function groupTotals(g: Group) {
  const inv = g.creatives.reduce((a, c) => a + c.inv, 0);
  const leads = g.creatives.reduce((a, c) => a + c.leads, 0);
  const weightedCpl = leads ? inv / leads : 0;
  const simpleAvgCpl =
    g.creatives.reduce((a, c) => a + c.cpl, 0) / (g.creatives.length || 1);
  return { inv, leads, weightedCpl, simpleAvgCpl };
}

export function MetaAdsPanel() {
  const [tab, setTab] = useState("visao");

  const all = useMemo(() => GROUPS.flatMap((g) => g.creatives.map((c) => ({ ...c, group: g.label }))), []);
  const totals = useMemo(() => {
    const inv = all.reduce((a, c) => a + c.inv, 0);
    const leads = all.reduce((a, c) => a + c.leads, 0);
    const cpl = leads ? inv / leads : 0;
    // reconstrução: cliques = inv / cpc  (dado que a planilha traz CPC por criativo)
    const clicks = all.reduce((a, c) => a + (c.cpc ? c.inv / c.cpc : 0), 0);
    const cpc = clicks ? inv / clicks : 0;
    return { inv, leads, cpl, clicks, cpc };
  }, [all]);

  const topByCpl = useMemo(
    () => [...all].filter((c) => c.leads >= 5).sort((a, b) => a.cpl - b.cpl).slice(0, 8),
    [all],
  );
  const worstByCpl = useMemo(
    () => [...all].sort((a, b) => b.cpl - a.cpl).slice(0, 5),
    [all],
  );
  const topByVolume = useMemo(() => [...all].sort((a, b) => b.leads - a.leads).slice(0, 8), [all]);

  const kpis = [
    { label: "Investimento (5 dias)", value: money(totals.inv), icon: DollarSign },
    { label: "Leads gerados", value: num(totals.leads), icon: Users },
    { label: "CPL ponderado", value: money(totals.cpl), icon: Target },
    { label: "Cliques estimados", value: num(totals.clicks), icon: TrendingUp },
    { label: "CPC médio", value: money(totals.cpc), icon: DollarSign },
    { label: "Criativos ativos", value: num(all.length), icon: Trophy },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-bold text-xl">
              <MessageCircle className="h-6 w-6 text-primary" />
              Meta Ads — Resultado real dos últimos 5 dias
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Facebook + Instagram → WhatsApp direto. Estes anúncios ainda <b>não passam pela
              ferramenta de leads</b>, então CAC / ROI / ROAS entram como pendentes até o
              plugue com o CRM. Dados carregados da planilha <code>LZ7 - 20.07.xlsx</code>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Período: últimos 5 dias</Badge>
            <Badge variant="outline">Fonte: planilha oficial</Badge>
            <Badge className="bg-emerald-600 hover:bg-emerald-600">Real</Badge>
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

      {/* Caixa de correções */}
      <Card className="p-5 border-amber-500/40 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-3 flex-1">
            <div className="font-semibold text-base">Correções encontradas ao conferir os cálculos</div>
            <div className="text-sm text-muted-foreground">
              Todos os totais de investimento e leads da planilha batem 100%. O ponto de
              atenção está na <b>média de CPL por região</b>: a planilha usa média
              aritmética simples (soma dos CPLs ÷ nº de criativos), mas o correto para
              performance de conta é <b>CPL ponderado</b> (investimento total ÷ leads
              totais). Veja o comparativo:
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Região</TableHead>
                    <TableHead className="text-right">Investimento</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">CPL planilha (simples)</TableHead>
                    <TableHead className="text-right">CPL correto (ponderado)</TableHead>
                    <TableHead className="text-right">Ajuste</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {GROUPS.filter((g) => g.plannedAvgCpl).map((g) => {
                    const t = groupTotals(g);
                    const diff = t.weightedCpl - (g.plannedAvgCpl ?? 0);
                    const pct = g.plannedAvgCpl ? (diff / g.plannedAvgCpl) * 100 : 0;
                    return (
                      <TableRow key={g.key}>
                        <TableCell className="font-medium">{g.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(t.inv)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(t.leads)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground line-through">
                          {money(g.plannedAvgCpl ?? 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-emerald-600">
                          {money(t.weightedCpl)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className={diff < 0 ? "text-emerald-600" : "text-destructive"}>
                            {diff < 0 ? "▼" : "▲"} {pct.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <ul className="text-sm space-y-1.5 list-disc list-inside text-muted-foreground">
              <li>
                <b>CPL geral ponderado</b> da operação inteira ={" "}
                <b className="text-foreground">{money(totals.cpl)}</b> ({num(totals.leads)} leads /{" "}
                {money(totals.inv)}).
              </li>
              <li>
                Em <b>Demais Regiões</b> há um item "EN - VD 3,1" (com vírgula) que parece ser
                duplicata/typo de "EN - VD 3.1" — vale unificar na origem.
              </li>
              <li>
                CAC / ROI / ROAS ficam vazios porque as vendas destes leads ainda não são
                atribuídas — assim que os leads do WhatsApp entrarem no CRM, o painel calcula
                automaticamente.
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Rankings */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="visao">Melhores criativos</TabsTrigger>
          <TabsTrigger value="volume">Mais volume</TabsTrigger>
          <TabsTrigger value="regioes">Por região</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="mt-4 space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-emerald-600" />
              <div className="font-semibold">Top criativos por menor CPL (≥ 5 leads)</div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topByCpl} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" fontSize={11} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={140} />
                  <Tooltip
                    formatter={(v: any) => money(Number(v))}
                    labelFormatter={(l, p) => `${l} — ${p?.[0]?.payload?.group ?? ""}`}
                  />
                  <Bar dataKey="cpl" radius={[0, 6, 6, 0]}>
                    {topByCpl.map((_, i) => (
                      <Cell key={i} fill="hsl(142 76% 36%)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid gap-2">
              {topByCpl.slice(0, 5).map((c, i) => (
                <div
                  key={c.group + c.name}
                  className="flex items-center justify-between rounded-lg border p-3 bg-emerald-500/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.group}</div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-right">
                    <div>
                      <div className="text-xs text-muted-foreground">CPL</div>
                      <div className="font-bold text-emerald-600 tabular-nums">{money(c.cpl)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Leads</div>
                      <div className="font-semibold tabular-nums">{num(c.leads)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Invest.</div>
                      <div className="font-semibold tabular-nums">{money(c.inv)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <div className="font-semibold">Piores CPL — candidatos a pausar ou refazer</div>
            </div>
            <div className="grid gap-2">
              {worstByCpl.map((c) => (
                <div key={c.group + c.name} className="flex items-center justify-between rounded-lg border p-3 bg-destructive/5">
                  <div>
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.group}</div>
                  </div>
                  <div className="flex gap-4 text-right">
                    <div>
                      <div className="text-xs text-muted-foreground">CPL</div>
                      <div className="font-bold text-destructive tabular-nums">{money(c.cpl)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Leads</div>
                      <div className="font-semibold tabular-nums">{num(c.leads)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Invest.</div>
                      <div className="font-semibold tabular-nums">{money(c.inv)}</div>
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
                  <XAxis dataKey="name" fontSize={10} angle={-30} textAnchor="end" interval={0} height={70} />
                  <YAxis fontSize={11} />
                  <Tooltip labelFormatter={(l, p) => `${l} — ${p?.[0]?.payload?.group ?? ""}`} />
                  <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="regioes" className="mt-4 space-y-4">
          {GROUPS.map((g) => {
            const t = groupTotals(g);
            const sorted = [...g.creatives].sort((a, b) => a.cpl - b.cpl);
            return (
              <Card key={g.key} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ background: g.color }} />
                    <div className="font-semibold">{g.label}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">{money(t.inv)} investidos</Badge>
                    <Badge variant="secondary">{num(t.leads)} leads</Badge>
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">
                      CPL ponderado {money(t.weightedCpl)}
                    </Badge>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criativo</TableHead>
                      <TableHead className="text-right">Invest.</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">CPL</TableHead>
                      <TableHead className="text-right">CPC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((c, idx) => (
                      <TableRow key={c.name}>
                        <TableCell className="font-medium">
                          {idx === 0 && <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-600 mr-1" />}
                          {c.name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{money(c.inv)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(c.leads)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{money(c.cpl)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(c.cpc)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      <Card className="p-4 text-xs text-muted-foreground">
        <b>Próximo passo:</b> semana que vem entra a otimização/escala dos criativos com
        melhor CPL (destacados em verde). Assim que ligarmos os leads do WhatsApp na
        ferramenta, este painel passa a mostrar CAC, ROI e ROAS reais por criativo.
      </Card>
    </div>
  );
}
