import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell, Area, AreaChart,
} from "recharts";
import { TrendingUp, DollarSign, Target, Users, Trophy, Activity, Sun } from "lucide-react";
import { getBiMetrics } from "@/lib/crm-advanced.functions";

const BRAND_GREEN = "#0E6A3C";
const BRAND_ORANGE = "#F26A21";
const INK = "#0f1418";
const PALETTE = [BRAND_GREEN, BRAND_ORANGE, "#3b82f6", "#a855f7", "#ef4444", "#f59e0b", "#14b8a6"];

const MOTTOS = [
  "Cada venda é um sonho realizado.",
  "Feito é melhor que perfeito.",
  "O óbvio precisa ser dito.",
];

const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (n: number) => (n || 0).toLocaleString("pt-BR");

function toYMD(d: Date) { return d.toISOString().slice(0, 10); }

export function BiDashboard() {
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 86400_000);
    return { from: toYMD(from), to: toYMD(to) };
  });

  const fn = useServerFn(getBiMetrics);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["bi_metrics", range.from, range.to],
    queryFn: () => fn({ data: range }),
  });

  const kpis = data?.kpis;
  const series = data?.timeseries ?? [];
  const bySource = data?.bySource ?? [];
  const perConsultor = data?.perConsultor ?? [];
  const campaigns = (data as any)?.campaigns ?? [];

  const totals = useMemo(() => kpis ?? null, [kpis]);
  const topDog = useMemo(() => {
    if (!perConsultor.length) return null;
    return [...perConsultor].sort((a: any, b: any) => (b.valor || 0) - (a.valor || 0))[0];
  }, [perConsultor]);

  return (
    <section className="space-y-6">
      {/* Header executivo */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#0f1418] via-[#131a1f] to-[#0f1418] p-6 text-white shadow-xl">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#0E6A3C]/20 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-[#F26A21]/15 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-white/50">
              <Sun className="h-3 w-3 text-[#F26A21]" /> LZ7 Energia · Painel Executivo
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Cada venda é um <span className="text-[#F26A21]">sonho realizado</span>.
            </h2>
            <p className="mt-2 text-sm text-white/60 italic">
              "Feito é melhor que perfeito. O óbvio precisa ser dito."
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-white/50">De</Label>
              <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })}
                className="h-9 bg-white/5 border-white/10 text-white focus:border-[#F26A21]" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-white/50">Até</Label>
              <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })}
                className="h-9 bg-white/5 border-white/10 text-white focus:border-[#F26A21]" />
            </div>
          </div>
        </div>

        {/* Headline KPIs */}
        {totals && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeadlineKpi label="Faturado" value={fmtBRL(totals.totalFaturado)} accent="green" icon={<DollarSign className="h-4 w-4" />} />
            <HeadlineKpi label="ROAS" value={`${(totals.roas || 0).toFixed(2)}x`} accent="orange" icon={<TrendingUp className="h-4 w-4" />} />
            <HeadlineKpi label="Ticket médio" value={fmtBRL(totals.ticket)} accent="white" icon={<Target className="h-4 w-4" />} />
            <HeadlineKpi label="CAC" value={fmtBRL(totals.cac)} accent="white" icon={<Activity className="h-4 w-4" />} />
          </div>
        )}
      </div>

      {isError && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">Erro: {(error as Error).message}</div>}
      {isLoading && <div className="rounded-lg border bg-background p-6 text-muted-foreground text-center">Carregando indicadores…</div>}

      {totals && (
        <>
          {/* Grid de métricas */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <MetricCard label="Investimento" value={fmtBRL(totals.totalSpend)} />
            <MetricCard label="Leads CRM" value={fmtNum(totals.totalLeads)} />
            <MetricCard label="Leads Meta" value={fmtNum(totals.totalCampaignLeads || 0)} />
            <MetricCard label="CPL" value={fmtBRL(totals.cpl)} highlight />
            <MetricCard label="Vendas" value={fmtNum(totals.vendas)} />
            <MetricCard label="Faturados" value={fmtNum(totals.faturados)} highlight />
            <MetricCard label="Impressões" value={fmtNum(totals.totalImpressions || 0)} />
            <MetricCard label="Cliques" value={fmtNum(totals.totalClicks || 0)} />
            <MetricCard label="CTR" value={`${(totals.ctr || 0).toFixed(2)}%`} />
            <MetricCard label="CPC" value={fmtBRL(totals.cpc)} />
            <MetricCard label="Campanhas ativas" value={fmtNum(totals.activeCampaigns || 0)} />
            <MetricCard label="Pausadas" value={fmtNum(totals.pausedCampaigns || 0)} />
          </div>

          {/* Gráficos */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">P&L Diário</div>
                  <h3 className="text-lg font-bold">Investimento × Faturamento</h3>
                </div>
                <TrendingUp className="h-5 w-5 text-[#0E6A3C]" />
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={BRAND_GREEN} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={BRAND_GREEN} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={BRAND_ORANGE} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={BRAND_ORANGE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => fmtBRL(Number(v))}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="faturado" name="Faturado" stroke={BRAND_GREEN} strokeWidth={2} fill="url(#gFat)" />
                    <Area type="monotone" dataKey="spend" name="Investimento" stroke={BRAND_ORANGE} strokeWidth={2} fill="url(#gSpend)" />
                    <Line type="monotone" dataKey="vendas" name="Vendas" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5">
              <div className="mb-4">
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Origem</div>
                <h3 className="text-lg font-bold">Leads por canal</h3>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bySource} dataKey="value" nameKey="name" innerRadius={55} outerRadius={100} paddingAngle={3}
                      stroke="hsl(var(--background))" strokeWidth={2}>
                      {bySource.map((_: any, i: number) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top closer + Ranking */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1 rounded-2xl border border-[#0E6A3C]/30 bg-gradient-to-br from-[#0E6A3C] to-[#0a5230] p-6 text-white relative overflow-hidden shadow-lg">
              <Trophy className="absolute -right-6 -bottom-6 h-40 w-40 text-white/10" />
              <div className="relative">
                <div className="text-[10px] tracking-[0.3em] uppercase text-white/70">🏆 Top Closer do período</div>
                <div className="mt-3 text-2xl font-bold">
                  {topDog?.name ?? "—"}
                </div>
                <div className="mt-6 text-4xl font-black">
                  {fmtBRL(topDog?.valor ?? 0)}
                </div>
                <div className="mt-2 text-xs text-white/70">
                  {topDog ? `${topDog.leads} leads · ${topDog.vendas} vendas · ${topDog.faturado} faturados` : "Sem dados no período"}
                </div>
                <div className="mt-4 text-[11px] italic text-white/60 border-t border-white/15 pt-3">
                  "Cada venda é um sonho realizado."
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-2xl border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Leaderboard</div>
                  <h3 className="text-lg font-bold">Ranking de consultores</h3>
                </div>
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perConsultor}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any, k: any) => (k === "valor" ? fmtBRL(Number(v)) : v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="leads" name="Leads" fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar dataKey="vendas" name="Vendas" fill={BRAND_GREEN} radius={[4,4,0,0]} />
                    <Bar dataKey="faturado" name="Faturado" fill={BRAND_ORANGE} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Cards de consultores */}
          <div className="rounded-2xl border bg-card p-5">
            <div className="mb-4">
              <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Performance individual</div>
              <h3 className="text-lg font-bold">Consultores no período</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {perConsultor.map((c: any, i: number) => (
                <div key={c.userId}
                  className="group rounded-lg border bg-background p-3 hover:border-[#0E6A3C]/50 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${i === 0 ? "text-[#F26A21]" : "text-muted-foreground"}`}>#{i + 1}</span>
                      <div className="font-semibold">{c.name}</div>
                    </div>
                    <div className="text-sm font-bold text-[#0E6A3C]">{fmtBRL(c.valor)}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {c.leads} leads · {c.vendas} vendas · {c.faturado} faturados
                  </div>
                </div>
              ))}
              {!perConsultor.length && (
                <div className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhum consultor com leads no período.</div>
              )}
            </div>
          </div>

          {/* Campanhas */}
          <div className="rounded-2xl border bg-card p-5 overflow-x-auto">
            <div className="mb-4">
              <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Meta Ads · Google Ads</div>
              <h3 className="text-lg font-bold">Campanhas no período</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-2 text-left">Campanha</th>
                  <th className="py-2 pr-2 text-left">Canal</th>
                  <th className="py-2 pr-2 text-left">Status</th>
                  <th className="py-2 pr-2 text-right">Invest.</th>
                  <th className="py-2 pr-2 text-right">Impr.</th>
                  <th className="py-2 pr-2 text-right">Cliques</th>
                  <th className="py-2 pr-2 text-right">Leads</th>
                  <th className="py-2 pr-2 text-right">CPL</th>
                  <th className="py-2 pr-2 text-right">CTR</th>
                </tr>
              </thead>
              <tbody>
                {!campaigns.length && <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">Nenhuma campanha lançada no período.</td></tr>}
                {campaigns.map((c: any) => {
                  const cpl = c.leads_count > 0 ? Number(c.amount) / c.leads_count : 0;
                  const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
                  const active = String(c.status).toLowerCase().includes("active");
                  return (
                    <tr key={c.id} className="border-b hover:bg-secondary/50">
                      <td className="py-2 pr-2 font-medium">{c.campaign || "—"}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{c.channel}</td>
                      <td className="py-2 pr-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider
                          ${active ? "bg-[#0E6A3C]/10 text-[#0E6A3C] border border-[#0E6A3C]/30" : "bg-muted text-muted-foreground border"}`}>
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-[#0E6A3C] animate-pulse" />}
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right font-mono text-[#F26A21] font-semibold">{fmtBRL(Number(c.amount))}</td>
                      <td className="py-2 pr-2 text-right font-mono text-muted-foreground">{fmtNum(Number(c.impressions || 0))}</td>
                      <td className="py-2 pr-2 text-right font-mono text-muted-foreground">{fmtNum(Number(c.clicks || 0))}</td>
                      <td className="py-2 pr-2 text-right font-mono">{fmtNum(Number(c.leads_count || 0))}</td>
                      <td className="py-2 pr-2 text-right font-mono">{cpl ? fmtBRL(cpl) : "—"}</td>
                      <td className="py-2 pr-2 text-right font-mono">{ctr ? `${ctr.toFixed(2)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rodapé com mottos */}
          <div className="rounded-2xl border-2 border-dashed border-[#F26A21]/30 bg-gradient-to-r from-[#F26A21]/5 via-transparent to-[#0E6A3C]/5 p-6 text-center">
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">Manifesto LZ7</div>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
              {MOTTOS.map((m) => (
                <span key={m} className="text-sm font-medium italic text-foreground/80">"{m}"</span>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function HeadlineKpi({ label, value, accent, icon }: { label: string; value: string; accent: "green" | "orange" | "white"; icon: React.ReactNode }) {
  const colorMap = {
    green: "text-[#4ade80]",
    orange: "text-[#F26A21]",
    white: "text-white",
  } as const;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur px-4 py-3">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-white/50">
        <span>{label}</span>
        <span className={colorMap[accent]}>{icon}</span>
      </div>
      <div className={`mt-1 text-2xl font-black ${colorMap[accent]}`}>
        {value}
      </div>
    </div>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card p-3 ${highlight ? "border-[#0E6A3C]/40 bg-[#0E6A3C]/5" : ""}`}>
      <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold font-mono ${highlight ? "text-[#0E6A3C]" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
