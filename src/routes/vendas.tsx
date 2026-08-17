import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BackendTopBar } from "@/components/backend-shell";
import { VendasCharts } from "@/modules/financeiro/vendas-charts";
import {
  listFinanceSales,
  upsertFinanceSale,
  deleteFinanceSale,
  type FinanceSale,
} from "@/modules/financeiro/vendas.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Download, Search, Wallet } from "lucide-react";

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas & Faturamento — Controle interno" },
      { name: "description", content: "Cadastro e controle interno das vendas faturadas, recebimentos e método de pagamento da LZ7 Energia." },
      { property: "og:title", content: "Vendas & Faturamento — Controle interno" },
      { property: "og:description", content: "Vendas, faturamento, recebido e a receber em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: VendasPage,
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

type FormState = {
  id?: string;
  vendedor: string;
  projeto: string;
  cidade: string;
  metodo_pagamento: string;
  valor: string;
  faturado: boolean;
  recebido: string;
  a_receber: string;
  previsto: string;
  faturado_em: string;
  observacoes: string;
};

const emptyForm: FormState = {
  vendedor: "", projeto: "", cidade: "", metodo_pagamento: "", valor: "",
  faturado: false, recebido: "", a_receber: "", previsto: "", faturado_em: "", observacoes: "",
};

function VendasPage() {
  const qc = useQueryClient();
  const list = useServerFn(listFinanceSales);
  const upsert = useServerFn(upsertFinanceSale);
  const remove = useServerFn(deleteFinanceSale);

  const [q, setQ] = useState("");
  const [onlyFaturado, setOnlyFaturado] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const query = useQuery<FinanceSale[]>({
    queryKey: ["finance_sales"],
    queryFn: () => list() as any,
  });

  const rows = useMemo(() => {
    const all = query.data ?? [];
    const term = q.trim().toLowerCase();
    return all.filter((r) => {
      if (onlyFaturado && !r.faturado) return false;
      if (!term) return true;
      return [r.vendedor, r.projeto, r.cidade, r.metodo_pagamento]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [query.data, q, onlyFaturado]);

  const kpis = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.valor, 0);
    const recebido = rows.reduce((s, r) => s + r.recebido, 0);
    const aReceber = rows.reduce((s, r) => s + r.a_receber, 0);
    const faturados = rows.filter((r) => r.faturado);
    return {
      total,
      recebido,
      aReceber,
      count: rows.length,
      faturadoCount: faturados.length,
      faturadoValor: faturados.reduce((s, r) => s + r.valor, 0),
      ticket: rows.length ? total / rows.length : 0,
      pctRecebido: total > 0 ? (recebido / total) * 100 : 0,
    };
  }, [rows]);

  const save = useMutation({
    mutationFn: async () => {
      const values = {
        vendedor: form.vendedor.trim(),
        projeto: form.projeto.trim(),
        cidade: form.cidade.trim() || null,
        metodo_pagamento: form.metodo_pagamento.trim() || null,
        valor: Number(form.valor) || 0,
        faturado: form.faturado,
        recebido: Number(form.recebido) || 0,
        a_receber: Number(form.a_receber) || 0,
        previsto: form.previsto.trim() || null,
        faturado_em: form.faturado_em || null,
        observacoes: form.observacoes.trim() || null,
      };
      return upsert({ data: form.id ? { id: form.id, values } : { values } });
    },
    onSuccess: () => {
      toast.success(form.id ? "Venda atualizada" : "Venda registrada");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["finance_sales"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }) as any,
    onSuccess: () => {
      toast.success("Venda excluída");
      qc.invalidateQueries({ queryKey: ["finance_sales"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  const openNew = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (r: FinanceSale) => {
    setForm({
      id: r.id,
      vendedor: r.vendedor,
      projeto: r.projeto,
      cidade: r.cidade ?? "",
      metodo_pagamento: r.metodo_pagamento ?? "",
      valor: String(r.valor),
      faturado: r.faturado,
      recebido: String(r.recebido),
      a_receber: String(r.a_receber),
      previsto: r.previsto ?? "",
      faturado_em: r.faturado_em ?? "",
      observacoes: r.observacoes ?? "",
    });
    setOpen(true);
  };

  const exportCsv = () => {
    const head = ["VENDEDOR", "PROJETO", "CIDADE", "PAGAMENTO", "VALOR", "FATURADO", "RECEBIDO", "A RECEBER", "PREVISTO"];
    const lines = rows.map((r) =>
      [r.vendedor, r.projeto, r.cidade ?? "", r.metodo_pagamento ?? "", r.valor, r.faturado ? "SIM" : "NAO", r.recebido, r.a_receber, r.previsto ?? ""]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vendas-faturamento-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-h-screen bg-secondary/30 pb-24">
      <BackendTopBar title="Vendas & Faturamento" subtitle="Controle interno — fonte da verdade" />
      <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Contratado" value={brl(kpis.total)} hint={`${kpis.count} vendas`} tone="primary" />
          <Kpi label="Recebido" value={brl(kpis.recebido)} hint={`${kpis.pctRecebido.toFixed(1)}% do contratado`} tone="emerald" />
          <Kpi label="A receber" value={brl(kpis.aReceber)} hint="Saldo em aberto" tone="amber" />
          <Kpi label="Faturados" value={`${kpis.faturadoCount}`} hint={brl(kpis.faturadoValor)} />
        </div>

        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar vendedor, projeto, cidade ou pagamento" className="pl-9" />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Switch checked={onlyFaturado} onCheckedChange={setOnlyFaturado} />
              Somente faturados
            </label>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-1.5 h-4 w-4" />CSV</Button>
            <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />Nova venda</Button>
          </div>
        </Card>

        {query.isLoading && <Card className="p-5 text-sm text-muted-foreground">Carregando vendas…</Card>}
        {query.error && <Card className="p-5 text-sm text-destructive">Erro: {(query.error as Error).message}</Card>}

        {query.data && rows.length > 0 && <VendasCharts rows={rows} />}

        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <Wallet className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-semibold">Carteira de vendas</h3>
            <span className="text-xs text-muted-foreground">{rows.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Vendedor</th>
                  <th className="px-3 py-2 text-left">Projeto</th>
                  <th className="px-3 py-2 text-left">Cidade</th>
                  <th className="px-3 py-2 text-left">Pagamento</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-center">Fat.</th>
                  <th className="px-3 py-2 text-right">Recebido</th>
                  <th className="px-3 py-2 text-right">A receber</th>
                  <th className="px-3 py-2 text-left">Previsto</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !query.isLoading && (
                  <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Nenhuma venda encontrada.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-t align-top hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{r.vendedor}</td>
                    <td className="max-w-[280px] px-3 py-2 text-xs text-muted-foreground">{r.projeto}</td>
                    <td className="px-3 py-2 text-xs">{r.cidade ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.metodo_pagamento ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold">{brl(r.valor)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.faturado ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {r.faturado ? "SIM" : "NÃO"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-700">{brl(r.recebido)}</td>
                    <td className="px-3 py-2 text-right text-amber-700">{brl(r.a_receber)}</td>
                    <td className="px-3 py-2 text-xs">{r.previsto ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} aria-label="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => { if (confirm("Excluir esta venda?")) del.mutate(r.id); }}
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar venda" : "Nova venda"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vendedor" className="sm:col-span-2">
              <Input value={form.vendedor} onChange={(e) => setForm({ ...form, vendedor: e.target.value })} />
            </Field>
            <Field label="Projeto" className="sm:col-span-2">
              <Input value={form.projeto} onChange={(e) => setForm({ ...form, projeto: e.target.value })} placeholder="WB260360COL - NOME (13.2 KWp)" />
            </Field>
            <Field label="Cidade">
              <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </Field>
            <Field label="Método de pagamento">
              <Input value={form.metodo_pagamento} onChange={(e) => setForm({ ...form, metodo_pagamento: e.target.value })} placeholder="SOLFACIL, RECURSO PROPRIO…" list="metodos" />
              <datalist id="metodos">
                {["SOLFACIL", "RECURSO PROPRIO", "REFORMA BRASIL", "LEASING", "BV", "SANTANDER"].map((m) => <option key={m} value={m} />)}
              </datalist>
            </Field>
            <Field label="Valor (R$)">
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            </Field>
            <Field label="Recebido (R$)">
              <Input type="number" step="0.01" value={form.recebido} onChange={(e) => setForm({ ...form, recebido: e.target.value })} />
            </Field>
            <Field label="A receber (R$)">
              <Input type="number" step="0.01" value={form.a_receber} onChange={(e) => setForm({ ...form, a_receber: e.target.value })} />
            </Field>
            <Field label="Previsto (mês)">
              <Input value={form.previsto} onChange={(e) => setForm({ ...form, previsto: e.target.value })} placeholder="AGOSTO" />
            </Field>
            <Field label="Data de faturamento">
              <Input type="date" value={form.faturado_em} onChange={(e) => setForm({ ...form, faturado_em: e.target.value })} />
            </Field>
            <Field label="Faturado">
              <div className="flex h-9 items-center">
                <Switch checked={form.faturado} onCheckedChange={(v) => setForm({ ...form, faturado: v })} />
              </div>
            </Field>
            <Field label="Observações" className="sm:col-span-2">
              <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.vendedor || !form.projeto}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "primary" | "emerald" | "amber" }) {
  const cls = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : tone === "primary" ? "text-primary" : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-xl font-semibold ${cls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}
