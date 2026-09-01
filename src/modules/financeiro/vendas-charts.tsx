import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { FinanceSale } from "./vendas.functions";

const brlShort = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(0)}k` : n.toFixed(0));
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const PIE_COLORS = [
  "var(--color-chart-1, oklch(0.72 0.16 60))",
  "var(--color-chart-2, oklch(0.65 0.15 200))",
  "var(--color-chart-3, oklch(0.6 0.14 300))",
  "var(--color-chart-4, oklch(0.7 0.15 145))",
  "var(--color-chart-5, oklch(0.62 0.16 25))",
];

function group(rows: FinanceSale[], key: (r: FinanceSale) => string) {
  const map = new Map<string, { name: string; total: number; recebido: number; count: number }>();
  for (const r of rows) {
    const k = key(r) || "—";
    const cur = map.get(k) ?? { name: k, total: 0, recebido: 0, count: 0 };
    cur.total += r.valor;
    cur.recebido += r.recebido;
    cur.count += 1;
    map.set(k, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function VendasCharts({ rows }: { rows: FinanceSale[] }) {
  const porVendedor = group(rows, (r) => r.vendedor).slice(0, 10);
  const porMetodo = group(rows, (r) => r.metodo_pagamento ?? "—");
  const porCidade = group(rows, (r) => r.cidade ?? "—").slice(0, 8);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ChartCard title="Vendas por vendedor" hint="Valor total contratado (top 10)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={porVendedor} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={70}
            />
            <YAxis tickFormatter={brlShort} tick={{ fontSize: 10 }} width={40} />
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Bar
              dataKey="total"
              name="Contratado"
              fill="var(--color-primary, #f59e0b)"
              radius={[6, 6, 0, 0]}
            />
            <Bar
              dataKey="recebido"
              name="Recebido"
              fill="oklch(0.68 0.14 150)"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Método de pagamento" hint="Distribuição do valor contratado">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={porMetodo}
              dataKey="total"
              nameKey="name"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
            >
              {porMetodo.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Concentração por cidade"
        hint="Top 8 cidades por valor"
        className="lg:col-span-2"
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={porCidade} layout="vertical" margin={{ left: 40, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
            <XAxis type="number" tickFormatter={brlShort} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Bar
              dataKey="total"
              name="Contratado"
              fill="var(--color-primary, #f59e0b)"
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-border/60 bg-card p-4 shadow-sm ${className ?? ""}`}>
      <div className="mb-3">
        <h3 className="font-display text-sm font-semibold">{title}</h3>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
