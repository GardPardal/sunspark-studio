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
  Building2,
  Users2,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  Clock,
  TrendingUp,
  Target,
  Sparkles,
  DollarSign,
  Briefcase,
  Layers,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import {
  listSellers,
  listManualSales,
  upsertManualSale,
  deleteManualSale,
  syncSellersFromConsultants,
} from "@/lib/manual-sales.functions";
import {
  getSalesGoals,
  saveSalesGoals,
  listProspeccaoSummary,
  type SalesGoalsConfig,
} from "@/lib/sales-goals.functions";
import { triggerPloomesSync } from "@/lib/ploomes-webhooks.functions";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Metas & Contratos Ploomes · LZ7 Solar" },
      {
        name: "description",
        content:
          "Central executiva de metas de prospecção, vendas, faturamento e carteira de contratos do Ploomes na LZ7 Solar.",
      },
      { property: "og:title", content: "Metas & Contratos Ploomes · LZ7 Solar" },
      {
        property: "og:description",
        content: "Painel de metas por unidade, ranking de vendedores e contratos Ploomes.",
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
  ploomes_deal_id?: number | null;
  ploomes_owner_name?: string | null;
};

const UNIT_LABEL: Record<string, string> = {
  londrina: "Filial Londrina",
  ponta_grossa: "Filial Ponta Grossa",
  wenceslau_braz: "Sede Wenceslau Braz",
  representantes: "Representantes",
  "Filial Londrina": "Filial Londrina",
  "Filial Ponta Grossa": "Filial Ponta Grossa",
  "Sede Wenceslau Braz": "Sede Wenceslau Braz",
  Representantes: "Representantes",
};

const UNIT_KEYS: Array<"wenceslau_braz" | "londrina" | "ponta_grossa" | "representantes"> = [
  "wenceslau_braz",
  "londrina",
  "ponta_grossa",
  "representantes",
];

