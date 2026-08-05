import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Flame, Medal, Plus, Trophy, Trash2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { listSellers, listManualSales, upsertManualSale, deleteManualSale, syncSellersFromConsultants } from "@/lib/manual-sales.functions";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking de Vendedores · LZ7 Energia" },
      {
        name: "description",
        content: "Placar ao vivo da competição de vendas da LZ7 Energia: pódio, metas e histórico de vendas por vendedor.",
      },
      { property: "og:title", content: "Ranking de Vendedores · LZ7 Energia" },
      { property: "og:description", content: "Placar ao vivo da competição de vendas da equipe LZ7 Energia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RankingPage,
});

type Seller = { id: string; name: string; unit: string | null; active: boolean };
type Sale = { id: string; seller_id: string | null; sale_date: string; amount: number; city: string | null; notes: string | null };

const UNIT_LABEL: Record<string, string> = {
  londrina: "Londrina",
  ponta_grossa: "Ponta Grossa",
  wenceslau_braz: "Wenceslau Braz",
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function RankingPage() {
  const qc = useQueryClient();
  const sellersFn = useServerFn(listSellers);
  const salesFn = useServerFn(listManualSales);
  const saveFn = useServerFn(upsertManualSale);
  const delFn = useServerFn(deleteManualSale);
  const syncFn = useServerFn(syncSellersFromConsultants);

  const [period, setPeriod] = useState<"mes" | "ano" | "tudo">("mes");
  const [form, setForm] = useState({ seller_id: "", amount: "", sale_date: new Date().toISOString().slice(0, 10), city: "", notes: "" });

  const sellersQ = useQuery({ queryKey: ["ranking-sellers"], queryFn: () => sellersFn() as Promise<Seller[]> });
  const salesQ = useQuery({ queryKey: ["ranking-sales"], queryFn: () => salesFn() as Promise<Sale[]> });

  const save = useMutation({
    mutationFn: (v: { seller_id: string; amount: number; sale_date: string; city: string | null; notes: string | null }) =>
      saveFn({ data: { ...v, id: null } }),
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
      toast.success(r.added > 0 ? `${r.added} consultor(es) adicionados ao placar.` : "Todos os consultores já estão no placar.");
      qc.invalidateQueries({ queryKey: ["ranking-sellers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const sales = salesQ.data ?? [];
  const sellers = sellersQ.data ?? [];

  const filtered = useMemo(() => {
    if (period === "tudo") return sales;
    const now = new Date();
    return sales.filter((s) => {
      const d = new Date(`${s.sale_date}T12:00:00`);
      if (period === "ano") return d.getFullYear() === now.getFullYear();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }, [sales, period]);

  const ranking = useMemo(() => {
    const map = new Map<string, { id: string; name: string; unit: string | null; total: number; count: number }>();
    for (const s of sellers) map.set(s.id, { id: s.id, name: s.name, unit: s.unit, total: 0, count: 0 });
    for (const v of filtered) {
      if (!v.seller_id) continue;
      const row = map.get(v.seller_id);
      if (!row) continue;
      row.total += Number(v.amount ?? 0);
      row.count += 1;
    }
    return Array.from(map.values())
      .filter((r) => r.count > 0)
      .sort((a, b) => b.total - a.total);
  }, [filtered, sellers]);

  const totalGeral = ranking.reduce((s, r) => s + r.total, 0);
  const leader = ranking[0]?.total ?? 0;
  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  const loading = sellersQ.isLoading || salesQ.isLoading;

  return (
    <div className="min-h-screen bg-[#0b0d17] text-slate-100">
      {/* Arena header */}
      <header className="relative overflow-hidden border-b border-amber-500/20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_50%_-20%,rgba(251,191,36,0.25),transparent_60%)]" />
        <div className="relative mx-auto max-w-5xl px-5 py-10 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 shadow-[0_0_40px_rgba(251,191,36,0.45)]">
            <Trophy className="h-7 w-7 text-[#0b0d17]" />
          </div>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-[0.18em] text-transparent bg-clip-text bg-gradient-to-b from-amber-100 to-amber-400 sm:text-4xl">
            Ranking de Vendedores
          </h1>
          <p className="mt-2 text-sm text-slate-400">Competição LZ7 Energia · placar atualizado pela coordenação</p>

          <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            {(["mes", "ano", "tudo"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                  period === p ? "bg-amber-400 text-[#0b0d17]" : "text-slate-300 hover:text-white"
                }`}
              >
                {p === "mes" ? "Mês" : p === "ano" ? "Ano" : "Geral"}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3 text-left">
            <StatChip label="Total vendido" value={brl(totalGeral)} />
            <StatChip label="Vendas" value={String(filtered.filter((f) => f.seller_id).length)} />
            <StatChip label="Na disputa" value={String(ranking.length)} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-5 py-10">
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : ranking.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
            Nenhuma venda registrada neste período. Lance a primeira venda abaixo e comece a disputa.
          </div>
        ) : (
          <>
            {/* Pódio */}
            <section className="grid gap-4 sm:grid-cols-3 sm:items-end">
              {[podium[1], podium[0], podium[2]].map((p, i) => {
                if (!p) return <div key={`empty-${i}`} className="hidden sm:block" />;
                const place = p.id === podium[0]?.id ? 1 : p.id === podium[1]?.id ? 2 : 3;
                return <PodiumCard key={p.id} place={place} name={p.name} unit={p.unit} total={p.total} count={p.count} />;
              })}
            </section>

            {/* Demais posições */}
            {rest.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                {rest.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-4 border-b border-white/5 px-5 py-4 last:border-0">
                    <span className="w-8 text-center font-display text-lg font-bold text-slate-500">{i + 4}º</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{r.name}</div>
                      <div className="text-xs text-slate-500">
                        {r.unit ? UNIT_LABEL[r.unit] ?? r.unit : "Sem unidade"} · {r.count} venda{r.count > 1 ? "s" : ""}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500/70 to-amber-300"
                          style={{ width: `${leader ? Math.max(6, (r.total / leader) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right font-display font-bold text-amber-300">{brl(r.total)}</div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        {/* Lançar venda */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Flame className="h-5 w-5 text-amber-400" /> Lançar venda no placar
          </h2>
          <p className="mt-1 text-sm text-slate-400">Registre a venda que o vendedor te passou. O ranking atualiza na hora.</p>

          <form
            className="mt-5 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(form.amount.replace(/\./g, "").replace(",", "."));
              if (!form.seller_id) return toast.error("Escolha o vendedor.");
              if (!amount || amount <= 0) return toast.error("Informe o valor da venda.");
              save.mutate({
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
              className="rounded-xl border border-white/10 bg-[#11141f] px-4 py-3 text-sm outline-none focus:border-amber-400"
            >
              <option value="">Vendedor…</option>
              {sellers.filter((s) => s.active).map((s) => (
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
              className="rounded-xl border border-white/10 bg-[#11141f] px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:border-amber-400"
            />
            <input
              type="date"
              value={form.sale_date}
              onChange={(e) => setForm((f) => ({ ...f, sale_date: e.target.value }))}
              className="rounded-xl border border-white/10 bg-[#11141f] px-4 py-3 text-sm outline-none focus:border-amber-400"
            />
            <input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="Cidade (opcional)"
              className="rounded-xl border border-white/10 bg-[#11141f] px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:border-amber-400"
            />
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Observação (opcional)"
              className="sm:col-span-2 rounded-xl border border-white/10 bg-[#11141f] px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={save.isPending}
              className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-5 py-3 font-bold uppercase tracking-wider text-[#0b0d17] transition hover:brightness-110 disabled:opacity-60"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Registrar venda
            </button>
          </form>
        </section>

        {/* Histórico */}
        {filtered.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="font-display text-lg font-bold">Últimos lançamentos</h2>
            <div className="mt-4 space-y-2">
              {filtered.slice(0, 15).map((s) => {
                const seller = sellers.find((x) => x.id === s.seller_id);
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{seller?.name ?? "Sem vendedor"}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(`${s.sale_date}T12:00:00`).toLocaleDateString("pt-BR")}
                        {s.city ? ` · ${s.city}` : ""}
                        {s.notes ? ` · ${s.notes}` : ""}
                      </div>
                    </div>
                    <div className="font-display font-bold text-amber-300">{brl(Number(s.amount))}</div>
                    <button
                      onClick={() => remove.mutate(s.id)}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Remover venda"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="font-display text-lg font-bold text-amber-200">{value}</div>
    </div>
  );
}

function PodiumCard({
  place,
  name,
  unit,
  total,
  count,
}: {
  place: number;
  name: string;
  unit: string | null;
  total: number;
  count: number;
}) {
  const styles =
    place === 1
      ? "from-amber-400/25 to-transparent border-amber-400/50 sm:pb-10 shadow-[0_0_60px_-15px_rgba(251,191,36,0.6)]"
      : place === 2
        ? "from-slate-300/15 to-transparent border-slate-300/30"
        : "from-orange-700/20 to-transparent border-orange-600/30";
  const medal = place === 1 ? "text-amber-300" : place === 2 ? "text-slate-300" : "text-orange-400";

  return (
    <div className={`relative rounded-2xl border bg-gradient-to-b p-6 text-center ${styles}`}>
      {place === 1 && (
        <Crown className="absolute left-1/2 top-0 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
      )}
      <Medal className={`mx-auto h-8 w-8 ${medal}`} />
      <div className="mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">{place}º lugar</div>
      <div className="mt-1 font-display text-xl font-extrabold">{name}</div>
      <div className="text-xs text-slate-500">{unit ? UNIT_LABEL[unit] ?? unit : "Sem unidade"}</div>
      <div className="mt-4 font-display text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 to-amber-400">
        {brl(total)}
      </div>
      <div className="text-xs text-slate-500">
        {count} venda{count > 1 ? "s" : ""}
      </div>
    </div>
  );
}
