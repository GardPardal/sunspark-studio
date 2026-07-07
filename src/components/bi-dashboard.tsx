import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { getBiMetrics } from "@/lib/crm-advanced.functions";

const COLORS = ["#0E6A3C", "#F26A21", "#2563eb", "#a855f7", "#ef4444", "#eab308", "#14b8a6"];
const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

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

  return (
    <section className="space-y-6">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
        <div className="text-xs text-muted-foreground">
          Últimos 30 dias por padrão. Ajuste as datas para o período desejado.
        </div>
      </Card>

      {isError && <Card className="p-4 text-destructive">Erro: {(error as Error).message}</Card>}
      {isLoading && <Card className="p-6 text-muted-foreground">Carregando indicadores…</Card>}

      {totals && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Investimento em tráfego" value={fmtBRL(totals.totalSpend)} accent />
            <Kpi label="Impressões" value={(totals.totalImpressions || 0).toLocaleString("pt-BR")} />
            <Kpi label="Cliques" value={(totals.totalClicks || 0).toLocaleString("pt-BR")} />
            <Kpi label="CTR" value={`${(totals.ctr || 0).toFixed(2)}%`} />
            <Kpi label="Leads (plataforma)" value={totals.totalCampaignLeads || 0} />
            <Kpi label="Leads (CRM)" value={totals.totalLeads} />
            <Kpi label="CPL" value={fmtBRL(totals.cpl)} accent />
            <Kpi label="CPC" value={fmtBRL(totals.cpc)} />
            <Kpi label="Vendas" value={totals.vendas} />
            <Kpi label="Faturados" value={totals.faturados} />
            <Kpi label="CAC" value={fmtBRL(totals.cac)} />
            <Kpi label="Ticket médio" value={fmtBRL(totals.ticket)} />
            <Kpi label="ROAS" value={`${(totals.roas || 0).toFixed(2)}x`} accent />
            <Kpi label="Valor faturado" value={fmtBRL(totals.totalFaturado)} accent />
            <Kpi label="Campanhas ativas" value={totals.activeCampaigns || 0} />
            <Kpi label="Campanhas pausadas" value={totals.pausedCampaigns || 0} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Investimento × Faturamento (diário)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                    <Legend />
                    <Line type="monotone" dataKey="spend" name="Investimento" stroke="#F26A21" strokeWidth={2} />
                    <Line type="monotone" dataKey="faturado" name="Faturado" stroke="#0E6A3C" strokeWidth={2} />
                    <Line type="monotone" dataKey="vendas" name="Vendas" stroke="#2563eb" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Leads por canal / origem</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bySource} dataKey="value" nameKey="name" innerRadius={40} outerRadius={90} label>
                      {bySource.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-2">Ranking de consultores</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perConsultor}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any, k: any) => (k === "valor" ? fmtBRL(Number(v)) : v)} />
                  <Legend />
                  <Bar dataKey="leads" name="Leads" fill="#2563eb" />
                  <Bar dataKey="vendas" name="Vendas" fill="#0E6A3C" />
                  <Bar dataKey="faturado" name="Faturado" fill="#F26A21" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {perConsultor.map((c: any) => (
                <div key={c.userId} className="rounded-md border p-2 text-sm flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.leads} leads · {c.vendas} vendas · {c.faturado} faturados
                    </div>
                  </div>
                  <Badge variant="secondary">{fmtBRL(c.valor)}</Badge>
                </div>
              ))}
              {!perConsultor.length && (
                <div className="text-sm text-muted-foreground">Nenhum consultor com leads no período.</div>
              )}
            </div>
          </Card>

          <Card className="p-4 overflow-x-auto">
            <h3 className="text-sm font-semibold mb-2">Campanhas no período</h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="text-left">
                  <th className="py-1 pr-2">Campanha</th>
                  <th className="py-1 pr-2">Canal</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1 pr-2 text-right">Invest.</th>
                  <th className="py-1 pr-2 text-right">Impr.</th>
                  <th className="py-1 pr-2 text-right">Cliques</th>
                  <th className="py-1 pr-2 text-right">Leads</th>
                  <th className="py-1 pr-2 text-right">CPL</th>
                  <th className="py-1 pr-2 text-right">CTR</th>
                </tr>
              </thead>
              <tbody>
                {!campaigns.length && <tr><td colSpan={9} className="py-3 text-center text-muted-foreground">Nenhuma campanha lançada no período.</td></tr>}
                {campaigns.map((c: any) => {
                  const cpl = c.leads_count > 0 ? Number(c.amount) / c.leads_count : 0;
                  const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
                  return (
                    <tr key={c.id} className="border-t">
                      <td className="py-1 pr-2">{c.campaign || "—"}</td>
                      <td className="py-1 pr-2">{c.channel}</td>
                      <td className="py-1 pr-2">{c.status}</td>
                      <td className="py-1 pr-2 text-right">{fmtBRL(Number(c.amount))}</td>
                      <td className="py-1 pr-2 text-right">{Number(c.impressions || 0).toLocaleString("pt-BR")}</td>
                      <td className="py-1 pr-2 text-right">{Number(c.clicks || 0).toLocaleString("pt-BR")}</td>
                      <td className="py-1 pr-2 text-right">{Number(c.leads_count || 0).toLocaleString("pt-BR")}</td>
                      <td className="py-1 pr-2 text-right">{cpl ? fmtBRL(cpl) : "—"}</td>
                      <td className="py-1 pr-2 text-right">{ctr ? `${ctr.toFixed(2)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
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
