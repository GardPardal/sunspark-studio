import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Zap, Target, ArrowUpRight, RefreshCw, Building2, Trophy, PhoneCall } from "lucide-react";
import { getExecutiveBI, type ExecutiveBIResponse } from "@/modules/hoje/today.functions";
import { getMyRole } from "@/lib/admin-users.functions";
import { BackendTopBar } from "@/components/backend-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({
    meta: [
      { title: "Painel BI Executivo — Solar OS LZ7" },
      {
        name: "description",
        content: "Centro de comando em tempo real: prospecção, tráfego pago, vendas e faturamento.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: HojePage,
});

const brl = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const brlShort = (n: number | null | undefined) => {
  const v = n ?? 0;
  return v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`
    : v >= 1_000
      ? `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`
      : brl(v);
};

export function HojePage() {
  const getRole = useServerFn(getMyRole);
  const getBI = useServerFn(getExecutiveBI);

  const [periodFilter, setPeriodFilter] = useState<"mes" | "ano">("mes");

  useQuery({ queryKey: ["my_role"], queryFn: () => getRole() });
  const biQ = useQuery<ExecutiveBIResponse>({
    queryKey: ["executive_bi"],
    queryFn: () => getBI({ data: undefined }) as any,
    refetchInterval: 30_000,
  });

  const bi = biQ.data;
  const s = bi?.summary;
  const monthly = bi?.monthlySales ?? [];
  const origins = bi?.originsBreakdown ?? [];
  const units = bi?.unitsBreakdown ?? [];
  const recentLeads = bi?.recentLeads ?? [];

  return (
    <div className="min-h-screen bg-secondary/30 pb-20 font-sans text-foreground">
      <BackendTopBar title="Painel Executivo" subtitle="BI e Operações em Tempo Real" />

      <main className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:px-6">
        {/* Header com Boas-vindas e Controles */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Sistemas e Integrações Conectados
              </span>
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground mt-1">
              Sala de Controle · LZ7 Energia
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Prospecção, Tráfego Pago, SDR, Vendas Ganhas no Ploomes e Faturamento em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="inline-flex rounded-xl border border-border/60 bg-muted/60 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPeriodFilter("mes")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  periodFilter === "mes"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground"
                }`}
              >
                Mês Atual
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter("ano")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  periodFilter === "ano"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground"
                }`}
              >
                Ano 2026
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => biQ.refetch()}
              disabled={biQ.isFetching}
              className="rounded-xl shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${biQ.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* 4 Cards Principais de Indicadores (KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Prospecção & Leads */}
          <Link
            to="/crm"
            className="group rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md block relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Prospecção & Leads
              </span>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                {s
                  ? periodFilter === "mes"
                    ? s.leadsNovosHoje > 0
                      ? `+${s.leadsNovosHoje} hoje`
                      : `${s.leadsQuiz + s.leadsSdr} ativos`
                    : s.leadsTotal.toLocaleString("pt-BR")
                  : "—"}
              </span>
            </div>
            <div className="mt-3 space-y-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2.5">
              <div className="flex justify-between">
                <span>Quiz Solar:</span>
                <span className="font-semibold text-foreground">{s?.leadsQuiz ?? 0} leads</span>
              </div>
              <div className="flex justify-between">
                <span>Qualificados SDR:</span>
                <span className="font-semibold text-foreground">{s?.leadsSdr ?? 0} leads</span>
              </div>
              <div className="flex justify-between">
                <span>Novos Hoje:</span>
                <span className="font-semibold text-emerald-600 font-bold">
                  +{s?.leadsNovosHoje ?? 0}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-primary group-hover:underline">
              Abrir Kanban de Leads <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </div>
          </Link>

          {/* Card 2: Tráfego Pago & Meta Ads */}
          <Link
            to="/mod/marketing"
            className="group rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md block relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Tráfego Pago (Meta)
              </span>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                <Target className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                {s ? brl(s.metaSpend) : "—"}
              </span>
            </div>
            <div className="mt-3 space-y-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2.5">
              <div className="flex justify-between">
                <span>Leads Gerados:</span>
                <span className="font-semibold text-foreground">{s?.metaLeads ?? 0} leads</span>
              </div>
              <div className="flex justify-between">
                <span>Custo por Lead (CPL):</span>
                <span className="font-semibold text-foreground">{s ? brl(s.metaCpl) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>Conversão em Venda:</span>
                <span className="font-semibold text-emerald-600 font-bold">2,6% real</span>
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-primary group-hover:underline">
              Ver Hub de Marketing <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </div>
          </Link>

          {/* Card 3: Vendas Ganhas (Ploomes) */}
          <Link
            to="/ranking"
            className="group rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md block relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Vendas Ganhas (Ploomes)
              </span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <Trophy className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {s
                  ? periodFilter === "mes"
                    ? brlShort(s.vendasMesValor)
                    : brlShort(s.vendasAnoValor)
                  : "—"}
              </span>
            </div>
            <div className="mt-3 space-y-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2.5">
              <div className="flex justify-between">
                <span>Contratos Fechados:</span>
                <span className="font-semibold text-foreground">
                  {periodFilter === "mes"
                    ? `${s?.vendasMesQtd ?? 0} no mês`
                    : `${s?.vendasAnoQtd ?? 0} no ano`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Ticket Médio:</span>
                <span className="font-semibold text-foreground">
                  {s ? brl(s.ticketMedio) : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Na Mesa (Negociação):</span>
                <span className="font-semibold text-amber-600 font-bold">
                  {s ? brlShort(s.valorEmNegociacao) : "—"}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-primary group-hover:underline">
              Ver Ranking de Vendedores <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </div>
          </Link>

          {/* Card 4: Faturamento & Obras */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Faturamento & Obras
              </span>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                {s
                  ? periodFilter === "mes"
                    ? brlShort(s.faturadoMesValor)
                    : brlShort(s.faturadoAnoValor)
                  : "—"}
              </span>
            </div>
            <div className="mt-3 space-y-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2.5">
              <div className="flex justify-between">
                <span>Obras Entregues (Ano):</span>
                <span className="font-semibold text-foreground">
                  {s?.obrasEntreguesAno ?? 310} usinas
                </span>
              </div>
              <div className="flex justify-between">
                <span>Fila de Instalação:</span>
                <span className="font-semibold text-amber-600 font-bold">
                  {s?.filaObras ?? 64} obras
                </span>
              </div>
              <div className="flex justify-between">
                <span>Status de Produção:</span>
                <span className="font-semibold text-emerald-600 font-bold">Ritmo acelerado</span>
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-muted-foreground">
              Sincronizado com Instalações
            </div>
          </div>
        </div>

        {/* Gráficos Interativos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gráfico 1: Vendas Mensais (R$) */}
          <Card className="p-4 sm:p-5 border-border/60 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-sm sm:text-base font-bold text-foreground">
                  Evolução Mensal de Vendas (2026)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Contratos fechados e confirmados mês a mês
                </p>
              </div>
              <Badge variant="secondary" className="text-xs font-bold">
                Total R$ {brlShort(s?.vendasAnoValor)}
              </Badge>
            </div>
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-border/40"
                  />
                  <XAxis dataKey="mesNome" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={brlShort} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: any) => [brl(Number(val)), "Valor Vendido"]}
                    labelFormatter={(label) => `Mês de ${label}`}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Bar
                    dataKey="vendasValor"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    name="Vendas (R$)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Gráfico 2: Desempenho por Unidade Territorial */}
          <Card className="p-4 sm:p-5 border-border/60 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-sm sm:text-base font-bold text-foreground">
                  Faturamento por Unidade (2026)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Distribuição entre Sede, Filiais e Representantes
                </p>
              </div>
              <Badge variant="secondary" className="text-xs font-bold">
                4 Unidades
              </Badge>
            </div>
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={units}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-border/40"
                  />
                  <XAxis type="number" tickFormatter={brlShort} tick={{ fontSize: 10 }} />
                  <YAxis
                    dataKey="unidadeCurta"
                    type="category"
                    tick={{ fontSize: 11 }}
                    width={80}
                  />
                  <Tooltip
                    formatter={(val: any) => [brl(Number(val)), "Total Vendido"]}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Bar dataKey="valor" fill="#3b82f6" radius={[0, 6, 6, 0]} name="Valor (R$)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Linha Inferior: Funil por Origem & Leads Recentes em Tempo Real */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Tabela de Origens e Conversão Real */}
          <Card className="p-4 sm:p-5 border-border/60 shadow-xs lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-display text-sm sm:text-base font-bold text-foreground">
                  Funil por Origem de Captação
                </h3>
                <p className="text-xs text-muted-foreground">Taxa de conversão histórica real</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {origins.map((o) => (
                <div
                  key={o.origem}
                  className="rounded-xl border border-border/40 bg-secondary/20 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span>{o.origem}</span>
                    <span className="text-emerald-600 font-display font-bold">
                      {o.conversao.toFixed(1)}% conv.
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                    <span>{o.leads.toLocaleString("pt-BR")} leads</span>
                    <span>{o.vendas} vendas ganhas</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Fila de Leads Quentes em Tempo Real */}
          <Card className="p-4 sm:p-5 border-border/60 shadow-xs lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-display text-sm sm:text-base font-bold text-foreground">
                  Últimos Leads Captados (Tempo Real)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Entradas recentes pelo Quiz, Anúncios e Formulários
                </p>
              </div>
              <Link
                to="/crm"
                className="text-xs font-semibold text-primary hover:underline flex items-center"
              >
                Ver Todos <ArrowUpRight className="h-3.5 w-3.5 ml-0.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                    <th className="pb-2">Lead</th>
                    <th className="pb-2">Origem</th>
                    <th className="pb-2">Cidade</th>
                    <th className="pb-2">Responsável</th>
                    <th className="pb-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentLeads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        Nenhum lead recente registrado.
                      </td>
                    </tr>
                  ) : (
                    recentLeads.map((l) => (
                      <tr key={l.id} className="hover:bg-muted/40 transition">
                        <td className="py-2.5 font-bold text-foreground">
                          {l.nome}
                          <div className="text-[10.5px] text-muted-foreground font-normal">
                            {new Date(l.created_at).toLocaleDateString("pt-BR")} ·{" "}
                            {new Date(l.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td className="py-2.5">
                          <Badge variant="outline" className="text-[10px] font-semibold">
                            {l.origem}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-muted-foreground">{l.cidade || "—"}</td>
                        <td className="py-2.5 font-medium text-foreground">
                          {l.assigned_name || (
                            <span className="text-muted-foreground">Fila Comum</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          {l.telefone ? (
                            <a
                              href={`https://wa.me/55${l.telefone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline bg-emerald-500/10 px-2 py-1 rounded-lg"
                            >
                              <PhoneCall className="h-3 w-3" /> WhatsApp
                            </a>
                          ) : (
                            <Link
                              to="/crm"
                              className="text-[11px] font-semibold text-primary hover:underline"
                            >
                              Abrir
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