const UNIT_NAMES_MAP: Record<string, "wenceslau_braz" | "londrina" | "ponta_grossa" | "representantes"> = {
  wenceslau_braz: "wenceslau_braz",
  "sede wenceslau braz": "wenceslau_braz",
  londrina: "londrina",
  "filial londrina": "londrina",
  ponta_grossa: "ponta_grossa",
  "filial ponta grossa": "ponta_grossa",
  representantes: "representantes",
  "representante pj": "representantes",
  "comercial externo": "representantes",
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const brlShort = (n: number) =>
  n >= 1000000
    ? `R$ ${(n / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}M`
    : n >= 1000
      ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`
      : brl(n);

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

const contractCode = (titleOrNotes: string | null | undefined) => {
  const t = (titleOrNotes ?? "").replace(/^Ploomes:\s*/, "").trim();
  const match = t.match(/([A-Z]{2}\d{6}[A-Z]{3})/i);
  return match ? match[1].toUpperCase() : "";
};

function RankingPage() {
  const qc = useQueryClient();
  const sellersFn = useServerFn(listSellers);
  const salesFn = useServerFn(listManualSales);
  const saveFn = useServerFn(upsertManualSale);
  const delFn = useServerFn(deleteManualSale);
  const syncSellersFn = useServerFn(syncSellersFromConsultants);
  const syncPloomesFn = useServerFn(triggerPloomesSync);
  const getGoalsFn = useServerFn(getSalesGoals);
  const saveGoalsFn = useServerFn(saveSalesGoals);
  const listProspeccaoFn = useServerFn(listProspeccaoSummary);

  const [mainTab, setMainTab] = useState<"metas" | "ranking" | "contratos">("metas");
  const [period, setPeriod] = useState<"mes" | "ano" | "tudo">("mes");
  const [month, setMonth] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>("todas");
  const [origin, setOrigin] = useState<string>("todas");
  const [contractStatus, setContractStatus] = useState<"todos" | "faturados" | "pendentes">("todos");
  const [search, setSearch] = useState("");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [detailSellerId, setDetailSellerId] = useState<string | null>(null);

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
  const goalsQ = useQuery({
    queryKey: ["sales-goals-config"],
    queryFn: () => getGoalsFn() as Promise<SalesGoalsConfig>,
  });
  const prospeccaoQ = useQuery({
    queryKey: ["prospeccao-summary"],
    queryFn: () => listProspeccaoFn() as Promise<any[]>,
  });

  const syncPloomes = useMutation({
    mutationFn: () => syncPloomesFn({ data: { limit: 500 } }),
    onSuccess: (r: any) => {
      toast.success(
        `Sincronização Ploomes concluída! ${r.leadsSynced ?? 0} leads e ${r.contractsSold ?? 0} contratos atualizados (${r.contractsInvoiced ?? 0} faturados).`,
      );
      if (r.sellersCreated > 0) toast.info(`${r.sellersCreated} novo(s) vendedor(es) cadastrados.`);
      qc.invalidateQueries({ queryKey: ["ranking-sales"] });
      qc.invalidateQueries({ queryKey: ["ranking-sellers"] });
      qc.invalidateQueries({ queryKey: ["prospeccao-summary"] });
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
    },
    onError: (e: Error) => toast.error(`Erro na sincronização: ${e.message}`),
  });

  const saveManual = useMutation({
    mutationFn: (v: {
      seller_id: string;
      amount: number;
      sale_date: string;
      city: string | null;
      notes: string | null;
    }) => saveFn({ data: { ...v, id: null } }),
    onSuccess: () => {
      toast.success("Venda registrada com sucesso!");
      setForm((f) => ({ ...f, amount: "", city: "", notes: "" }));
      setShowManualModal(false);
      qc.invalidateQueries({ queryKey: ["ranking-sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSale = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Venda removida.");
      qc.invalidateQueries({ queryKey: ["ranking-sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncConsultants = useMutation({
    mutationFn: () => syncSellersFn() as Promise<{ added: number }>,
    onSuccess: (r) => {
      toast.success(
        r.added > 0
          ? `${r.added} consultor(es) vinculados ao painel.`
          : "Todos os consultores já estão vinculados.",
      );
      qc.invalidateQueries({ queryKey: ["ranking-sellers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sales = salesQ.data ?? [];
  const sellers = sellersQ.data ?? [];
  const goalsConfig = goalsQ.data;
  const prospeccaoList = prospeccaoQ.data ?? [];

  // Último mês que tem venda registrada
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

  const monthLabel = useMemo(() => {
    try {
      return new Date(`${activeMonth}-01T12:00:00`).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
    } catch {
      return activeMonth;
    }
  }, [activeMonth]);

  // Vendas do período
  const periodSales = useMemo(() => {
    return sales.filter((s) => inPeriod(s.sale_date) || inPeriod(s.invoiced_date));
  }, [sales, inPeriod]);

  // Prospecção do período
  const periodProspeccao = useMemo(() => {
    return prospeccaoList.filter((l) => inPeriod(l.created_at));
  }, [prospeccaoList, inPeriod]);

  // Origens únicas
  const origins = useMemo(() => {
    const set = new Set<string>();
    for (const s of sales) if (s.lead_origin) set.add(s.lead_origin);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [sales]);

  // Mapeamento de Vendedores
  const sellerMap = useMemo(() => {
    const map = new Map<string, Seller>();
    for (const s of sellers) map.set(s.id, s);
    return map;
  }, [sellers]);

  // Métricas por Filial / Unidade
  const unitStats = useMemo(() => {
    const defaultStats = () => ({
      soldTotal: 0,
      soldCount: 0,
      invoicedTotal: 0,
      invoicedCount: 0,
      prospeccaoCount: 0,
      sellers: new Set<string>(),
    });

    const stats: Record<
      "wenceslau_braz" | "londrina" | "ponta_grossa" | "representantes" | "global",
      ReturnType<typeof defaultStats>
    > = {
      wenceslau_braz: defaultStats(),
      londrina: defaultStats(),
      ponta_grossa: defaultStats(),
      representantes: defaultStats(),
      global: defaultStats(),
    };

    for (const s of periodSales) {
      const amount = Number(s.amount ?? 0);
      const isSold = inPeriod(s.sale_date);
      const isInvoiced = inPeriod(s.invoiced_date);

      const seller = s.seller_id ? sellerMap.get(s.seller_id) : null;
      const unitKey =
        (s.branch && UNIT_NAMES_MAP[norm(s.branch)]) ||
        (seller?.unit && UNIT_NAMES_MAP[norm(seller.unit)]) ||
        null;

      if (isSold) {
        stats.global.soldTotal += amount;
        stats.global.soldCount += 1;
        if (unitKey && stats[unitKey]) {
          stats[unitKey].soldTotal += amount;
          stats[unitKey].soldCount += 1;
        }
      }

      if (isInvoiced) {
        stats.global.invoicedTotal += amount;
        stats.global.invoicedCount += 1;
        if (unitKey && stats[unitKey]) {
          stats[unitKey].invoicedTotal += amount;
          stats[unitKey].invoicedCount += 1;
        }
      }

      if (seller) {
        stats.global.sellers.add(seller.name);
        if (unitKey && stats[unitKey]) stats[unitKey].sellers.add(seller.name);
      }
    }

    stats.global.prospeccaoCount = periodProspeccao.length;
    for (const p of periodProspeccao) {
      const c = norm(p.cidade);
      if (c.includes("londrina") || c.includes("cambe") || c.includes("rolandia") || c.includes("ibipora")) {
        stats.londrina.prospeccaoCount += 1;
      } else if (c.includes("ponta grossa") || c.includes("castro") || c.includes("carambei") || c.includes("curitiba")) {
        stats.ponta_grossa.prospeccaoCount += 1;
      } else if (c.includes("wenceslau") || c.includes("braz") || c.includes("siqueira") || c.includes("arapoti") || c.includes("jaguariaiva")) {
        stats.wenceslau_braz.prospeccaoCount += 1;
      } else {
        stats.representantes.prospeccaoCount += 1;
      }
    }

    return stats;
  }, [periodSales, periodProspeccao, inPeriod, sellerMap]);

  // Ranking de Vendedores com Metas
  const sellerRankings = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        unit: string | null;
        soldTotal: number;
        soldCount: number;
        invoicedTotal: number;
        invoicedCount: number;
        goalVendas: number;
        goalFaturamento: number;
        goalProspeccao: number;
      }
    >();

    for (const s of sellers) {
      if (!s.active) continue;
      const n = norm(s.name);
      const customGoal = goalsConfig?.sellers?.[n];
      map.set(s.id, {
        id: s.id,
        name: s.name,
        unit: s.unit,
        soldTotal: 0,
        soldCount: 0,
        invoicedTotal: 0,
        invoicedCount: 0,
        goalVendas: customGoal?.vendas ?? 180000,
        goalFaturamento: customGoal?.faturamento ?? 150000,
        goalProspeccao: customGoal?.prospeccao ?? 25,
      });
    }

    for (const s of periodSales) {
      if (!s.seller_id) continue;
      const row = map.get(s.seller_id);
      if (!row) continue;
      const amount = Number(s.amount ?? 0);
      if (inPeriod(s.sale_date)) {
        row.soldTotal += amount;
        row.soldCount += 1;
      }
      if (inPeriod(s.invoiced_date)) {
        row.invoicedTotal += amount;
        row.invoicedCount += 1;
      }
    }

    const list = Array.from(map.values()).sort(
      (a, b) => b.soldTotal - a.soldTotal || b.invoicedTotal - a.invoicedTotal || a.name.localeCompare(b.name),
    );

    return list.map((item, index) => ({
      ...item,
      place: index + 1,
      pctGoal: item.goalVendas > 0 ? (item.soldTotal / item.goalVendas) * 100 : 0,
      avgTicket: item.soldCount > 0 ? item.soldTotal / item.soldCount : 0,
    }));
  }, [sellers, periodSales, inPeriod, goalsConfig]);

  // Filtros de Vendedores
  const filteredSellers = useMemo(() => {
    return sellerRankings.filter((s) => {
      if (selectedUnit !== "todas") {
        const u = norm(s.unit);
        const target = norm(selectedUnit);
        if (!u.includes(target) && !target.includes(u)) return false;
      }
      if (search.trim()) {
        const q = norm(search);
        if (!norm(s.name).includes(q) && !norm(s.unit).includes(q)) return false;
      }
      return true;
    });
  }, [sellerRankings, selectedUnit, search]);

  // Filtros de Contratos
  const filteredContracts = useMemo(() => {
    return periodSales.filter((s) => {
      if (contractStatus === "faturados" && !s.invoiced_date) return false;
      if (contractStatus === "pendentes" && s.invoiced_date) return false;

      if (origin !== "todas") {
        if (origin === "sem" && s.lead_origin) return false;
        if (origin !== "sem" && s.lead_origin !== origin) return false;
      }

      if (selectedUnit !== "todas") {
        const branchNorm = norm(s.branch);
        const target = norm(selectedUnit);
        if (!branchNorm.includes(target) && !target.includes(branchNorm)) return false;
      }

      if (search.trim()) {
        const q = norm(search);
        const code = norm(contractCode(s.notes));
        const notes = norm(s.notes);
        const city = norm(s.city);
        const owner = norm(s.ploomes_owner_name || sellerMap.get(s.seller_id ?? "")?.name);
        if (!code.includes(q) && !notes.includes(q) && !city.includes(q) && !owner.includes(q))
          return false;
      }

      return true;
    });
  }, [periodSales, contractStatus, origin, selectedUnit, search, sellerMap]);

  // Exportar Contratos para CSV
  const exportContractsCSV = () => {
    const headers = [
      "Código",
      "Título/Cliente",
      "Vendedor",
      "Filial",
      "Valor (R$)",
      "Data Venda",
      "Data Faturamento",
      "Status",
      "Origem",
      "Cidade",
      "ID Ploomes",
    ];

    const rows = filteredContracts.map((c) => {
      const seller = c.seller_id ? sellerMap.get(c.seller_id) : null;
      const code = contractCode(c.notes);
      return [
        code || "-",
        `"${(c.notes || "Venda").replace(/"/g, '""')}"`,
        `"${(c.ploomes_owner_name || seller?.name || "Sem vendedor").replace(/"/g, '""')}"`,
        `"${(c.branch || seller?.unit || "-").replace(/"/g, '""')}"`,
        c.amount,
        c.sale_date || "-",
        c.invoiced_date || "-",
        c.invoiced_date ? "Faturado" : "Aguardando Faturamento",
        `"${(c.lead_origin || "-").replace(/"/g, '""')}"`,
        `"${(c.city || "-").replace(/"/g, '""')}"`,
        c.ploomes_deal_id || "-",
      ].join(";");
    });

    const csvContent = "data:text/csv;charset=utf-8,﻿" + [headers.join(";"), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `contratos-ploomes-${activeMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Arquivo CSV exportado com sucesso!");
  };

  const loading = salesQ.isLoading || sellersQ.isLoading || goalsQ.isLoading;

  // Global Goal Targets
  const globalGoal = goalsConfig?.global ?? { vendas: 3000000, faturamento: 2500000, prospeccao: 500, contratos: 60 };
  const globalSoldPct = globalGoal.vendas > 0 ? (unitStats.global.soldTotal / globalGoal.vendas) * 100 : 0;
  const globalFatPct = globalGoal.faturamento > 0 ? (unitStats.global.invoicedTotal / globalGoal.faturamento) * 100 : 0;
  const globalProspPct = globalGoal.prospeccao > 0 ? (unitStats.global.prospeccaoCount / globalGoal.prospeccao) * 100 : 0;

  return (
    <div className="min-h-screen w-full bg-secondary/20 pb-20 font-sans text-foreground">
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-xl shadow-xs">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-3 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xs">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-base font-bold leading-tight tracking-tight text-foreground lg:text-xl">
                    Metas & Contratos Ploomes
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Ao Vivo
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  LZ7 Solar · {period === "tudo" ? "Histórico Completo" : period === "ano" ? `Ano de ${activeMonth.slice(0, 4)}` : monthLabel}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => syncPloomes.mutate()}
                disabled={syncPloomes.isPending}
                title="Sincronizar dados ao vivo do Ploomes"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold text-primary hover:bg-primary/20 disabled:opacity-60 transition shadow-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncPloomes.isPending ? "animate-spin" : ""}`} />
                <span>Sincronizar Ploomes</span>
              </button>

              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                title="Configurar Metas Mensais"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border/60 bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition shadow-xs"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Configurar Metas</span>
              </button>

              <button
                type="button"
                onClick={() => setShowManualModal(true)}
                title="Lançar venda manual"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border/60 bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lançar Venda</span>
              </button>

              <button
                type="button"
                onClick={exportContractsCSV}
                title="Exportar contratos para CSV"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border/60 bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs & Controls Bar */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-border/40 pt-3">
            <div className="inline-flex rounded-xl border border-border/60 bg-muted/60 p-1">
              <button
                onClick={() => setMainTab("metas")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold font-display transition ${
                  mainTab === "metas"
                    ? "bg-card text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                Metas por Filial
              </button>
              <button
                onClick={() => setMainTab("ranking")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold font-display transition ${
                  mainTab === "ranking"
                    ? "bg-card text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Trophy className="h-3.5 w-3.5" />
                Ranking de Vendedores
              </button>
              <button
                onClick={() => setMainTab("contratos")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold font-display transition ${
                  mainTab === "contratos"
                    ? "bg-card text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Contratos Ploomes ({periodSales.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-border/60 bg-muted/60 p-0.5">
                {(["mes", "ano", "tudo"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold font-display transition ${
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
                  aria-label="Mês do painel"
                  type="month"
                  value={activeMonth}
                  onChange={(e) => setMonth(e.target.value || activeMonth)}
                  className="h-8 w-36 rounded-xl border border-border/60 bg-card px-2.5 text-xs text-foreground outline-none focus:border-primary shadow-xs"
                />
              )}

              <select
                aria-label="Filtrar filial"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="h-8 rounded-xl border border-border/60 bg-card px-2.5 text-xs text-foreground outline-none focus:border-primary shadow-xs"
              >
                <option value="todas">Todas as Filiais</option>
                <option value="wenceslau_braz">Sede Wenceslau Braz</option>
                <option value="londrina">Filial Londrina</option>
                <option value="ponta_grossa">Filial Ponta Grossa</option>
                <option value="representantes">Representantes</option>
              </select>

              <div className="relative min-w-[12rem]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar vendedor, código, cliente..."
                  className="h-8 w-full rounded-xl border border-border/60 bg-card pl-8 pr-2.5 text-xs outline-none placeholder:text-muted-foreground focus:border-primary shadow-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-[1440px] px-4 py-5 lg:px-8 space-y-6">
        {/* Executive KPI Ribbon */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Vendas Ganhas (Comercial)"
            realized={brl(unitStats.global.soldTotal)}
            goal={`Meta: ${brlShort(globalGoal.vendas)}`}
            pct={globalSoldPct}
            sub={`${unitStats.global.soldCount} contratos fechados`}
            icon={<DollarSign className="h-4 w-4 text-amber-500" />}
            colorClass="from-amber-500/10 to-transparent border-amber-500/30"
          />
          <KpiCard
            title="Faturamento Confirmado"
            realized={brl(unitStats.global.invoicedTotal)}
            goal={`Meta: ${brlShort(globalGoal.faturamento)}`}
            pct={globalFatPct}
            sub={`${unitStats.global.invoicedCount} contratos confirmados`}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            colorClass="from-emerald-500/10 to-transparent border-emerald-500/30"
          />
          <KpiCard
            title="Prospecção (Novos Leads)"
            realized={`${unitStats.global.prospeccaoCount} leads`}
            goal={`Meta: ${globalGoal.prospeccao} leads`}
            pct={globalProspPct}
            sub="Pipeline Pré-Vendas Ploomes"
            icon={<Sparkles className="h-4 w-4 text-cyan-500" />}
            colorClass="from-cyan-500/10 to-transparent border-cyan-500/30"
          />
          <KpiCard
            title="Ticket Médio Comercial"
            realized={unitStats.global.soldCount > 0 ? brl(unitStats.global.soldTotal / unitStats.global.soldCount) : "R$ 0"}
            goal={`${unitStats.global.soldCount} contratos no período`}
            pct={100}
            sub="Média por projeto solar"
            icon={<TrendingUp className="h-4 w-4 text-purple-500" />}
            colorClass="from-purple-500/10 to-transparent border-purple-500/30"
          />
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm font-semibold">Carregando painel de metas e contratos...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: METAS POR FILIAL */}
            {mainTab === "metas" && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold font-display text-foreground">
                      Desempenho por Unidade & Filiais
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Acompanhamento de metas de prospecção, vendas ganhas e faturamento por praça comercial
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                  {UNIT_KEYS.map((key) => {
                    const label = UNIT_LABEL[key];
                    const st = unitStats[key];
                    const goal = goalsConfig?.units?.[key] ?? { vendas: 1000000, faturamento: 800000, prospeccao: 150, contratos: 20 };
                    const soldPct = goal.vendas > 0 ? (st.soldTotal / goal.vendas) * 100 : 0;
                    const fatPct = goal.faturamento > 0 ? (st.invoicedTotal / goal.faturamento) * 100 : 0;
                    const gap = Math.max(0, goal.vendas - st.soldTotal);

                    return (
                      <div
                        key={key}
                        className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs transition hover:border-primary/40 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary font-bold">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold font-display text-foreground">{label}</h3>
                              <p className="text-[11px] text-muted-foreground">
                                {st.sellers.size} consultor(es) com vendas
                              </p>
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              soldPct >= 100
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : soldPct >= 70
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            {soldPct >= 100 ? "🎯 Meta Batida!" : `${soldPct.toFixed(1)}% da Meta`}
                          </span>
                        </div>

                        {/* Progress Bar Vendas */}
                        <div>
                          <div className="flex items-baseline justify-between text-xs mb-1.5">
                            <span className="font-semibold text-muted-foreground">Vendas Fechadas</span>
                            <span className="font-bold text-foreground font-display">
                              {brl(st.soldTotal)} <span className="text-muted-foreground font-normal">/ {brlShort(goal.vendas)}</span>
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                            <div
                              className={`h-full rounded-full transition-all ${
                                soldPct >= 100 ? "bg-emerald-500" : soldPct >= 70 ? "bg-amber-500" : "bg-primary"
                              }`}
                              style={{ width: `${Math.min(100, soldPct)}%` }}
                            />
                          </div>
                          <div className="mt-1 flex justify-between text-[10.5px] text-muted-foreground">
                            <span>{st.soldCount} contratos</span>
                            <span>{gap > 0 ? `Faltam ${brl(gap)}` : "Superou a meta! 🔥"}</span>
                          </div>
                        </div>

                        {/* Faturamento e Prospecção Grid */}
                        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/40 bg-secondary/30 p-3 text-xs">
                          <div>
                            <span className="text-[10.5px] text-muted-foreground block">Faturamento Realizado</span>
                            <span className="font-bold text-foreground font-display text-sm">
                              {brl(st.invoicedTotal)}
                            </span>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                              Meta: {brlShort(goal.faturamento)} ({fatPct.toFixed(0)}%)
                            </span>
                          </div>
                          <div>
                            <span className="text-[10.5px] text-muted-foreground block">Prospecção / Novos Leads</span>
                            <span className="font-bold text-foreground font-display text-sm">
                              {st.prospeccaoCount} leads
                            </span>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                              Ticket Médio: {st.soldCount > 0 ? brlShort(st.soldTotal / st.soldCount) : "R$ 0"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* TAB 2: RANKING & METAS POR VENDEDOR */}
            {mainTab === "ranking" && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold font-display text-foreground">
                      Ranking & Metas Individuais ({filteredSellers.length} consultores)
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Classificação oficial por volume vendido e atingimento da meta individual do Ploomes
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => syncConsultants.mutate()}
                    disabled={syncConsultants.isPending}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border/60 bg-card text-xs font-semibold text-muted-foreground hover:bg-muted transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncConsultants.isPending ? "animate-spin" : ""}`} />
                    Sincronizar Consultores
                  </button>
                </div>

                {/* Podium Top 3 */}
                {filteredSellers.length >= 3 && (
                  <div className="grid grid-cols-3 gap-2.5 sm:gap-4 max-w-2xl mx-auto">
                    {[filteredSellers[1], filteredSellers[0], filteredSellers[2]].map((s, idx) => {
                      if (!s) return null;
                      const isFirst = idx === 1;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setDetailSellerId(s.id)}
                          className={`relative flex flex-col items-center gap-1.5 rounded-2xl border p-3.5 text-center transition hover:-translate-y-1 active:scale-[0.98] shadow-xs ${
                            isFirst
                              ? "border-amber-500/50 bg-gradient-to-b from-amber-500/20 via-amber-500/5 to-card pt-6 shadow-amber-500/10"
                              : "border-border/60 bg-card pt-5"
                          }`}
                        >
                          {isFirst && (
                            <Crown className="absolute -top-3 h-6 w-6 text-amber-500 fill-amber-500" />
                          )}
                          <span
                            className={`grid place-items-center rounded-full font-display font-bold shadow-xs ${
                              isFirst
                                ? "h-14 w-14 bg-gradient-to-br from-amber-400 to-amber-600 text-sm text-white"
                                : idx === 0
                                  ? "h-11 w-11 bg-slate-200 dark:bg-slate-700 text-xs text-slate-800 dark:text-slate-100"
                                  : "h-11 w-11 bg-amber-100 dark:bg-amber-950 text-xs text-amber-800 dark:text-amber-200"
                            }`}
                          >
                            {initials(s.name)}
                          </span>
                          <span className="w-full truncate text-xs font-bold text-foreground">
                            {s.name}
                          </span>
                          <span className={`font-display text-xs font-bold ${isFirst ? "text-amber-600 dark:text-amber-400 font-extrabold text-sm" : "text-foreground"}`}>
                            {brlShort(s.soldTotal)}
                          </span>
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {s.place}º lugar · {s.pctGoal.toFixed(0)}% da meta
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Seller Ranking Table */}
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border/60 bg-muted/40 font-bold uppercase tracking-wider text-[10.5px] text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-center w-12">#</th>
                          <th className="px-4 py-3">Vendedor</th>
                          <th className="px-4 py-3">Filial</th>
                          <th className="px-4 py-3 text-right">Vendido (R$)</th>
                          <th className="px-4 py-3 text-right">Meta (R$)</th>
                          <th className="px-4 py-3 text-center w-36">% da Meta</th>
                          <th className="px-4 py-3 text-right">Faturado</th>
                          <th className="px-4 py-3 text-center">Contratos</th>
                          <th className="px-4 py-3 text-right">Ticket Médio</th>
                          <th className="px-4 py-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {filteredSellers.map((s) => (
                          <tr key={s.id} className="hover:bg-muted/30 transition">
                            <td className="px-4 py-3 text-center font-bold font-display text-muted-foreground">
                              {s.place}º
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 font-display text-[10.5px] font-bold text-primary">
                                  {initials(s.name)}
                                </span>
                                <span className="font-bold text-foreground">{s.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {s.unit ? (UNIT_LABEL[s.unit] ?? s.unit) : "Sem filial"}
                            </td>
                            <td className="px-4 py-3 text-right font-display font-bold text-primary">
                              {brl(s.soldTotal)}
                            </td>
                            <td className="px-4 py-3 text-right font-display text-muted-foreground">
                              {brlShort(s.goalVendas)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                                  <div
                                    className={`h-full rounded-full ${
                                      s.pctGoal >= 100
                                        ? "bg-emerald-500"
                                        : s.pctGoal >= 70
                                          ? "bg-amber-500"
                                          : "bg-primary"
                                    }`}
                                    style={{ width: `${Math.min(100, s.pctGoal)}%` }}
                                  />
                                </div>
                                <span className="text-[11px] font-bold font-display w-10 text-right">
                                  {s.pctGoal.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-display text-foreground">
                              {brl(s.invoicedTotal)}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold">
                              {s.soldCount}
                            </td>
                            <td className="px-4 py-3 text-right font-display text-muted-foreground">
                              {s.soldCount > 0 ? brlShort(s.avgTicket) : "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => setDetailSellerId(s.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                              >
                                Ver Contratos
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* TAB 3: CARTEIRA DE CONTRATOS PLOOMES */}
            {mainTab === "contratos" && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold font-display text-foreground">
                      Carteira de Contratos Ploomes ({filteredContracts.length} contratos)
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Contratos comerciais fechados e status de liquidação financeira
                    </p>
                  </div>

                  {/* Status Filters */}
                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-xl border border-border/60 bg-muted/60 p-0.5">
                      {(["todos", "faturados", "pendentes"] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => setContractStatus(st)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold font-display transition ${
                            contractStatus === st
                              ? "bg-card text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {st === "todos" ? "Todos" : st === "faturados" ? "Faturados 🟢" : "Aguardando 🟡"}
                        </button>
                      ))}
                    </div>

                    {origins.length > 0 && (
                      <select
                        aria-label="Origem do lead"
                        value={origin}
                        onChange={(e) => setOrigin(e.target.value)}
                        className="h-8 rounded-xl border border-border/60 bg-card px-2.5 text-xs text-foreground outline-none focus:border-primary shadow-xs"
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
                  </div>
                </div>

                {filteredContracts.length === 0 ? (
                  <div className="rounded-2xl border border-border/60 bg-card p-12 text-center text-sm text-muted-foreground shadow-xs">
                    Nenhum contrato encontrado com os filtros selecionados.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-border/60 bg-muted/40 font-bold uppercase tracking-wider text-[10.5px] text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3">Código</th>
                            <th className="px-4 py-3">Cliente / Título</th>
                            <th className="px-4 py-3">Vendedor</th>
                            <th className="px-4 py-3">Filial</th>
                            <th className="px-4 py-3 text-right">Valor</th>
                            <th className="px-4 py-3">Data Venda</th>
                            <th className="px-4 py-3">Faturamento</th>
                            <th className="px-4 py-3">Origem</th>
                            <th className="px-4 py-3 text-center">Ploomes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {filteredContracts.map((c) => {
                            const seller = c.seller_id ? sellerMap.get(c.seller_id) : null;
                            const code = contractCode(c.notes);
                            const title = (c.notes || "Contrato").replace(/^Ploomes:\s*/, "");
                            const ploomesUrl = c.ploomes_deal_id
                              ? `https://app.ploomes.com/#/Deals/${c.ploomes_deal_id}`
                              : null;

                            return (
                              <tr key={c.id} className="hover:bg-muted/30 transition">
                                <td className="px-4 py-3">
                                  {code ? (
                                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold font-mono text-primary">
                                      {code}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-semibold text-foreground max-w-xs truncate" title={title}>
                                  {title}
                                </td>
                                <td className="px-4 py-3 font-medium text-foreground">
                                  {c.ploomes_owner_name || seller?.name || "Sem vendedor"}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {c.branch ? (UNIT_LABEL[c.branch] ?? c.branch) : (seller?.unit ? (UNIT_LABEL[seller.unit] ?? seller.unit) : "—")}
                                </td>
                                <td className="px-4 py-3 text-right font-display font-bold text-primary">
                                  {brl(Number(c.amount))}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {new Date(`${c.sale_date}T12:00:00`).toLocaleDateString("pt-BR")}
                                </td>
                                <td className="px-4 py-3">
                                  {c.invoiced_date ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
                                      <CheckCircle2 className="h-3 w-3" />
                                      {new Date(`${c.invoiced_date}T12:00:00`).toLocaleDateString("pt-BR")}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-bold text-amber-600 dark:text-amber-400">
                                      <Clock className="h-3 w-3" />
                                      Aguardando
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {c.lead_origin || "—"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {ploomesUrl ? (
                                    <a
                                      href={ploomesUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card p-1.5 text-muted-foreground hover:text-primary hover:border-primary transition shadow-xs"
                                      title="Abrir negócio no Ploomes"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* Seller Detail Drawer */}
      {detailSellerId && (
        <SellerSheet
          row={sellerRankings.find((r) => r.id === detailSellerId) ?? null}
          sales={sales.filter((s) => s.seller_id === detailSellerId && (inPeriod(s.sale_date) || inPeriod(s.invoiced_date)))}
          periodLabel={period === "tudo" ? "Histórico Completo" : period === "ano" ? `Ano de ${activeMonth.slice(0, 4)}` : monthLabel}
          onClose={() => setDetailSellerId(null)}
        />
      )}

      {/* Goals Config Modal */}
      {showConfigModal && goalsConfig && (
        <GoalsConfigModal
          initialGoals={goalsConfig}
          sellers={sellers}
          onSave={async (newGoals) => {
            try {
              await saveGoalsFn({ data: newGoals });
              toast.success("Metas atualizadas com sucesso!");
              setShowConfigModal(false);
              qc.invalidateQueries({ queryKey: ["sales-goals-config"] });
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
          onClose={() => setShowConfigModal(false)}
        />
      )}

      {/* Manual Sale Modal */}
      {showManualModal && (
        <ManualSaleModal
          sellers={sellers.filter((s) => s.active)}
          form={form}
          setForm={setForm}
          saving={saveManual.isPending}
          onSave={(v) => saveManual.mutate(v)}
          onClose={() => setShowManualModal(false)}
        />
      )}
    </div>
  );
}

function KpiCard({
  title,
  realized,
  goal,
  pct,
  sub,
  icon,
  colorClass,
}: {
  title: string;
  realized: string;
  goal: string;
  pct: number;
  sub: string;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <div className={`rounded-2xl border bg-gradient-to-b bg-card p-4 shadow-xs ${colorClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-background/80 shadow-xs">
          {icon}
        </div>
      </div>
      <div className="mt-2 font-display text-xl font-bold tracking-tight text-foreground">
        {realized}
      </div>
      <div className="mt-1 flex items-baseline justify-between text-xs text-muted-foreground">
        <span>{goal}</span>
        <span className="font-bold text-foreground font-display">{pct.toFixed(0)}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="mt-1.5 text-[11px] font-medium text-muted-foreground truncate">{sub}</div>
    </div>
  );
}

function SellerSheet({
  row,
  sales,
  periodLabel,
  onClose,
}: {
  row: any;
  sales: Sale[];
  periodLabel: string;
  onClose: () => void;
}) {
  if (!row) return null;
  const ordered = [...sales].sort((a, b) => (a.sale_date < b.sale_date ? 1 : -1));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar gaveta"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl border border-border/60 bg-card shadow-2xl sm:max-w-xl sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-border/60 p-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
            {initials(row.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-sm font-bold text-foreground">{row.name}</h2>
            <p className="text-xs text-muted-foreground">
              {row.place}º lugar no ranking · {row.unit ? (UNIT_LABEL[row.unit] ?? row.unit) : "Sem filial"}
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
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5 text-center">
            <span className="text-[10px] uppercase font-bold text-primary">Vendido</span>
            <div className="font-display text-sm font-bold text-foreground mt-0.5">{brl(row.soldTotal)}</div>
            <span className="text-[10px] text-muted-foreground">{row.soldCount} vendas</span>
          </div>
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-2.5 text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Faturado</span>
            <div className="font-display text-sm font-bold text-foreground mt-0.5">{brl(row.invoicedTotal)}</div>
            <span className="text-[10px] text-muted-foreground">{row.invoicedCount} confirmadas</span>
          </div>
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-2.5 text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Meta Individual</span>
            <div className="font-display text-sm font-bold text-foreground mt-0.5">{brlShort(row.goalVendas)}</div>
            <span className="text-[10px] font-bold text-primary">{row.pctGoal.toFixed(0)}% batida</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground mb-2">
            Contratos no período ({periodLabel})
          </div>
          {ordered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">Nenhum contrato neste período.</p>
          ) : (
            ordered.map((s) => {
              const code = contractCode(s.notes);
              const ploomesUrl = s.ploomes_deal_id
                ? `https://app.ploomes.com/#/Deals/${s.ploomes_deal_id}`
                : null;

              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/40 bg-secondary/20 p-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {code && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                          {code}
                        </span>
                      )}
                      <span className="font-semibold text-foreground truncate">
                        {(s.notes || "Contrato Ploomes").replace(/^Ploomes:\s*/, "")}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Venda: {new Date(`${s.sale_date}T12:00:00`).toLocaleDateString("pt-BR")}{" "}
                      {s.invoiced_date ? ` · Faturado: ${new Date(`${s.invoiced_date}T12:00:00`).toLocaleDateString("pt-BR")}` : " · Aguardando faturamento"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-primary text-xs">
                      {brl(Number(s.amount))}
                    </span>
                    {ploomesUrl && (
                      <a
                        href={ploomesUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-muted-foreground hover:text-primary transition"
                        title="Abrir no Ploomes"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function GoalsConfigModal({
  initialGoals,
  sellers,
  onSave,
  onClose,
}: {
  initialGoals: SalesGoalsConfig;
  sellers: Seller[];
  onSave: (goals: SalesGoalsConfig) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"filiais" | "vendedores">("filiais");
  const [goals, setGoals] = useState<SalesGoalsConfig>(initialGoals);

  const updateUnit = (unitKey: keyof SalesGoalsConfig["units"], field: "vendas" | "faturamento" | "prospeccao", val: number) => {
    setGoals((g) => ({
      ...g,
      units: {
        ...g.units,
        [unitKey]: {
          ...g.units[unitKey],
          [field]: val,
        },
      },
    }));
  };

  const updateGlobal = (field: "vendas" | "faturamento" | "prospeccao", val: number) => {
    setGoals((g) => ({
      ...g,
      global: {
        ...g.global,
        [field]: val,
      },
    }));
  };

  const updateSeller = (sellerName: string, field: "vendas" | "faturamento" | "prospeccao", val: number) => {
    const n = norm(sellerName);
    setGoals((g) => ({
      ...g,
      sellers: {
        ...g.sellers,
        [n]: {
          ...(g.sellers[n] || { vendas: 180000, faturamento: 150000, prospeccao: 25 }),
          [field]: val,
        },
      },
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-3xl border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-display text-foreground">Configurar Metas Mensais</h2>
              <p className="text-xs text-muted-foreground">Ajuste as metas de prospecção, vendas e faturamento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-border/40 px-4 pt-2">
          <div className="inline-flex gap-2">
            <button
              onClick={() => setTab("filiais")}
              className={`pb-2 text-xs font-bold font-display border-b-2 transition ${
                tab === "filiais" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              🏢 Metas por Filial & Global
            </button>
            <button
              onClick={() => setTab("vendedores")}
              className={`pb-2 text-xs font-bold font-display border-b-2 transition ${
                tab === "vendedores" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              👥 Metas por Consultor ({sellers.filter((s) => s.active).length})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === "filiais" ? (
            <div className="space-y-4">
              {/* Global */}
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3.5 space-y-3">
                <span className="text-xs font-bold font-display text-primary uppercase tracking-wider">
                  Consolidado Global LZ7 Solar
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10.5px] font-semibold text-muted-foreground block mb-1">
                      Meta Vendas (R$)
                    </label>
                    <input
                      type="number"
                      value={goals.global.vendas}
                      onChange={(e) => updateGlobal("vendas", Number(e.target.value))}
                      className="h-9 w-full rounded-xl border border-border/60 bg-background px-2.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-semibold text-muted-foreground block mb-1">
                      Meta Faturamento (R$)
                    </label>
                    <input
                      type="number"
                      value={goals.global.faturamento}
                      onChange={(e) => updateGlobal("faturamento", Number(e.target.value))}
                      className="h-9 w-full rounded-xl border border-border/60 bg-background px-2.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-semibold text-muted-foreground block mb-1">
                      Meta Leads Prospecção
                    </label>
                    <input
                      type="number"
                      value={goals.global.prospeccao}
                      onChange={(e) => updateGlobal("prospeccao", Number(e.target.value))}
                      className="h-9 w-full rounded-xl border border-border/60 bg-background px-2.5 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Units */}
              {UNIT_KEYS.map((uk) => (
                <div key={uk} className="rounded-2xl border border-border/60 bg-secondary/20 p-3.5 space-y-3">
                  <span className="text-xs font-bold font-display text-foreground">{UNIT_LABEL[uk]}</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10.5px] font-semibold text-muted-foreground block mb-1">
                        Meta Vendas (R$)
                      </label>
                      <input
                        type="number"
                        value={goals.units[uk].vendas}
                        onChange={(e) => updateUnit(uk, "vendas", Number(e.target.value))}
                        className="h-9 w-full rounded-xl border border-border/60 bg-background px-2.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold text-muted-foreground block mb-1">
                        Meta Faturamento (R$)
                      </label>
                      <input
                        type="number"
                        value={goals.units[uk].faturamento}
                        onChange={(e) => updateUnit(uk, "faturamento", Number(e.target.value))}
                        className="h-9 w-full rounded-xl border border-border/60 bg-background px-2.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold text-muted-foreground block mb-1">
                        Meta Leads
                      </label>
                      <input
                        type="number"
                        value={goals.units[uk].prospeccao}
                        onChange={(e) => updateUnit(uk, "prospeccao", Number(e.target.value))}
                        className="h-9 w-full rounded-xl border border-border/60 bg-background px-2.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {sellers.filter((s) => s.active).map((s) => {
                const n = norm(s.name);
                const g = goals.sellers[n] || { vendas: 180000, faturamento: 150000, prospeccao: 25 };
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-secondary/20 p-2.5 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-foreground block truncate">{s.name}</span>
                      <span className="text-[10.5px] text-muted-foreground">
                        {s.unit ? (UNIT_LABEL[s.unit] ?? s.unit) : "Sem filial"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32">
                        <label className="text-[10px] text-muted-foreground block">Meta Vendas (R$)</label>
                        <input
                          type="number"
                          value={g.vendas}
                          onChange={(e) => updateSeller(s.name, "vendas", Number(e.target.value))}
                          className="h-8 w-full rounded-lg border border-border/60 bg-background px-2 text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border/60 p-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-border/60 bg-card text-xs font-semibold hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(goals)}
            className="h-9 px-4 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            Salvar Metas
          </button>
        </div>
      </div>
    </div>
  );
}

function ManualSaleModal({
  sellers,
  form,
  setForm,
  saving,
  onSave,
  onClose,
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
  saving: boolean;
  onSave: (v: {
    seller_id: string;
    amount: number;
    sale_date: string;
    city: string | null;
    notes: string | null;
  }) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative flex w-full max-w-md flex-col rounded-3xl border border-border/60 bg-card p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold font-display text-foreground">Lançar Venda Manual</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const amount = Number(form.amount.replace(/\./g, "").replace(",", "."));
            if (!form.seller_id) return toast.error("Selecione o vendedor.");
            if (!amount || amount <= 0) return toast.error("Informe o valor.");
            onSave({
              seller_id: form.seller_id,
              amount,
              sale_date: form.sale_date,
              city: form.city || null,
              notes: form.notes || null,
            });
          }}
        >
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Vendedor</label>
            <select
              value={form.seller_id}
              onChange={(e) => setForm((f) => ({ ...f, seller_id: e.target.value }))}
              className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-xs outline-none focus:border-primary"
            >
              <option value="">Selecione o vendedor...</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.unit ? `— ${UNIT_LABEL[s.unit] ?? s.unit}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Valor da Venda (R$)</label>
            <input
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              inputMode="decimal"
              placeholder="Ex: 35000"
              className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-xs outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Data da Venda</label>
            <input
              type="date"
              value={form.sale_date}
              onChange={(e) => setForm((f) => ({ ...f, sale_date: e.target.value }))}
              className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-xs outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Cidade</label>
            <input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="Cidade (opcional)"
              className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-xs outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Observações</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Código do contrato ou notas (opcional)"
              className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-xs outline-none focus:border-primary"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl border border-border/60 bg-card text-xs font-semibold hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-xs disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Registrar Venda
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
