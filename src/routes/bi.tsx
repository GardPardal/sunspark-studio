import { createFileRoute } from "@tanstack/react-router";
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Loader2, Printer, RefreshCw, TrendingUp } from "lucide-react";

import { getPublicFunnel } from "@/lib/public-bi.functions";

export const Route = createFileRoute("/bi")({
  head: () => ({
    meta: [
      { title: "BI Comercial · Funil de Energia Solar · LZ7" },
      {
        name: "description",
        content:
          "Painel público do funil comercial da LZ7 Energia: leads, apresentações, negociações e vendas faturadas em tempo real.",
      },
      { property: "og:title", content: "BI Comercial · Funil de Energia Solar · LZ7" },
      {
        property: "og:description",
        content: "Leads, apresentações, negociações e vendas por período, direto do CRM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PublicBi,
});

const ORIGENS = [
  { id: 0, label: "Todas as origens" },
  { id: 600965618, label: "Tráfego pago" },
  { id: 600965616, label: "Prospecção" },
  { id: 600965617, label: "Indicação" },
  { id: 600965619, label: "Ação comercial" },
  { id: 600965620, label: "Feira" },
  { id: 601325073, label: "Reativação" },
  { id: 601332767, label: "Aumento de sistema" },
  { id: 609758031, label: "Ligação ativa" },
];

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (n: number) => n.toLocaleString("pt-BR");
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function monthRange(offset = 0) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const f = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { from: f(d), to: f(end) };
}

function PublicBi() {
  const init = monthRange(-1);
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [origem, setOrigem] = useState(0);
  const [tab, setTab] = useState<"funil" | "faturadas">("funil");

  const fetchFunnel = useServerFn(getPublicFunnel);

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["public-funnel", from, to, origem],
    queryFn: () => fetchFunnel({ data: { from, to, origemId: origem || null } }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 120_000,
  });


  const steps = useMemo(() => {
    if (!data) return [];
    const max = Math.max(data.leads, 1);
    return [
      { label: "Novos leads", value: data.leads, rate: null as string | null },
      { label: "Apresentações", value: data.apresentacoes, rate: pct(data.taxaApresentacao) },
      { label: "Negociações", value: data.negociacoes, rate: pct(data.taxaNegociacao) },
      { label: "Vendas efetuadas", value: data.vendas, rate: pct(data.taxaFechamento) },
    ].map((s) => ({ ...s, width: Math.max(6, (s.value / max) * 100) }));
  }, [data]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 print:max-w-none print:px-0">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              LZ7 Energia · Comercial
            </p>
            <h1 className="mt-1 flex items-center gap-2 font-[Sora,sans-serif] text-2xl font-semibold tracking-tight">
              <TrendingUp className="h-6 w-6 text-primary" />
              Funil de Energia Solar
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dados ao vivo do CRM — mesma leitura do relatório da diretoria.
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? "Atualizando…" : "Atualizar"}
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              <Printer className="h-4 w-4" /> Exportar PDF
            </button>
          </div>
        </header>


        <div className="mb-5 flex flex-wrap items-end gap-2 print:hidden">
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">De</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">Até</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
              Origem do lead
            </span>
            <select
              value={origem}
              onChange={(e) => setOrigem(Number(e.target.value))}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            >
              {ORIGENS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {[
            { l: "Mês passado", r: monthRange(-1) },
            { l: "Mês atual", r: monthRange(0) },
          ].map((b) => (
            <button
              key={b.l}
              onClick={() => {
                setFrom(b.r.from);
                setTo(b.r.to);
              }}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-medium"
            >
              {b.l}
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
            Não foi possível carregar os dados do CRM agora. {(error as Error).message}
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando indicadores…
          </div>
        ) : (
          <div className={isFetching ? "opacity-60 transition" : "transition"}>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Kpi label="Novos leads" value={num(data.leads)} />
              <Kpi label="Vendas efetuadas" value={num(data.vendas)} />
              <Kpi label="Faturamento" value={brl(data.faturamento)} />
              <Kpi label="Ticket médio" value={brl(data.ticketMedio)} />
              <Kpi label="Faturadas (financeiro)" value={num(data.faturadas)} />
            </div>

            <div className="mb-4 inline-flex rounded-xl border border-border bg-card p-1 print:hidden">
              {(
                [
                  { id: "funil" as const, label: "Funil" },
                  { id: "faturadas" as const, label: `Faturadas (${data.faturadas})` },
                ]
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`h-9 rounded-lg px-4 text-sm font-medium transition ${
                    tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "funil" && (
              <>
            <section className="mb-4 rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 font-[Sora,sans-serif] text-sm font-semibold">Funil do período</h2>
              <div className="space-y-2">
                {steps.map((s) => (
                  <div key={s.label}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-medium">{s.label}</span>
                      <span className="tabular-nums">
                        {num(s.value)}
                        {s.rate && (
                          <span className="ml-2 text-xs text-muted-foreground">{s.rate} da etapa anterior</span>
                        )}
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${s.width}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Conversão geral lead → venda: <strong>{pct(data.taxaGeral)}</strong>
              </p>
            </section>

            {data.porOrigem.length > 0 && (
              <section className="mb-4 rounded-2xl border border-border bg-card p-4">
                <h2 className="mb-3 font-[Sora,sans-serif] text-sm font-semibold">Por origem do lead</h2>
                <Table
                  head={["Origem", "Leads", "Vendas", "Faturamento", "Conversão"]}
                  rows={data.porOrigem.map((o) => [
                    o.origem,
                    num(o.leads),
                    num(o.vendas),
                    brl(o.valor),
                    pct(o.leads ? (o.vendas / o.leads) * 100 : 0),
                  ])}
                />
              </section>
            )}

            {data.vendasDetalhe.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-4">
                <h2 className="mb-3 font-[Sora,sans-serif] text-sm font-semibold">
                  Vendas ganhas no período ({data.vendasDetalhe.length})
                </h2>
                <Table
                  head={["Cliente", "Responsável", "Origem", "Data", "Valor"]}
                  rows={data.vendasDetalhe.map((v) => [
                    <span className="flex items-center gap-1.5">
                      {v.faturada && (
                        <span
                          title={`Faturada em ${v.faturadoEm ? new Date(v.faturadoEm).toLocaleDateString("pt-BR") : "—"}`}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                        >
                          <BadgeCheck className="h-3 w-3" /> Faturada
                        </span>
                      )}
                      <span>{v.title}</span>
                    </span>,
                    v.ownerName ?? "—",
                    v.origem ?? "—",
                    new Date(v.finishDate).toLocaleDateString("pt-BR"),
                    brl(v.amount),
                  ])}
                />
              </section>
            )}
              </>
            )}

            {tab === "faturadas" && (
              <section className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-[Sora,sans-serif] text-sm font-semibold">
                    Faturadas no período ({data.faturadas})
                  </h2>
                  <span className="text-sm font-semibold tabular-nums text-primary">
                    {brl(data.faturadoValor)}
                  </span>
                </div>
                {data.faturadasDetalhe.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum contrato faturado no período selecionado.
                  </p>
                ) : (
                  <Table
                    head={["Contrato", "Responsável", "Origem", "Faturado em", "Valor"]}
                    rows={data.faturadasDetalhe.map((v) => [
                      v.title,
                      v.ownerName ?? "—",
                      v.origem ?? "—",
                      new Date(v.finishDate).toLocaleDateString("pt-BR"),
                      brl(v.amount),
                    ])}
                  />
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Faturamento = negócios ganhos no funil Financeiro do CRM, pela data de conclusão.
                </p>
              </section>
            )}


            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Atualizado em {new Date(data.geradoEm).toLocaleString("pt-BR")} · LZ7 Energia
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-[Sora,sans-serif] text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="py-1.5 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/60">
              {r.map((c, j) => (
                <td key={j} className={`py-1.5 pr-3 ${j > 0 ? "tabular-nums" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
