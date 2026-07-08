import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell, Area, AreaChart,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Target, Users, Trophy, Flame, Activity } from "lucide-react";
import { getBiMetrics } from "@/lib/crm-advanced.functions";

const GOLD = "#d4af37";
const GOLD_SOFT = "#f0d78c";
const EMERALD = "#10b981";
const RUBY = "#ef4444";
const PALETTE = [GOLD, EMERALD, "#60a5fa", "#a78bfa", RUBY, "#f59e0b", "#14b8a6"];

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
      {/* Trading floor header */}
      <div className="relative overflow-hidden rounded-2xl border border-[#d4af37]/30 bg-gradient-to-br from-[#0a0a0a] via-[#141414] to-[#1a1208] p-6 text-[#f5f0e0] shadow-[0_20px_60px_-20px_rgba(212,175,55,0.35)]">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
             style={{ backgroundImage: "repeating-linear-gradient(45deg, #d4af37 0 1px, transparent 1px 12px)" }} />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-[#d4af37] uppercase">
              <Activity className="h-3 w-3" /> LZ7 Trading Floor · Live
            </div>
            <h2 className="mt-1 text-3xl font-black tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              O <span className="text-[#d4af37]">dinheiro</span> não dorme.
            </h2>
            <p className="mt-1 text-xs text-[#f5f0e0]/60">Sempre vender. Sempre fechar. Painel executivo do comercial.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-[#d4af37]/80">De</Label>
              <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })}
                className="h-9 bg-black/40 border-[#d4af37]/30 text-[#f5f0e0]" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-[#d4af37]/80">Até</Label>
              <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })}
                className="h-9 bg-black/40 border-[#d4af37]/30 text-[#f5f0e0]" />
            </div>
          </div>
        </div>

        {/* Ticker highlights */}
        {totals && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TickerStat label="ROAS" value={`${(totals.roas || 0).toFixed(2)}x`}
              trend={(totals.roas || 0) >= 1 ? "up" : "down"} icon={<Flame className="h-4 w-4" />} big />
            <TickerStat label="Faturado" value={fmtBRL(totals.totalFaturado)} trend="up" icon={<DollarSign className="h-4 w-4" />} big />
            <TickerStat label="CAC" value={fmtBRL(totals.cac)} trend="neutral" icon={<Target className="h-4 w-4" />} big />
            <TickerStat label="Ticket médio" value={fmtBRL(totals.ticket)} trend="up" icon={<TrendingUp className="h-4 w-4" />} big />
          </div>
        )}
      </div>

      {isError && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-400">Erro: {(error as Error).message}</div>}
      {isLoading && <div className="rounded-lg border border-[#d4af37]/20 bg-[#0a0a0a] p-6 text-[#d4af37]/70 text-center">Puxando dados do mercado…</div>}

      {totals && (
        <>
          {/* KPI wall */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <Kpi label="Investimento" value={fmtBRL(totals.totalSpend)} tone="gold" />
            <Kpi label="Leads (CRM)" value={fmtNum(totals.totalLeads)} tone="cool" />
            <Kpi label="Leads plataforma" value={fmtNum(totals.totalCampaignLeads || 0)} tone="cool" />
            <Kpi label="CPL" value={fmtBRL(totals.cpl)} tone="gold" />
            <Kpi label="Vendas" value={fmtNum(totals.vendas)} tone="emerald" />
            <Kpi label="Faturados" value={fmtNum(totals.faturados)} tone="emerald" />
            <Kpi label="Impressões" value={fmtNum(totals.totalImpressions || 0)} tone="cool" />
            <Kpi label="Cliques" value={fmtNum(totals.totalClicks || 0)} tone="cool" />
            <Kpi label="CTR" value={`${(totals.ctr || 0).toFixed(2)}%`} tone="cool" />
            <Kpi label="CPC" value={fmtBRL(totals.cpc)} tone="cool" />
            <Kpi label="Campanhas ativas" value={fmtNum(totals.activeCampaigns || 0)} tone="emerald" />
            <Kpi label="Pausadas" value={fmtNum(totals.pausedCampaigns || 0)} tone="muted" />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase text-[#d4af37]">P&L Diário</div>
                  <h3 className="text-lg font-bold text-[#f5f0e0]">Investimento × Faturamento</h3>
                </div>
                <TrendingUp className="h-5 w-5 text-[#d4af37]" />
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={EMERALD} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GOLD} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d4af37" strokeOpacity={0.08} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#f5f0e0", fillOpacity: 0.6 }} stroke="#d4af37" strokeOpacity={0.2} />
                    <YAxis tick={{ fontSize: 10, fill: "#f5f0e0", fillOpacity: 0.6 }} stroke="#d4af37" strokeOpacity={0.2} />
                    <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 8, color: "#f5f0e0" }}
                      formatter={(v: any) => fmtBRL(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#f5f0e0" }} />
                    <Area type="monotone" dataKey="faturado" name="Faturado" stroke={EMERALD} strokeWidth={2} fill="url(#gFat)" />
                    <Area type="monotone" dataKey="spend" name="Investimento" stroke={GOLD} strokeWidth={2} fill="url(#gSpend)" />
                    <Line type="monotone" dataKey="vendas" name="Vendas" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] p-5">
              <div className="mb-4">
                <div className="text-[10px] tracking-[0.3em] uppercase text-[#d4af37]">Origem</div>
                <h3 className="text-lg font-bold text-[#f5f0e0]">Leads por canal</h3>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bySource} dataKey="value" nameKey="name" innerRadius={55} outerRadius={100} paddingAngle={2}
                      stroke="#0a0a0a" strokeWidth={2}>
                      {bySource.map((_: any, i: number) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 8, color: "#f5f0e0" }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#f5f0e0" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top dog + ranking */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1 rounded-2xl border border-[#d4af37]/50 bg-gradient-to-br from-[#1a1208] via-[#0f0a04] to-black p-6 relative overflow-hidden">
              <Trophy className="absolute -right-4 -bottom-4 h-40 w-40 text-[#d4af37]/10" />
              <div className="text-[10px] tracking-[0.3em] uppercase text-[#d4af37]">🏆 Top Closer</div>
              <div className="mt-3">
                <div className="text-2xl font-black text-[#f5f0e0]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {topDog?.name ?? "—"}
                </div>
                <div className="mt-4 text-4xl font-black text-[#d4af37]">
                  {fmtBRL(topDog?.valor ?? 0)}
                </div>
                <div className="mt-2 text-xs text-[#f5f0e0]/60">
                  {topDog ? `${topDog.leads} leads · ${topDog.vendas} vendas · ${topDog.faturado} faturados` : "Sem dados no período"}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase text-[#d4af37]">Leaderboard</div>
                  <h3 className="text-lg font-bold text-[#f5f0e0]">Ranking de consultores</h3>
                </div>
                <Users className="h-5 w-5 text-[#d4af37]" />
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perConsultor}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d4af37" strokeOpacity={0.08} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#f5f0e0", fillOpacity: 0.6 }} stroke="#d4af37" strokeOpacity={0.2} />
                    <YAxis tick={{ fontSize: 10, fill: "#f5f0e0", fillOpacity: 0.6 }} stroke="#d4af37" strokeOpacity={0.2} />
                    <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 8, color: "#f5f0e0" }}
                      formatter={(v: any, k: any) => (k === "valor" ? fmtBRL(Number(v)) : v)} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#f5f0e0" }} />
                    <Bar dataKey="leads" name="Leads" fill="#60a5fa" radius={[4,4,0,0]} />
                    <Bar dataKey="vendas" name="Vendas" fill={EMERALD} radius={[4,4,0,0]} />
                    <Bar dataKey="faturado" name="Faturado" fill={GOLD} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Consultores cards */}
          <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-[#d4af37]">Performance individual</div>
                <h3 className="text-lg font-bold text-[#f5f0e0]">Consultores no período</h3>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {perConsultor.map((c: any, i: number) => (
                <div key={c.userId}
                  className="group rounded-lg border border-[#d4af37]/15 bg-black/40 p-3 hover:border-[#d4af37]/50 hover:bg-[#d4af37]/5 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#d4af37]/70">#{i + 1}</span>
                      <div className="font-semibold text-[#f5f0e0]">{c.name}</div>
                    </div>
                    <div className="text-sm font-bold text-[#d4af37]">{fmtBRL(c.valor)}</div>
                  </div>
                  <div className="mt-1 text-xs text-[#f5f0e0]/50">
                    {c.leads} leads · {c.vendas} vendas · {c.faturado} faturados
                  </div>
                </div>
              ))}
              {!perConsultor.length && (
                <div className="text-sm text-[#f5f0e0]/40 col-span-full text-center py-8">Nenhum consultor com leads no período.</div>
              )}
            </div>
          </div>

          {/* Campanhas table */}
          <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] p-5 overflow-x-auto">
            <div className="mb-4">
              <div className="text-[10px] tracking-[0.3em] uppercase text-[#d4af37]">Meta Ads · Google Ads</div>
              <h3 className="text-lg font-bold text-[#f5f0e0]">Campanhas no período</h3>
            </div>
            <table className="w-full text-sm text-[#f5f0e0]">
              <thead className="text-[10px] uppercase tracking-widest text-[#d4af37]/70">
                <tr className="border-b border-[#d4af37]/20">
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
                {!campaigns.length && <tr><td colSpan={9} className="py-6 text-center text-[#f5f0e0]/40">Nenhuma campanha lançada no período.</td></tr>}
                {campaigns.map((c: any) => {
                  const cpl = c.leads_count > 0 ? Number(c.amount) / c.leads_count : 0;
                  const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
                  const active = String(c.status).toLowerCase().includes("active");
                  return (
                    <tr key={c.id} className="border-b border-[#d4af37]/10 hover:bg-[#d4af37]/5">
                      <td className="py-2 pr-2 font-medium">{c.campaign || "—"}</td>
                      <td className="py-2 pr-2 text-[#f5f0e0]/70">{c.channel}</td>
                      <td className="py-2 pr-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider
                          ${active ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-[#f5f0e0]/50 border border-white/10"}`}>
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right font-mono text-[#d4af37]">{fmtBRL(Number(c.amount))}</td>
                      <td className="py-2 pr-2 text-right font-mono text-[#f5f0e0]/70">{fmtNum(Number(c.impressions || 0))}</td>
                      <td className="py-2 pr-2 text-right font-mono text-[#f5f0e0]/70">{fmtNum(Number(c.clicks || 0))}</td>
                      <td className="py-2 pr-2 text-right font-mono">{fmtNum(Number(c.leads_count || 0))}</td>
                      <td className="py-2 pr-2 text-right font-mono">{cpl ? fmtBRL(cpl) : "—"}</td>
                      <td className="py-2 pr-2 text-right font-mono">{ctr ? `${ctr.toFixed(2)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function TickerStat({ label, value, trend, icon, big }: { label: string; value: string; trend: "up" | "down" | "neutral"; icon: React.ReactNode; big?: boolean }) {
  const color = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-[#d4af37]";
  return (
    <div className="rounded-lg border border-[#d4af37]/20 bg-black/40 backdrop-blur px-4 py-3">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#f5f0e0]/50">
        <span>{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <div className={`mt-1 font-black ${color} ${big ? "text-2xl" : "text-lg"}`} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        {value}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = "muted" }: { label: string; value: string | number; tone?: "gold" | "emerald" | "cool" | "muted" }) {
  const toneMap = {
    gold: "text-[#d4af37] border-[#d4af37]/40",
    emerald: "text-emerald-400 border-emerald-500/30",
    cool: "text-[#f5f0e0] border-[#d4af37]/15",
    muted: "text-[#f5f0e0]/50 border-white/10",
  } as const;
  return (
    <div className={`rounded-xl border bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] p-3 ${toneMap[tone]}`}>
      <div className="text-[9px] uppercase tracking-[0.2em] text-[#f5f0e0]/50">{label}</div>
      <div className={`mt-1 text-xl font-black font-mono ${tone === "gold" ? "text-[#d4af37]" : tone === "emerald" ? "text-emerald-400" : "text-[#f5f0e0]"}`}>
        {value}
      </div>
    </div>
  );
}
