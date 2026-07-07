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
            <Kpi label="Leads gerados" value={totals.totalLeads} />
            <Kpi label="Vendas" value={totals.vendas} />
            <Kpi label="Faturados" value={totals.faturados} />
            <Kpi label="CPL (custo por lead)" value={fmtBRL(totals.cpl)} />
            <Kpi label="CAC (custo por venda)" value={fmtBRL(totals.cac)} />
            <Kpi label="ROAS" value={`${totals.roas.toFixed(2)}x`} accent />
            <Kpi label="Ticket médio" value={fmtBRL(totals.ticket)} />
            <Kpi label="Valor vendido" value={fmtBRL(totals.totalVendido)} />
            <Kpi label="Valor faturado" value={fmtBRL(totals.totalFaturado)} accent />
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
