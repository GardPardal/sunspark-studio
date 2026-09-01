import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Boxes,
  Check,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  listInventory,
  updateInventoryItem,
  createInventoryItem,
  deleteInventoryItem,
  importInventoryFromSheet,
  importInventoryCsv,
  CSV_HEADERS,
  type InventoryItem,
} from "@/lib/inventory.functions";

export const Route = createFileRoute("/inventario")({
  head: () => ({
    meta: [
      { title: "Inventário de Estoque · LZ7 Energia" },
      {
        name: "description",
        content:
          "Controle simples do estoque físico e do saldo de inventário da LZ7 Energia, com importação e exportação de planilha.",
      },
      { property: "og:title", content: "Inventário de Estoque · LZ7 Energia" },
      {
        property: "og:description",
        content: "Contagem de estoque físico, saldo de inventário e exportação de planilha padrão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: InventarioPage,
});

const brl = (n: number) =>
  `R$${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function buildCsv(items: InventoryItem[]) {
  const lines = [CSV_HEADERS.join(",")];
  for (const it of items) {
    lines.push(
      [
        it.codigo,
        it.descricao,
        it.saldo_inventario == null ? "" : String(it.saldo_inventario),
        String(it.saldo_fisico ?? 0),
        it.unidade ?? "",
        brl(Number(it.preco_venda ?? 0)),
        brl(Number(it.preco_compra ?? 0)),
        brl(Number(it.preco_compra_convertido ?? 0)),
        it.prateleira ?? "",
      ]
        .map((c) => csvCell(String(c)))
        .join(","),
    );
  }
  return lines.join("\n");
}

type Filter = "todos" | "divergentes" | "pendentes" | "zerados";

function InventarioPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listInventory);
  const doUpdate = useServerFn(updateInventoryItem);
  const doCreate = useServerFn(createInventoryItem);
  const doDelete = useServerFn(deleteInventoryItem);
  const doImportSheet = useServerFn(importInventoryFromSheet);
  const doImportCsv = useServerFn(importInventoryCsv);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [showNew, setShowNew] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["inventory"],
    queryFn: () => fetchList({}) as Promise<InventoryItem[]>,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["inventory"] });

  const update = useMutation({
    mutationFn: (v: { id: string; patch: Record<string, unknown> }) =>
      doUpdate({ data: v as never }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: (v: Record<string, unknown>) => doCreate({ data: v as never }),
    onSuccess: () => {
      toast.success("Item adicionado");
      setShowNew(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Item removido");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importSheet = useMutation({
    mutationFn: () => doImportSheet({}),
    onSuccess: (r: { saved: number }) => {
      toast.success(`${r.saved} itens sincronizados da planilha`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importCsv = useMutation({
    mutationFn: (csv: string) => doImportCsv({ data: { csv } }),
    onSuccess: (r: { saved: number }) => {
      toast.success(`${r.saved} itens carregados do arquivo`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((it) => {
      if (
        term &&
        !`${it.codigo} ${it.descricao} ${it.prateleira ?? ""}`.toLowerCase().includes(term)
      )
        return false;
      const inv = it.saldo_inventario;
      if (filter === "pendentes") return inv == null;
      if (filter === "divergentes") return inv != null && Number(inv) !== Number(it.saldo_fisico);
      if (filter === "zerados") return Number(it.saldo_fisico) === 0;
      return true;
    });
  }, [items, q, filter]);

  const stats = useMemo(() => {
    let contados = 0;
    let divergentes = 0;
    let valor = 0;
    for (const it of items) {
      if (it.saldo_inventario != null) contados++;
      if (it.saldo_inventario != null && Number(it.saldo_inventario) !== Number(it.saldo_fisico))
        divergentes++;
      valor += Number(it.saldo_fisico ?? 0) * Number(it.preco_compra_convertido ?? 0);
    }
    return { total: items.length, contados, divergentes, valor };
  }, [items]);

  function exportCsv() {
    const csv = buildCsv(items);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario-lz7-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Planilha exportada no padrão do sistema");
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const text = await f.text();
    importCsv.mutate(text);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-[Sora,sans-serif] text-2xl font-semibold tracking-tight">
              <Boxes className="h-6 w-6 text-primary" />
              Inventário
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Conte o estoque físico, registre o saldo de inventário e exporte no padrão da
              planilha.
            </p>
          </div>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Itens" value={String(stats.total)} />
        <StatCard label="Contados" value={`${stats.contados}/${stats.total}`} />
        <StatCard
          label="Divergências"
          value={String(stats.divergentes)}
          tone={stats.divergentes ? "warn" : "ok"}
        />
        <StatCard
          label="Valor em estoque"
          value={stats.valor.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 0,
          })}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código, descrição ou prateleira"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          <Download className="h-4 w-4" /> Exportar planilha
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importCsv.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium"
        >
          {importCsv.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Importar CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onPickFile} />
        <button
          onClick={() => importSheet.mutate()}
          disabled={importSheet.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium"
          title="Sincronizar com a planilha do Google"
        >
          {importSheet.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Planilha Google
        </button>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Item
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(["todos", "pendentes", "divergentes", "zerados"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {showNew && (
        <NewItemForm
          onCancel={() => setShowNew(false)}
          onSave={(v) => create.mutate(v)}
          busy={create.isPending}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando inventário…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum item encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              onPatch={(patch) => update.mutate({ id: it.id, patch })}
              onDelete={() => remove.mutate(it.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 font-[Sora,sans-serif] text-lg font-semibold ${
          tone === "warn" ? "text-destructive" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  onPatch,
  onDelete,
}: {
  item: InventoryItem;
  onPatch: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [fisico, setFisico] = useState(String(item.saldo_fisico ?? 0));
  const [inv, setInv] = useState(
    item.saldo_inventario == null ? "" : String(item.saldo_inventario),
  );

  const dirty =
    Number(fisico || 0) !== Number(item.saldo_fisico ?? 0) ||
    (inv === "" ? item.saldo_inventario != null : Number(inv) !== Number(item.saldo_inventario));

  const diff =
    item.saldo_inventario == null
      ? null
      : Number(item.saldo_inventario) - Number(item.saldo_fisico);

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              #{item.codigo}
            </span>
            {diff != null && diff !== 0 && (
              <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                {diff > 0 ? `+${diff}` : diff}
              </span>
            )}
            {item.prateleira && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {item.prateleira}
              </span>
            )}
          </div>
          <div className="mt-1 truncate text-sm font-medium">{item.descricao}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {item.unidade} · compra {brl(Number(item.preco_compra_convertido ?? 0))}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="rounded-lg p-2 text-muted-foreground transition hover:text-destructive"
          aria-label="Remover item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
            Estoque físico
          </span>
          <input
            inputMode="decimal"
            value={fisico}
            onChange={(e) => setFisico(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
            Saldo inventário
          </span>
          <input
            inputMode="decimal"
            value={inv}
            placeholder="—"
            onChange={(e) => setInv(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <button
          disabled={!dirty}
          onClick={() =>
            onPatch({
              saldo_fisico: Number(fisico || 0),
              saldo_inventario: inv === "" ? null : Number(inv),
            })
          }
          className="col-span-2 inline-flex h-11 items-center justify-center gap-2 self-end rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40 sm:col-span-1"
        >
          <Check className="h-4 w-4" /> Salvar
        </button>
      </div>
    </div>
  );
}

function NewItemForm({
  onCancel,
  onSave,
  busy,
}: {
  onCancel: () => void;
  onSave: (v: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [unidade, setUnidade] = useState("UNID");
  const [fisico, setFisico] = useState("0");
  const [compra, setCompra] = useState("0");
  const [prateleira, setPrateleira] = useState("");

  return (
    <div className="mb-3 rounded-2xl border border-border bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Código" value={codigo} onChange={setCodigo} />
        <Field
          label="Descrição"
          value={descricao}
          onChange={setDescricao}
          className="sm:col-span-2"
        />
        <Field label="Und. venda" value={unidade} onChange={setUnidade} />
        <Field label="Estoque físico" value={fisico} onChange={setFisico} />
        <Field label="Preço de compra" value={compra} onChange={setCompra} />
        <Field label="Prateleira" value={prateleira} onChange={setPrateleira} />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={busy || !codigo.trim() || !descricao.trim()}
          onClick={() =>
            onSave({
              codigo: codigo.trim(),
              descricao: descricao.trim(),
              unidade: unidade.trim() || "UNID",
              saldo_fisico: Number(fisico || 0),
              saldo_inventario: null,
              preco_compra: Number(compra.replace(",", ".") || 0),
              preco_venda: 0,
              prateleira: prateleira.trim() || null,
            })
          }
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{" "}
          Adicionar
        </button>
        <button onClick={onCancel} className="h-10 rounded-xl border border-border px-4 text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}
