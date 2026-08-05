import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  Crown,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Trophy,
  Download,
} from "lucide-react";
import { toast } from "sonner";

import {
  listSellers,
  listManualSales,
  upsertManualSale,
  deleteManualSale,
  syncSellersFromConsultants,
} from "@/lib/manual-sales.functions";
import { importPloomesSales } from "@/lib/ploomes-sales.functions";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking de Vendedores · LZ7 Energia" },
      {
        name: "description",
        content:
          "Placar ao vivo da competição de vendas da LZ7 Energia: pódio, metas e histórico de vendas por vendedor.",
      },
      { property: "og:title", content: "Ranking de Vendedores · LZ7 Energia" },
      {
        property: "og:description",
        content: "Placar ao vivo da competição de vendas da equipe LZ7 Energia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RankingPage,
});

type Seller = { id: string; name: string; unit: string | null; active: boolean };
type Sale = {
  id: string;
  seller_id: string | null;
  sale_date: string;
  invoiced_date: string | null;
  amount: number;
  city: string | null;
  notes: string | null;
};

const UNIT_LABEL: Record<string, string> = {
  londrina: "Londrina",
  ponta_grossa: "Ponta Grossa",
  wenceslau_braz: "Wenceslau Braz",
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brlShort = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : brl(n);

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

function RankingPage() {
  const qc = useQueryClient();
  const sellersFn = useServerFn(listSellers);
  const salesFn = useServerFn(listManualSales);
  const saveFn = useServerFn(upsertManualSale);
  const delFn = useServerFn(deleteManualSale);
  const syncFn = useServerFn(syncSellersFromConsultants);
  const importFn = useServerFn(importPloomesSales);

  const [period, setPeriod] = useState<"mes" | "ano" | "tudo">("mes");
  const [month, setMonth] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [showZeros, setShowZeros] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({
    seller_id: "",
    amount: "",
    sale_date: new Date().toISOString().slice(0, 10),
    city: "",
    notes: "",
  });

  const sellersQ = useQuery({
    queryKey: ["ranking-sellers"],
    queryFn: () => sellersFn() as Promise<Seller[]>,
  });
  const salesQ = useQuery({
    queryKey: ["ranking-sales"],
    queryFn: () => salesFn() as Promise<Sale[]>,
  });

  const save = useMutation({
    mutationFn: (v: {
      seller_id: string;
      amount: number;
      sale_date: string;
      city: string | null;
      notes: string | null;
    }) => saveFn({ data: { ...v, id: null } }),
    onSuccess: () => {
      toast.success("Venda registrada no placar!");
      setForm((f) => ({ ...f, amount: "", city: "", notes: "" }));
      qc.invalidateQueries({ queryKey: ["ranking-sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Venda removida.");
      qc.invalidateQueries({ queryKey: ["ranking-sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncSellers = useMutation({
    mutationFn: () => syncFn() as Promise<{ added: number }>,
    onSuccess: (r) => {
      toast.success(
        r.added > 0
          ? `${r.added} consultor(es) adicionados ao placar.`
          : "Todos os consultores já estão no placar.",
      );
      qc.invalidateQueries({ queryKey: ["ranking-sellers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importPloomes = useMutation({
    mutationFn: () =>
      importFn({ data: { sinceDays: 365 } }) as Promise<{
        fetched: number;
        inserted: number;
        updated: number;
        sold: number;
        invoiced: number;
        sellersCreated: number;
        unmatched: string[];
      }>,
    onSuccess: (r) => {
      toast.success(
        `Ploomes: ${r.sold} vendidas, ${r.invoiced} faturadas · ${r.inserted} novas e ${r.updated} atualizadas.`,
      );
      if (r.sellersCreated > 0)
        toast.info(`${r.sellersCreated} vendedor(es) criados a partir do Ploomes.`);
      if (r.unmatched.length > 0)
        toast.warning(`Sem vendedor vinculado: ${r.unmatched.join(", ")}`);
      qc.invalidateQueries({ queryKey: ["ranking-sales"] });
      qc.invalidateQueries({ queryKey: ["ranking-sellers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sales = salesQ.data ?? [];
  const sellers = sellersQ.data ?? [];

  const inPeriod = useMemo(() => {
    const year = month.slice(0, 4);
    return (d: string | null | undefined) => {
      const v = d ? String(d) : "";
      if (!v) return false;
      if (period === "tudo") return true;
      return period === "mes" ? v.substring(0, 7) === month : v.substring(0, 4) === year;
    };
  }, [period, month]);

  const filtered = useMemo(() => sales.filter((s) => inPeriod(s.sale_date)), [sales, inPeriod]);

  const ranking = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        unit: string | null;
        total: number;
        count: number;
        invoicedTotal: number;
        invoicedCount: number;
        scoreTotal: number;
        scoreCount: number;
      }
    >();
    for (const s of sellers)
      if (s.active)
        map.set(s.id, {
          id: s.id,
          name: s.name,
          unit: s.unit,
          total: 0,
          count: 0,
          invoicedTotal: 0,
          invoicedCount: 0,
          scoreTotal: 0,
          scoreCount: 0,
        });
    for (const v of sales) {
      if (!v.seller_id) continue;
      const row = map.get(v.seller_id);
      if (!row) continue;
      const amount = Number(v.amount ?? 0);
      const soldNow = inPeriod(v.sale_date);
      const invoicedNow = inPeriod(v.invoiced_date);
      if (soldNow) {
        row.total += amount;
        row.count += 1;
      }
      if (invoicedNow) {
        row.invoicedTotal += amount;
        row.invoicedCount += 1;
      }
      // Só pontua no ranking quem vendeu E faturou dentro do mesmo período.
      if (soldNow && invoicedNow) {
        row.scoreTotal += amount;
        row.scoreCount += 1;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        b.scoreTotal - a.scoreTotal ||
        b.invoicedTotal - a.invoicedTotal ||
        b.total - a.total ||
        a.name.localeCompare(b.name),
    );
  }, [sales, sellers, inPeriod]);

  const withPlace = useMemo(() => ranking.map((r, i) => ({ ...r, place: i + 1 })), [ranking]);
  const visible = useMemo(() => {
    const q = norm(search.trim());
    if (!q) return withPlace;
    return withPlace.filter(
      (r) => norm(r.name).includes(q) || norm(UNIT_LABEL[r.unit ?? ""] ?? r.unit ?? "").includes(q),
    );
  }, [withPlace, search]);

  const totalPontuado = ranking.reduce((s, r) => s + r.scoreTotal, 0);
  const totalFaturado = ranking.reduce((s, r) => s + r.invoicedTotal, 0);
  const totalVendido = ranking.reduce((s, r) => s + r.total, 0);
  const leader = ranking[0]?.scoreTotal ?? 0;
  const loading = sellersQ.isLoading || salesQ.isLoading;

  const podium = visible.slice(0, 3);
  const rest = visible.slice(3);

  return (
    <div className="min-h-screen bg-rank-bg pb-24 font-rank-body text-rank-text">
      <header className="sticky top-0 z-20 border-b border-rank-line/60 bg-rank-bg/85 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rank-accent">
              <Trophy className="h-4.5 w-4.5 text-rank-bg" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-rank text-[15px] font-bold leading-tight tracking-tight">
                Ranking
              </h1>
              <p className="truncate text-[11px] text-rank-dim">
                Pontua quem vende e fatura no mesmo período
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdmin((v) => !v)}
              aria-label="Administração do placar"
              className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
                showAdmin
                  ? "border-rank-accent/60 bg-rank-accent/15 text-rank-accent"
                  : "border-rank-line bg-rank-surface text-rank-muted"
              }`}
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="inline-flex shrink-0 rounded-xl border border-rank-line bg-rank-surface p-0.5">
              {(["mes", "ano", "tudo"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-lg px-3 py-1.5 font-rank text-xs font-bold transition ${
                    period === p ? "bg-rank-accent text-rank-bg" : "text-rank-muted"
                  }`}
                >
                  {p === "mes" ? "Mês" : p === "ano" ? "Ano" : "Geral"}
                </button>
              ))}
            </div>
            {period !== "tudo" && (
              <input
                aria-label="Período"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value || month)}
                className="h-9 min-w-0 flex-1 rounded-xl border border-rank-line bg-rank-surface px-3 text-sm text-rank-text outline-none focus:border-rank-accent"
              />
            )}
          </div>

          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rank-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar vendedor ou unidade…"
              className="h-10 w-full rounded-xl border border-rank-line bg-rank-surface pl-9 pr-3 text-sm outline-none placeholder:text-rank-dim focus:border-rank-accent"
            />
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5 text-[11px]">
            <Chip label="Pontuado" value={brlShort(totalPontuado)} accent />
            <Chip label="Faturado" value={brlShort(totalFaturado)} />
            <Chip label="Vendido" value={brlShort(totalVendido)} />
            <Chip label="Disputa" value={`${ranking.length}`} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        {showAdmin && (
          <AdminPanel
            sellers={sellers}
            form={form}
            setForm={setForm}
            onSave={(v) => save.mutate(v)}
            saving={save.isPending}
            onSyncSellers={() => syncSellers.mutate()}
            syncing={syncSellers.isPending}
            onImport={() => importPloomes.mutate()}
            importing={importPloomes.isPending}
            sales={filtered}
            onRemove={(id) => remove.mutate(id)}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-20 text-rank-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-rank-line bg-rank-surface p-10 text-center text-sm text-rank-muted">
            {search ? "Nenhum vendedor encontrado." : "Nenhuma venda neste período."}
          </div>
        ) : (
          <>
            {/* Pódio */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[podium[1], podium[0], podium[2]].map((r, i) =>
                r ? (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 pb-3 text-center transition active:scale-[0.98] ${
                      i === 1
                        ? "border-rank-accent/50 bg-rank-accent/12 pt-6"
                        : "border-rank-line bg-rank-surface pt-5"
                    }`}
                  >
                    {i === 1 && (
                      <Crown className="absolute -top-2.5 h-5 w-5 text-rank-accent" />
                    )}
                    <span
                      className={`grid place-items-center rounded-full font-rank font-bold ${
                        i === 1
                          ? "h-13 w-13 bg-rank-accent text-base text-rank-bg"
                          : "h-11 w-11 bg-rank-accent-soft text-sm text-rank-text"
                      }`}
                    >
                      {initials(r.name)}
                    </span>
                    <span className="w-full truncate text-[12px] font-semibold">{r.name}</span>
                    <span
                      className={`font-rank text-sm font-bold ${
                        i === 1 ? "text-rank-accent" : "text-rank-text"
                      }`}
                    >
                      {brlShort(r.scoreTotal)}
                    </span>
                    <span className="text-[10px] text-rank-dim">{r.place}º lugar</span>
                  </button>
                ) : (
                  <div
                    key={`empty-${i}`}
                    className="rounded-2xl border border-dashed border-rank-line/70"
                  />
                ),
              )}
            </div>

            <ol className="overflow-hidden rounded-2xl border border-rank-line bg-rank-surface/60">
              {(rest.length > 0 ? rest : visible).map((r) => {
                const open = expanded === r.id;
                const pct = leader ? Math.max(2, (r.scoreTotal / leader) * 100) : 0;
                return (
                  <li key={r.id} className="border-b border-rank-line/50 last:border-0">
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : r.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition active:bg-rank-line/40"
                    >
                      <span className="w-6 shrink-0 text-center font-rank text-sm font-bold text-rank-dim">
                        {r.place}
                      </span>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rank-accent-soft/60 font-rank text-[11px] font-bold text-rank-text">
                        {initials(r.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold">{r.name}</span>
                          <span className="shrink-0 font-rank text-[13px] font-bold text-rank-accent">
                            {brlShort(r.scoreTotal)}
                          </span>
                        </span>
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-rank-line">
                          <span
                            className="block h-full rounded-full bg-rank-accent"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-rank-dim">
                          {r.unit ? (UNIT_LABEL[r.unit] ?? r.unit) : "Sem unidade"} · {r.scoreCount}{" "}
                          pontuada{r.scoreCount !== 1 ? "s" : ""}
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-rank-dim transition ${open ? "rotate-180" : ""}`}
                      />
                    </button>
                    {open && (
                      <div className="grid grid-cols-3 gap-2 px-3 pb-3 text-center">
                        <Mini label="Vendido" value={brl(r.total)} sub={`${r.count} vendas`} />
                        <Mini
                          label="Faturado"
                          value={brl(r.invoicedTotal)}
                          sub={`${r.invoicedCount} vendas`}
                        />
                        <Mini
                          label="Pontuado"
                          value={brl(r.scoreTotal)}
                          sub={`${r.scoreCount} vendas`}
                          accent
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </main>
    </div>
  );
}

function Chip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`shrink-0 rounded-lg border px-2.5 py-1 ${
        accent ? "border-rank-accent/40 bg-rank-accent/12" : "border-rank-line bg-rank-surface"
      }`}
    >
      <span className="text-rank-dim">{label} </span>
      <span className={`font-rank font-bold ${accent ? "text-rank-accent" : "text-rank-text"}`}>
        {value}
      </span>
    </div>
  );
}

function Mini({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-2 py-2 ${
        accent ? "border-rank-accent/35 bg-rank-accent/12" : "border-rank-line bg-rank-bg/40"
      }`}
    >
      <div className="text-[9px] font-bold uppercase tracking-widest text-rank-dim">{label}</div>
      <div
        className={`font-rank text-sm font-bold ${accent ? "text-rank-accent" : "text-rank-text"}`}
      >
        {value}
      </div>
      <div className="text-[10px] text-rank-dim">{sub}</div>
    </div>
  );
}


function AdminPanel({
  sellers,
  form,
  setForm,
  onSave,
  saving,
  onSyncSellers,
  syncing,
  onImport,
  importing,
  sales,
  onRemove,
}: {
  sellers: Seller[];
  form: { seller_id: string; amount: string; sale_date: string; city: string; notes: string };
  setForm: React.Dispatch<
    React.SetStateAction<{
      seller_id: string;
      amount: string;
      sale_date: string;
      city: string;
      notes: string;
    }>
  >;
  onSave: (v: {
    seller_id: string;
    amount: number;
    sale_date: string;
    city: string | null;
    notes: string | null;
  }) => void;
  saving: boolean;
  onSyncSellers: () => void;
  syncing: boolean;
  onImport: () => void;
  importing: boolean;
  sales: Sale[];
  onRemove: (id: string) => void;
}) {
  const [tab, setTab] = useState<"lancar" | "historico">("lancar");
  const active = sellers.filter((s) => s.active);

  return (
    <section className="mb-4 rounded-2xl border border-rank-line bg-rank-surface p-4">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-xl border border-rank-line bg-rank-bg/50 p-0.5">
          {(["lancar", "historico"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === t ? "bg-rank-accent text-rank-bg" : "text-rank-muted"
              }`}
            >
              {t === "lancar" ? "Lançar venda" : "Histórico"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onSyncSellers}
            disabled={syncing}
            aria-label="Puxar consultores"
            className="grid h-9 w-9 place-items-center rounded-xl border border-rank-line bg-rank-bg/50 text-rank-muted disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={importing}
            aria-label="Sincronizar Ploomes"
            className="grid h-9 w-9 place-items-center rounded-xl border border-rank-accent/40 bg-rank-accent/12 text-rank-accent disabled:opacity-60"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {tab === "lancar" ? (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const amount = Number(form.amount.replace(/\./g, "").replace(",", "."));
            if (!form.seller_id) return toast.error("Escolha o vendedor.");
            if (!amount || amount <= 0) return toast.error("Informe o valor da venda.");
            onSave({
              seller_id: form.seller_id,
              amount,
              sale_date: form.sale_date,
              city: form.city || null,
              notes: form.notes || null,
            });
          }}
        >
          <select
            value={form.seller_id}
            onChange={(e) => setForm((f) => ({ ...f, seller_id: e.target.value }))}
            className="h-11 rounded-xl border border-rank-line bg-rank-bg px-3 text-sm outline-none focus:border-rank-accent"
          >
            <option value="">Vendedor… ({active.length})</option>
            {active.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.unit ? ` — ${UNIT_LABEL[s.unit] ?? s.unit}` : ""}
              </option>
            ))}
          </select>
          <input
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            inputMode="decimal"
            placeholder="Valor (ex: 15800)"
            className="h-11 rounded-xl border border-rank-line bg-rank-bg px-3 text-sm outline-none placeholder:text-rank-dim focus:border-rank-accent"
          />
          <input
            type="date"
            value={form.sale_date}
            onChange={(e) => setForm((f) => ({ ...f, sale_date: e.target.value }))}
            className="h-11 rounded-xl border border-rank-line bg-rank-bg px-3 text-sm outline-none focus:border-rank-accent"
          />
          <input
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="Cidade (opcional)"
            className="h-11 rounded-xl border border-rank-line bg-rank-bg px-3 text-sm outline-none placeholder:text-rank-dim focus:border-rank-accent"
          />
          <input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Observação (opcional)"
            className="h-11 rounded-xl border border-rank-line bg-rank-bg px-3 text-sm outline-none placeholder:text-rank-dim focus:border-rank-accent sm:col-span-2"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rank-accent text-sm font-bold text-rank-bg disabled:opacity-60 sm:col-span-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Registrar venda
          </button>
        </form>
      ) : (
        <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {sales.length === 0 ? (
            <p className="py-6 text-center text-sm text-rank-dim">Nada neste período.</p>
          ) : (
            sales.slice(0, 40).map((s) => {
              const seller = sellers.find((x) => x.id === s.seller_id);
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-xl border border-rank-line/60 bg-rank-bg/40 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">
                      {seller?.name ?? "Sem vendedor"}
                    </div>
                    <div className="truncate text-[11px] text-rank-dim">
                      {new Date(`${s.sale_date}T12:00:00`).toLocaleDateString("pt-BR")}
                      {s.city ? ` · ${s.city}` : ""}
                      {s.invoiced_date
                        ? ` · Faturado ${new Date(`${s.invoiced_date}T12:00:00`).toLocaleDateString("pt-BR")}`
                        : " · Aguardando faturamento"}
                    </div>
                  </div>
                  <div className="shrink-0 font-rank text-[13px] font-bold text-rank-accent">
                    {brlShort(Number(s.amount))}
                  </div>
                  <button
                    onClick={() => onRemove(s.id)}
                    className="rounded-lg p-2 text-rank-dim transition hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Remover venda"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
