import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ModuleShell } from "@/modules/shared/module-shell";
import { getFinanceKpis, type FinKpis } from "@/modules/financeiro/kpis.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/mod/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — ROI, CAC, Margem" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FinModule,
});

const brl = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const unitLabel = (u: string) =>
  u === "londrina"
    ? "Londrina"
    : u === "ponta_grossa"
      ? "Ponta Grossa"
      : u === "wenceslau_braz"
        ? "Wenceslau Braz"
        : u;

function FinModule() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayISO());
  const [margem, setMargem] = useState(25);
  const fn = useServerFn(getFinanceKpis);
  const q = useQuery<FinKpis>({
    queryKey: ["mod_fin", from, to, margem],
    queryFn: () => fn({ data: { from, to, margemPct: margem } }) as any,
  });

  return (
    <ModuleShell title="Financeiro" subtitle="Receita, CAC, ROAS e margem" active="financeiro">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">De</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Até</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Margem estimada (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={margem}
              onChange={(e) => setMargem(Number(e.target.value) || 0)}
              className="w-28"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFrom(firstOfMonth());
              setTo(todayISO());
            }}
          >
            Mês atual
          </Button>
        </div>
      </Card>

      {q.isLoading && <Card className="p-5">Carregando…</Card>}
      {q.error && (
        <Card className="p-5 text-red-600 text-sm">Erro: {(q.error as Error).message}</Card>
      )}

      {q.data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Receita" value={brl(q.data.receita)} tone="emerald" />
            <Kpi label="Vendas" value={q.data.vendas} />
            <Kpi label="Ticket médio" value={brl(q.data.ticket_medio)} />
            <Kpi label="Gasto Ads" value={brl(q.data.gasto_ads)} />
            <Kpi label="CAC" value={brl(q.data.cac)} tone="amber" />
            <Kpi
              label="ROAS"
              value={q.data.roas != null ? `${q.data.roas.toFixed(2)}x` : "—"}
              tone="emerald"
            />
            <Kpi
              label={`Margem est. (${q.data.margem_pct}%)`}
              value={brl(q.data.margem_estimada_brl)}
              tone="emerald"
            />
            <Kpi label="LTV (=ticket)" value={brl(q.data.ltv_estimado)} />
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Receita por unidade</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Unidade</th>
                    <th className="text-right px-3 py-2">Vendas</th>
                    <th className="text-right px-3 py-2">Receita</th>
                    <th className="text-right px-3 py-2">Ticket médio</th>
                    <th className="text-right px-3 py-2">% do total</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.vendas_por_unidade.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        Sem vendas no período.
                      </td>
                    </tr>
                  )}
                  {q.data.vendas_por_unidade.map((u) => (
                    <tr key={u.unit} className="border-t">
                      <td className="px-3 py-2">{unitLabel(u.unit)}</td>
                      <td className="px-3 py-2 text-right">{u.count}</td>
                      <td className="px-3 py-2 text-right font-semibold">{brl(u.total)}</td>
                      <td className="px-3 py-2 text-right">
                        {brl(u.count > 0 ? u.total / u.count : null)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {q.data!.receita > 0
                          ? `${((u.total / q.data!.receita) * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4 text-xs text-muted-foreground">
            Receita combina vendas do CRM (leads em stage <b>venda</b>/<b>faturado</b>) e vendas
            manuais registradas. Gasto Ads vem de <b>meta_insights_daily</b>. Margem é estimativa —
            ajuste o percentual acima conforme sua realidade.
          </Card>
        </>
      )}
    </ModuleShell>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "emerald" | "amber";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${cls}`}>{value}</div>
    </Card>
  );
}
