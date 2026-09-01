import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronRight,
  X,
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
  lead_origin?: string | null;
  branch?: string | null;
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
  const [origin, setOrigin] = useState<string>("todas");
  const [showAdmin, setShowAdmin] = useState(false);
  const [showZeros, setShowZeros] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
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

  // Mês padrão = último mês que realmente tem venda registrada (evita placar zerado)
  const lastMonthWithData = useMemo(() => {
    let best = "";
    for (const s of sales) {
      const m = String(s.sale_date ?? "").slice(0, 7);
      if (m && m > best) best = m;
    }
    const today = new Date();
    return best || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  }, [sales]);
  const activeMonth = month ?? lastMonthWithData;

  const inPeriod = useMemo(() => {
    const year = activeMonth.slice(0, 4);
    return (d: string | null | undefined) => {
      const v = d ? String(d) : "";
      if (!v) return false;
      if (period === "tudo") return true;
      return period === "mes" ? v.substring(0, 7) === activeMonth : v.substring(0, 4) === year;
    };
  }, [period, activeMonth]);

  const origins = useMemo(() => {
    const set = new Set<string>();
    for (const s of sales) if (s.lead_origin) set.add(s.lead_origin);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [sales]);

  const filtered = useMemo(
    () =>
      sales.filter(
        (s) =>
          inPeriod(s.sale_date) &&
          (origin === "todas" || (origin === "sem" ? !s.lead_origin : s.lead_origin === origin)),
      ),
    [sales, inPeriod, origin],
  );

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
      // Pontuação do ranking: pontua vendas fechadas e confirmadas no período
      if (soldNow || invoicedNow) {
        row.scoreTotal += amount;
        row.scoreCount += 1;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        b.scoreTotal - a.scoreTotal ||
        b.total - a.total ||
        b.invoicedTotal - a.invoicedTotal ||
        a.name.localeCompare(b.name),
    );
  }, [sales, sellers, inPeriod]);

  const withPlace = useMemo(() => ranking.map((r, i) => ({ ...r, place: i + 1 })), [ranking]);
  const hiddenZeros = useMemo(
    () =>
      withPlace.filter((r) => r.scoreTotal === 0 && r.invoicedTotal === 0 && r.total === 0).length,
    [withPlace],
  );
  const visible = useMemo(() => {
    const q = norm(search.trim());
    if (q) {
      return withPlace.filter(
        (r) =>
          norm(r.name).includes(q) || norm(UNIT_LABEL[r.unit ?? ""] ?? r.unit ?? "").includes(q),
      );
    }
    if (showZeros) return withPlace;
    const active = withPlace.filter((r) => r.scoreTotal > 0 || r.invoicedTotal > 0 || r.total > 0);
    return active.length > 0 ? active : withPlace;
  }, [withPlace, search, showZeros]);

  const totalPontuado = ranking.reduce((s, r) => s + r.scoreTotal, 0);
  const totalFaturado = ranking.reduce((s, r) => s + r.invoicedTotal, 0);
  const totalVendido = ranking.reduce((s, r) => s + r.total, 0);
  const leader = ranking[0]?.scoreTotal ?? 0;
  const loading = sellersQ.isLoading || salesQ.isLoading;

  const podium = visible.slice(0, 3);
  const rest = visible.slice(3);

  const monthLabel = new Date(`${activeMonth}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen w-full bg-secondary/30 pb-20 font-sans text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-3 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 lg:h-11 lg:w-11">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-base font-bold leading-tight tracking-tight text-foreground lg:text-xl">
                Ranking de Vendedores
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {period === "tudo"
                  ? "Histórico completo"
                  : period === "ano"
                    ? `Ano de ${activeMonth.slice(0, 4)}`
                    : monthLabel}{" "}
                · Vendas ganhas e faturamento confirmado
              </p>
            </div>
            <div className="hidden gap-2 lg:flex">
              <Chip label="Pontuado" value={brlShort(totalPontuado)} accent />
              <Chip label="Faturado" value={brlShort(totalFaturado)} />
              <Chip label="Vendido" value={brlShort(totalVendido)} />
            </div>
            <button
              type="button"
              onClick={() => setShowAdmin((v) => !v)}
              aria-label="Administração do placar"
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition ${
                showAdmin
                  ? "border-primary/60 bg-primary/10 text-primary shadow-xs"
                  : "border-border/60 bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex shrink-0 rounded-xl border border-border/60 bg-muted/60 p-0.5">
              {(["mes", "ano", "tudo"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-lg px-3 py-1.5 font-display text-xs font-bold transition ${
                    period === p
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
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
                value={activeMonth}
                onChange={(e) => setMonth(e.target.value || activeMonth)}
                className="h-9 w-[9.5rem] shrink-0 rounded-xl border border-border/60 bg-card px-3 text-sm text-foreground outline-none focus:border-primary shadow-xs"
              />
            )}
            {origins.length > 0 && (
              <select
                aria-label="Origem do lead"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="h-9 shrink-0 rounded-xl border border-border/60 bg-card px-3 text-sm text-foreground outline-none focus:border-primary shadow-xs"
              >
                <option value="todas">Todas as origens</option>
                {origins.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                <option value="sem">Sem origem</option>
              </select>
            )}
            <div className="relative min-w-[10rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar vendedor ou unidade…"
                className="h-9 w-full rounded-xl border border-border/60 bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary shadow-xs"
              />
            </div>
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5 text-[11px] lg:hidden">
            <Chip label="Pontuado" value={brlShort(totalPontuado)} accent />
            <Chip label="Faturado" value={brlShort(totalFaturado)} />
            <Chip label="Vendido" value={brlShort(totalVendido)} />
            <Chip label="Disputa" value={`${ranking.length}`} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-4 lg:px-8 lg:py-6">
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
          <div className="flex justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground shadow-xs">
            {search ? "Nenhum vendedor encontrado." : "Nenhuma venda neste período."}
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,400px)_1fr] lg:gap-6">
            {/* Pódio */}
            <div className="grid grid-cols-3 gap-2 lg:gap-3">
              {[podium[1], podium[0], podium[2]].map((r, i) =>
                r ? (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setDetail(r.id)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 pb-3 text-center transition-all hover:-translate-y-0.5 shadow-xs active:scale-[0.98] ${
                      i === 1
                        ? "border-amber-500/50 bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-card pt-6 shadow-amber-500/10"
                        : i === 0
                          ? "border-slate-200 bg-card pt-5"
                          : "border-amber-700/20 bg-card pt-5"
                    }`}
                  >
                    {i === 1 && (
                      <Crown className="absolute -top-2.5 h-5 w-5 text-amber-500 fill-amber-500" />
                    )}
                    <span
                      className={`grid place-items-center rounded-full font-display font-bold shadow-xs ${
                        i === 1
                          ? "h-12 w-12 bg-gradient-to-br from-amber-400 to-amber-600 text-sm text-white"
                          : i === 0
                            ? "h-10 w-10 bg-slate-200 dark:bg-slate-700 text-xs text-slate-800 dark:text-slate-100"
                            : "h-10 w-10 bg-amber-100 dark:bg-amber-950 text-xs text-amber-800 dark:text-amber-200"
                      }`}
                    >
                      {initials(r.name)}
                    </span>
                    <span className="w-full truncate text-[11.5px] font-bold text-foreground">
                      {r.name}
                    </span>
                    <span
                      className={`font-display text-xs font-bold ${
                        i === 1
                          ? "text-amber-600 dark:text-amber-400 font-extrabold"
                          : "text-foreground"
                      }`}
                    >
                      {brlShort(r.scoreTotal)}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {r.place}º lugar
                    </span>
                  </button>
                ) : (
                  <div
                    key={`empty-${i}`}
                    className="rounded-2xl border border-dashed border-border/60 bg-muted/20"
                  />
                ),
              )}
            </div>

            <div className="min-w-0">
              <ol className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
                {(rest.length > 0 ? rest : visible).map((r) => {
                  const pct = leader ? Math.max(2, (r.scoreTotal / leader) * 100) : 0;
                  return (
                    <li
                      key={r.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => setDetail(r.id)}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition active:bg-muted/60"
                      >
                        <span className="w-6 shrink-0 text-center font-display text-xs font-bold text-muted-foreground">
                          {r.place}º
                        </span>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 font-display text-[10.5px] font-bold text-primary">
                          {initials(r.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-xs font-bold text-foreground">
                              {r.name}
                            </span>
                            <span className="shrink-0 font-display text-xs font-bold text-primary">
                              {brlShort(r.scoreTotal)}
                            </span>
                          </span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-secondary">
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                          <span className="mt-0.5 block truncate text-[10.5px] text-muted-foreground">
                            {r.unit ? (UNIT_LABEL[r.unit] ?? r.unit) : "Sem unidade"} ·{" "}
                            {r.scoreCount} venda{r.scoreCount !== 1 ? "s" : ""}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      </button>
                    </li>
                  );
                })}
              </ol>

              {!search && hiddenZeros > 0 && (
                <button
                  type="button"
                  onClick={() => setShowZeros((v) => !v)}
                  className="mt-3 w-full rounded-xl border border-border/60 bg-card py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground hover:bg-muted shadow-xs"
                >
                  {showZeros
                    ? "Ocultar quem não vendeu no período"
                    : `Mostrar ${hiddenZeros} vendedor(es) sem venda no período`}
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {detail && (
        <SellerSheet
          row={withPlace.find((r) => r.id === detail) ?? null}
          sales={sales.filter(
            (s) => s.seller_id === detail && (inPeriod(s.sale_date) || inPeriod(s.invoiced_date)),
          )}
          periodLabel={
            period === "tudo"
              ? "Histórico completo"
              : period === "ano"
                ? `Ano de ${activeMonth.slice(0, 4)}`
                : monthLabel
          }
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function SellerSheet({
  row,
  sales,
  periodLabel,
  onClose,
}: {
  row: {
    id: string;
    name: string;
    unit: string | null;
    total: number;
    count: number;
    invoicedTotal: number;
    invoicedCount: number;
    scoreTotal: number;
    scoreCount: number;
    place: number;
  } | null;
  sales: Sale[];
  periodLabel: string;
  onClose: () => void;
}) {
  if (!row) return null;
  const ordered = [...sales].sort((a, b) => (a.sale_date < b.sale_date ? 1 : -1));
  const fmt = (d: string | null) =>
    d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative flex max-h-[88dvh] w-full flex-col rounded-t-3xl border border-border/60 bg-card shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-border/60 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
            {initials(row.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-sm font-bold text-foreground">{row.name}</h2>
            <p className="text-xs text-muted-foreground">
              {row.place}º lugar · {row.unit ? (UNIT_LABEL[row.unit] ?? row.unit) : "Sem unidade"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b border-border/40 p-4">
          <Mini
            label="Pontuado"
            value={brlShort(row.scoreTotal)}
            sub={`${row.scoreCount} vendas`}
            accent
          />
          <Mini
            label="Faturado"
            value={brlShort(row.invoicedTotal)}
            sub={`${row.invoicedCount} vendas`}
          />
          <Mini label="Vendido" value={brlShort(row.total)} sub={`${row.count} vendas`} />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground mb-2">
            Vendas no período ({periodLabel})
          </div>
          {ordered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">
              Nenhuma venda detalhada.
            </p>
          ) : (
            ordered.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border/40 bg-secondary/20 p-2.5 text-xs"
              >
                <div>
                  <div className="font-semibold text-foreground">
                    {s.notes || "Venda confirmada"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmt(s.sale_date)} {s.city ? `· ${s.city}` : ""}{" "}
                    {s.lead_origin ? `· ${s.lead_origin}` : ""}
                  </div>
                </div>
                <div className="font-display font-bold text-primary text-xs">
                  {brl(Number(s.amount))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`shrink-0 rounded-xl border px-3 py-1 text-xs font-semibold shadow-xs ${
        accent
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 bg-card text-foreground"
      }`}
    >
      <span className="text-muted-foreground">{label} </span>
      <span className={`font-display font-bold ${accent ? "text-primary" : "text-foreground"}`}>
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
      className={`rounded-xl border p-3 text-center shadow-xs ${
        accent ? "border-primary/40 bg-primary/10" : "border-border/60 bg-secondary/20"
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`font-display text-sm font-bold mt-0.5 ${accent ? "text-primary font-extrabold" : "text-foreground"}`}
      >
        {value}
      </div>
      <div className="text-[10.5px] text-muted-foreground mt-0.5">{sub}</div>
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
    <section className="mb-4 rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-xl border border-border/60 bg-muted/60 p-0.5">
          {(["lancar", "historico"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold font-display transition ${
                tab === t
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "lancar" ? "Lançar venda manual" : "Histórico"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onSyncSellers}
            disabled={syncing}
            title="Puxar consultores do sistema"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border/60 bg-card text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60 shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            Puxar Consultores
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={importing}
            title="Sincronizar Vendas do Ploomes"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-primary/40 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-60 shadow-xs"
          >
            <Download className={`h-3.5 w-3.5 ${importing ? "animate-spin" : ""}`} />
            Sincronizar Ploomes
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
            className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary"
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
            className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <input
            type="date"
            value={form.sale_date}
            onChange={(e) => setForm((f) => ({ ...f, sale_date: e.target.value }))}
            className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <input
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="Cidade (opcional)"
            className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Observação (opcional)"
            className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary sm:col-span-2"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60 sm:col-span-2 shadow-xs"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Registrar venda
          </button>
        </form>
      ) : (
        <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {sales.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nada neste período.</p>
          ) : (
            sales.slice(0, 40).map((s) => {
              const seller = sellers.find((x) => x.id === s.seller_id);
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-xl border border-border/40 bg-secondary/20 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-foreground">
                      {seller?.name ?? "Sem vendedor"}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {new Date(`${s.sale_date}T12:00:00`).toLocaleDateString("pt-BR")}
                      {s.city ? ` · ${s.city}` : ""}
                      {s.invoiced_date
                        ? ` · Faturado ${new Date(`${s.invoiced_date}T12:00:00`).toLocaleDateString("pt-BR")}`
                        : " · Aguardando faturamento"}
                    </div>
                  </div>
                  <div className="shrink-0 font-display text-xs font-bold text-primary">
                    {brlShort(Number(s.amount))}
                  </div>
                  <button
                    onClick={() => onRemove(s.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
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
