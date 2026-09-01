import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import {
  Zap,
  Target,
  ArrowUpRight,
  RefreshCw,
  Building2,
  Trophy,
  PhoneCall,
  Lock,
  Calendar,
  Search,
} from "lucide-react";
import { getExecutiveBI, type ExecutiveBIResponse } from "@/modules/hoje/today.functions";
import { getMyRole } from "@/lib/admin-users.functions";
import { BackendTopBar } from "@/components/backend-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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

  // Filtros de Período & Escopo
  const [periodFilter, setPeriodFilter] = useState<
    "hoje" | "7d" | "mes" | "30d" | "ano" | "custom"
  >("mes");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedUnit, setSelectedUnit] = useState<string>("todas");
  const [selectedOrigin, setSelectedOrigin] = useState<string>("todas");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Aba Ativa
  const [activeTab, setActiveTab] = useState<
    "geral" | "fichas" | "campanhas" | "leads" | "supervisao"
  >("geral");

  const roleQ = useQuery({ queryKey: ["my_role"], queryFn: () => getRole() });
  const biQ = useQuery<ExecutiveBIResponse>({
    queryKey: ["executive_bi", periodFilter, startDate, endDate, selectedUnit, selectedOrigin],
    queryFn: () =>
      getBI({
        data: {
          period: periodFilter,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          unit: selectedUnit,
          origin: selectedOrigin,
        },
      }) as any,
    refetchInterval: 30_000,
  });

  const bi = biQ.data;
  const s = bi?.summary;
  const monthly = bi?.monthlySales ?? [];
  const origins = bi?.originsBreakdown ?? [];
  const units = bi?.unitsBreakdown ?? [];
  const recentLeads = bi?.recentLeads ?? [];
  const sellers = bi?.sellersFichas ?? [];
  const campanhas = bi?.metaCampanhas ?? [];
  const alerts = bi?.supervisorAlerts ?? [];
  const userPersonal = bi?.userPersonal;

  const isExecutive =
    roleQ.data?.isAdmin ||
    roleQ.data?.isCoordenador ||
    roleQ.data?.roles?.includes("desenvolvedor") ||
    roleQ.data?.roles?.includes("diretoria") ||
    bi?.isExecutive;

  // Filtragem dos 17 Consultores por Busca & Unidade
  const filteredSellers = useMemo(() => {
    return sellers.filter((v) => {
      const matchSearch =
        !searchTerm ||
        v.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.unidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.discPerfil && v.discPerfil.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchUnit =
        selectedUnit === "todas" || v.unidade.toLowerCase().includes(selectedUnit.toLowerCase());
      return matchSearch && matchUnit;
    });
  }, [sellers, searchTerm, selectedUnit]);

  // Filtragem dos Leads
  const filteredLeads = useMemo(() => {
    return recentLeads.filter((l) => {
      const matchSearch =
        !searchTerm ||
        l.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.cidade && l.cidade.toLowerCase().includes(searchTerm.toLowerCase())) ||
        l.origem.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.assigned_name && l.assigned_name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchOrigin =
        selectedOrigin === "todas" || l.origem.toLowerCase().includes(selectedOrigin.toLowerCase());
      return matchSearch && matchOrigin;
    });
  }, [recentLeads, searchTerm, selectedOrigin]);

  const periodLabel =
    bi?.periodLabel ||
    (periodFilter === "hoje"
      ? "Hoje"
      : periodFilter === "7d"
        ? "Últimos 7 Dias"
        : periodFilter === "mes"
          ? "Mês Atual"
          : periodFilter === "30d"
            ? "Últimos 30 Dias"
            : "Ano 2026");

  return (
    <div className="min-h-screen bg-secondary/30 pb-20 font-sans text-foreground">
      <BackendTopBar
        title={isExecutive ? "Painel Executivo 360°" : "Painel do Consultor"}
        subtitle={
          isExecutive
            ? "Centro de Comando LZ7 Energia · Dados em Tempo Real"
            : "Seu Painel de Trabalho e Metas"
        }
      />

      <main className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:px-6">
        {/* Cabeçalho de Controle & Filtros */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Dados Conectados & Sincronizados
                </span>
                {isExecutive ? (
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-primary/10 text-primary border-primary/20"
                  >
                    Acesso Coordenação / Dev / Diretoria
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Acesso Consultor
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground mt-1">
                {isExecutive
                  ? "Sala de Controle Executiva · LZ7 Energia"
                  : `Olá, ${roleQ.data?.fullName?.split(" ")[0] || "Consultor"}`}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {isExecutive
                  ? `Exibindo indicadores para o período selecionado: ${periodLabel}.`
                  : "Acompanhe seus leads, metas individuais e novos clientes em tempo real."}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => biQ.refetch()}
                disabled={biQ.isFetching}
                className="rounded-xl shadow-xs"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1.5 ${biQ.isFetching ? "animate-spin" : ""}`}
                />
                Atualizar Dados
              </Button>
            </div>
          </div>

          {/* Barra de Filtros Personalizados */}
          <div className="border-t border-border/40 pt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Período:
            </span>

            <div className="inline-flex rounded-xl border border-border/60 bg-muted/60 p-0.5 text-xs font-semibold flex-wrap">
              <button
                type="button"
                onClick={() => setPeriodFilter("hoje")}
                className={`rounded-lg px-2.5 py-1 transition ${
                  periodFilter === "hoje"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter("7d")}
                className={`rounded-lg px-2.5 py-1 transition ${
                  periodFilter === "7d"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                7 Dias
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter("mes")}
                className={`rounded-lg px-2.5 py-1 transition ${
                  periodFilter === "mes"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mês Atual
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter("30d")}
                className={`rounded-lg px-2.5 py-1 transition ${
                  periodFilter === "30d"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                30 Dias
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter("ano")}
                className={`rounded-lg px-2.5 py-1 transition ${
                  periodFilter === "ano"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Ano 2026
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter("custom")}
                className={`rounded-lg px-2.5 py-1 transition ${
                  periodFilter === "custom"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Personalizado
              </button>
            </div>

            {/* Inputs de Data Personalizada */}
            {periodFilter === "custom" && (
              <div className="flex items-center gap-1.5 text-xs bg-muted/40 p-1.5 rounded-xl border border-border/60">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-border/60 bg-background px-2 py-1 text-xs text-foreground focus:outline-hidden"
                />
                <span className="text-muted-foreground">até</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-border/60 bg-background px-2 py-1 text-xs text-foreground focus:outline-hidden"
                />
              </div>
            )}

            {/* Filtro de Unidade */}
            <div className="flex items-center gap-1.5 ml-auto text-xs">
              <span className="text-muted-foreground font-semibold flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> Unidade:
              </span>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="rounded-xl border border-border/60 bg-background px-2.5 py-1 text-xs font-medium text-foreground focus:outline-hidden"
              >
                <option value="todas">Todas as Unidades</option>
                <option value="wenceslau">Sede Wenceslau Braz</option>
                <option value="londrina">Filial Londrina</option>
                <option value="ponta grossa">Filial Ponta Grossa</option>
                <option value="representantes">Representantes</option>
              </select>
            </div>
          </div>
        </div>

        {/* MODO EXECUTIVO COMPLETO */}
        {isExecutive ? (
          <>
            {/* 4 Cards Principais de Indicadores (KPIs Globais Proporcionais ao Período) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Card 1: Prospecção & Leads */}
              <div
                onClick={() => setActiveTab("leads")}
                className="group rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md block relative overflow-hidden cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Leads ({periodLabel})
                  </span>
                  <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <Zap className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                    {s ? s.leadsTotal.toLocaleString("pt-BR") : "—"}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2.5">
                  <div className="flex justify-between">
                    <span>Prospecção PAP:</span>
                    <span className="font-semibold text-foreground">
                      {s?.leadsProspeccao ?? 0} leads
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tráfego Pago (Meta):</span>
                    <span className="font-semibold text-foreground">
                      {s?.leadsTrafego ?? 0} leads
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quiz Solar LZ7:</span>
                    <span className="font-semibold text-foreground">{s?.leadsQuiz ?? 0} leads</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-xs font-semibold text-primary group-hover:underline">
                  Ver Fila de Leads <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                </div>
              </div>

              {/* Card 2: Tráfego Pago & Meta Ads */}
              <div
                onClick={() => setActiveTab("campanhas")}
                className="group rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md block relative overflow-hidden cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Tráfego Pago ({periodLabel})
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
                    <span>Leads de Anúncios:</span>
                    <span className="font-semibold text-foreground">{s?.metaLeads ?? 0} leads</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Custo por Lead (CPL):</span>
                    <span className="font-semibold text-foreground">
                      {s ? brl(s.metaCpl) : "R$ 3,84"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Conversão em Venda:</span>
                    <span className="font-semibold text-emerald-600 font-bold">2,6% real</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-xs font-semibold text-primary group-hover:underline">
                  Ver Campanhas Ativas <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                </div>
              </div>

              {/* Card 3: Vendas Ganhas (Ploomes) */}
              <div
                onClick={() => setActiveTab("fichas")}
                className="group rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md block relative overflow-hidden cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Vendas ({periodLabel})
                  </span>
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <Trophy className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {s ? brlShort(s.vendasPeriodoValor) : "—"}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2.5">
                  <div className="flex justify-between">
                    <span>Contratos no Período:</span>
                    <span className="font-semibold text-foreground">
                      {s?.vendasPeriodoQtd ?? 0} contratos
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
                  Ver Ficha dos 17 Consultores <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                </div>
              </div>

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
                      ? brlShort(periodFilter === "ano" ? s.faturadoAnoValor : s.faturadoMesValor)
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
                    <span className="font-semibold text-emerald-600 font-bold">
                      Ritmo acelerado
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-xs font-semibold text-muted-foreground">
                  Sincronizado com Instalações
                </div>
              </div>
            </div>

            {/* Abas Executivas para Visão 360 Graus */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-2">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("geral")}
                  className={`rounded-xl px-3.5 py-2 transition whitespace-nowrap ${
                    activeTab === "geral"
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  📊 Visão Geral & Gráficos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("fichas")}
                  className={`rounded-xl px-3.5 py-2 transition whitespace-nowrap ${
                    activeTab === "fichas"
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  👥 17 Consultores ({filteredSellers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("campanhas")}
                  className={`rounded-xl px-3.5 py-2 transition whitespace-nowrap ${
                    activeTab === "campanhas"
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🎯 Tráfego Meta Ads ({campanhas.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("leads")}
                  className={`rounded-xl px-3.5 py-2 transition whitespace-nowrap ${
                    activeTab === "leads"
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ⚡ Fila de Leads ({filteredLeads.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("supervisao")}
                  className={`rounded-xl px-3.5 py-2 transition whitespace-nowrap ${
                    activeTab === "supervisao"
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🚨 Radar DISC ({alerts.length})
                </button>
              </div>

              {/* Campo de Busca Rápida */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar vendedor, lead, cidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8.5 pl-8 text-xs rounded-xl bg-card border-border/60"
                />
              </div>
            </div>

            {/* Conteúdo da Aba 1: Geral & Gráficos */}
            {activeTab === "geral" && (
              <>
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
                        Total R$ {brlShort(s?.vendasAnoValor ?? 10881672)}
                      </Badge>
                    </div>
                    <div className="h-64 sm:h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={monthly}
                          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                        >
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
                          Faturamento por Unidade ({periodLabel})
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
                          <Bar
                            dataKey="valor"
                            fill="#3b82f6"
                            radius={[0, 6, 6, 0]}
                            name="Valor (R$)"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Tabela de Origens e Conversão Real */}
                  <Card className="p-4 sm:p-5 border-border/60 shadow-xs lg:col-span-1">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-display text-sm sm:text-base font-bold text-foreground">
                          Funil por Origem ({periodLabel})
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Taxa de conversão histórica real
                        </p>
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
                      <button
                        type="button"
                        onClick={() => setActiveTab("leads")}
                        className="text-xs font-semibold text-primary hover:underline flex items-center"
                      >
                        Ver Todos ({filteredLeads.length}){" "}
                        <ArrowUpRight className="h-3.5 w-3.5 ml-0.5" />
                      </button>
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
                        <tbody className="divide-y border-border/40">
                          {filteredLeads.slice(0, 6).map((l) => (
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </>
            )}

            {/* Conteúdo da Aba 2: Fichas dos 17 Consultores */}
            {activeTab === "fichas" && (
              <div className="space-y-4">
                <Card className="p-4 sm:p-5 border-border/60 shadow-xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-display text-base font-bold text-foreground">
                        Ficha Executiva dos 17 Consultores Comerciais
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Vendas no ano, média móvel de 6 meses, propostas na mesa e perfil
                        comportamental DISC
                      </p>
                    </div>
                    <Link to="/ranking">
                      <Button size="sm" variant="outline" className="rounded-xl">
                        Ver Ranking de Vendas <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                          <th className="pb-2">Consultor</th>
                          <th className="pb-2">Unidade</th>
                          <th className="pb-2">Vendas Ano</th>
                          <th className="pb-2">Total Faturado</th>
                          <th className="pb-2">Mês Atual</th>
                          <th className="pb-2">Média 6M</th>
                          <th className="pb-2">Na Mesa</th>
                          <th className="pb-2">Tarefas Venc.</th>
                          <th className="pb-2 text-right">DISC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {filteredSellers.map((v) => (
                          <tr key={v.nome} className="hover:bg-muted/40 transition">
                            <td className="py-3 font-bold text-foreground">
                              {v.nome}
                              {v.severidade === "crit" && (
                                <span
                                  className="ml-1.5 inline-block h-2 w-2 rounded-full bg-red-500"
                                  title="Ação urgente necessária"
                                />
                              )}
                            </td>
                            <td className="py-3 text-muted-foreground">{v.unidade}</td>
                            <td className="py-3 font-bold text-foreground">{v.anoVendas}</td>
                            <td className="py-3 font-semibold text-emerald-600">
                              {brlShort(v.anoValor)}
                            </td>
                            <td className="py-3 font-medium">{v.mesAtualVendas}</td>
                            <td className="py-3 text-muted-foreground">
                              {v.media6Meses.toFixed(1)}
                            </td>
                            <td className="py-3 font-semibold text-amber-600">
                              {v.valorNegociacao > 0 ? brlShort(v.valorNegociacao) : "—"}
                            </td>
                            <td className="py-3 font-medium text-foreground">
                              <span
                                className={
                                  v.tarefasVencidas >= 40
                                    ? "text-red-600 font-bold"
                                    : "text-muted-foreground"
                                }
                              >
                                {v.tarefasVencidas}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              {v.discPerfil ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-bold text-primary"
                                >
                                  {v.discPerfil}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* Conteúdo da Aba 3: Campanhas Meta Ads */}
            {activeTab === "campanhas" && (
              <div className="space-y-4">
                <Card className="p-4 sm:p-5 border-border/60 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-display text-base font-bold text-foreground">
                        Performance de Campanhas de Tráfego Pago ({periodLabel})
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Investimento, custo por lead (CPL) e taxa de conversão em vendas por região
                      </p>
                    </div>
                    <Link to="/mod/marketing">
                      <Button size="sm" variant="outline" className="rounded-xl">
                        Ver Hub de Marketing <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                          <th className="pb-2">Campanha</th>
                          <th className="pb-2">Região</th>
                          <th className="pb-2">Investimento</th>
                          <th className="pb-2">Leads</th>
                          <th className="pb-2">CPL Médio</th>
                          <th className="pb-2">Vendas Ganhas</th>
                          <th className="pb-2 text-right">Conversão</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {campanhas.map((c) => (
                          <tr key={c.nome} className="hover:bg-muted/40 transition">
                            <td className="py-3 font-bold text-foreground">{c.nome}</td>
                            <td className="py-3 text-muted-foreground">{c.regiao}</td>
                            <td className="py-3 font-medium">{brl(c.gasto)}</td>
                            <td className="py-3 font-semibold">{c.leads}</td>
                            <td className="py-3 text-blue-600 font-bold">{brl(c.cpl)}</td>
                            <td className="py-3 font-semibold text-emerald-600">
                              {c.vendas} vendas
                            </td>
                            <td className="py-3 text-right font-bold text-emerald-600">
                              {c.conversao.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* Conteúdo da Aba 4: Fila Total de Leads */}
            {activeTab === "leads" && (
              <div className="space-y-4">
                <Card className="p-4 sm:p-5 border-border/60 shadow-xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-display text-base font-bold text-foreground">
                        Fila Completa de Leads & Prospecção
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Exibindo todos os leads qualificados, quiz e tráfego pago (
                        {filteredLeads.length} leads)
                      </p>
                    </div>
                    <Link to="/crm">
                      <Button size="sm" variant="default" className="rounded-xl">
                        Abrir Kanban do CRM <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                          <th className="pb-2">Nome do Lead</th>
                          <th className="pb-2">Origem</th>
                          <th className="pb-2">Cidade</th>
                          <th className="pb-2">Etapa</th>
                          <th className="pb-2">Responsável</th>
                          <th className="pb-2">Data Entrada</th>
                          <th className="pb-2 text-right">Contato</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {filteredLeads.map((l) => (
                          <tr key={l.id} className="hover:bg-muted/40 transition">
                            <td className="py-3 font-bold text-foreground">{l.nome}</td>
                            <td className="py-3">
                              <Badge variant="outline" className="text-[10px]">
                                {l.origem}
                              </Badge>
                            </td>
                            <td className="py-3 text-muted-foreground">{l.cidade || "—"}</td>
                            <td className="py-3">
                              <span className="capitalize text-foreground font-medium">
                                {l.stage}
                              </span>
                            </td>
                            <td className="py-3 font-medium text-foreground">
                              {l.assigned_name || (
                                <span className="text-muted-foreground">Fila Geral</span>
                              )}
                            </td>
                            <td className="py-3 text-muted-foreground">
                              {new Date(l.created_at).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="py-3 text-right">
                              {l.telefone ? (
                                <a
                                  href={`https://wa.me/55${l.telefone.replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline bg-emerald-500/10 px-2.5 py-1 rounded-lg"
                                >
                                  <PhoneCall className="h-3 w-3" /> WhatsApp
                                </a>
                              ) : (
                                <Link to="/crm" className="text-[11px] font-semibold text-primary">
                                  Ver Lead
                                </Link>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* Conteúdo da Aba 5: Radar Supervisão DISC */}
            {activeTab === "supervisao" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {alerts.map((al, idx) => (
                    <Card
                      key={idx}
                      className="p-4 border-border/60 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-foreground">{al.vendedor}</span>
                          <Badge
                            variant={al.severidade === "crit" ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {al.severidade === "crit" ? "Ação Urgente" : "Atenção"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {al.unidade} · Perfil {al.discPerfil || "Não aplicado"}
                        </div>
                        <div className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                          {al.titulo}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {al.detalhe}
                        </p>
                      </div>

                      {al.acaoSugerida && (
                        <div className="mt-3 rounded-xl bg-secondary/30 p-2.5 text-xs border border-border/40">
                          <span className="font-bold text-foreground">
                            O que fazer (ajustado ao perfil):{" "}
                          </span>
                          <span className="text-muted-foreground">{al.acaoSugerida}</span>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* MODO CONSULTOR (VISÃO PESSOAL & FOCO EM EXECUÇÃO) */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="p-4 border-border/60 shadow-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Meus Leads em Atendimento
                </div>
                <div className="mt-2 font-display text-3xl font-bold text-foreground">
                  {userPersonal?.assignedLeads ?? 0}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Leads ativos na sua carteira de vendas
                </div>
              </Card>

              <Card className="p-4 border-border/60 shadow-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Minhas Vendas Ganhas (Ano)
                </div>
                <div className="mt-2 font-display text-3xl font-bold text-emerald-600">
                  {userPersonal?.myWonSalesYear ?? 0}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Faturado acumulado: {brlShort(userPersonal?.myWonValueYear)}
                </div>
              </Card>

              <Card className="p-4 border-border/60 shadow-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Na Minha Mesa (Negociação)
                </div>
                <div className="mt-2 font-display text-3xl font-bold text-amber-600">
                  {brlShort(userPersonal?.myNegotiationValue)}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Propostas em negociação ativa
                </div>
              </Card>
            </div>

            {/* Leads para Atendimento Imediato */}
            <Card className="p-4 sm:p-5 border-border/60 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-sm sm:text-base font-bold text-foreground">
                    Fila de Leads para Contato
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Novos leads quentes que acabaram de entrar
                  </p>
                </div>
                <Link
                  to="/crm"
                  className="text-xs font-semibold text-primary hover:underline flex items-center"
                >
                  Abrir Meu CRM <ArrowUpRight className="h-3.5 w-3.5 ml-0.5" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                      <th className="pb-2">Lead</th>
                      <th className="pb-2">Origem</th>
                      <th className="pb-2">Cidade</th>
                      <th className="pb-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-border/40">
                    {recentLeads.slice(0, 5).map((l) => (
                      <tr key={l.id} className="hover:bg-muted/40 transition">
                        <td className="py-2.5 font-bold text-foreground">{l.nome}</td>
                        <td className="py-2.5">
                          <Badge variant="outline" className="text-[10px]">
                            {l.origem}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-muted-foreground">{l.cidade || "—"}</td>
                        <td className="py-2.5 text-right">
                          {l.telefone ? (
                            <a
                              href={`https://wa.me/55${l.telefone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline bg-emerald-500/10 px-2.5 py-1 rounded-lg"
                            >
                              <PhoneCall className="h-3 w-3" /> Chamar
                            </a>
                          ) : (
                            <Link to="/crm" className="text-[11px] font-semibold text-primary">
                              Ver Detalhes
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 text-xs text-muted-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                Relatórios globais, faturamento consolidado de filiais e controle de tráfego pago
                são visíveis apenas para a <b>Coordenação e Diretoria</b>.
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
