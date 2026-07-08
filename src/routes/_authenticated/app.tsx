import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import {
  Inbox,
  Flame,
  CalendarClock,
  PhoneOff,
  TrendingUp,
  UserPlus,
  Users,
  Smartphone,
  ChevronRight,
} from "lucide-react";
import { listCrmLeads } from "@/lib/crm.functions";
import { getMyRole } from "@/lib/admin-users.functions";
import { BackendTopBar } from "@/components/backend-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Hoje — LZ7 Consultor" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: HubPage,
});

type Tile = {
  key: string;
  label: string;
  hint: string;
  Icon: typeof Inbox;
  to: string;
  search?: Record<string, string>;
  count: number;
  urgent?: boolean;
  tone: "primary" | "danger" | "amber" | "emerald" | "slate";
};

const TONE_STYLES: Record<Tile["tone"], { bg: string; ring: string; icon: string; badge: string }> = {
  primary: { bg: "bg-primary/10", ring: "ring-primary/20", icon: "text-primary", badge: "bg-primary text-primary-foreground" },
  danger: { bg: "bg-red-500/10", ring: "ring-red-500/25", icon: "text-red-600", badge: "bg-red-600 text-white" },
  amber: { bg: "bg-amber-500/12", ring: "ring-amber-500/25", icon: "text-amber-600", badge: "bg-amber-600 text-white" },
  emerald: { bg: "bg-emerald-500/12", ring: "ring-emerald-500/25", icon: "text-emerald-700", badge: "bg-emerald-600 text-white" },
  slate: { bg: "bg-slate-500/10", ring: "ring-slate-500/20", icon: "text-slate-600", badge: "bg-slate-700 text-white" },
};

function HubPage() {
  const getRole = useServerFn(getMyRole);
  const roleQ = useQuery({ queryKey: ["my_role"], queryFn: () => getRole() });
  const fetchLeads = useServerFn(listCrmLeads);
  const leadsQ = useQuery({
    queryKey: ["crm_leads"],
    queryFn: () => fetchLeads() as any,
    refetchInterval: 30000,
    staleTime: 0,
  });

  const myId = roleQ.data?.userId;
  const nome = roleQ.data?.fullName?.split(" ")[0] ?? "consultor";
  const leads = (leadsQ.data as any[]) ?? [];

  const stats = useMemo(() => {
    const meus = leads.filter((l) => l.assigned_to === myId);
    const fila = leads.filter((l) => !l.assigned_to);
    const emergencia = meus.filter((l) => l.is_prioridade_emergencia);
    const now = Date.now();
    const agenda = meus.filter(
      (l) => l.atendimento_deadline && !l.atendimento_confirmado_at,
    );
    const atrasados = agenda.filter((l) => new Date(l.atendimento_deadline).getTime() < now);
    const naoAtendido = meus.filter((l) => l.stage === "nao_atendido");
    const novos = meus.filter((l) => l.stage === "novo");
    const mesInicio = new Date();
    mesInicio.setDate(1); mesInicio.setHours(0, 0, 0, 0);
    const vendasMes = meus.filter(
      (l) => (l.stage === "venda" || l.stage === "faturado") &&
        new Date(l.stage_updated_at ?? l.created_at) >= mesInicio,
    );
    return { meus, fila, emergencia, agenda, atrasados, naoAtendido, novos, vendasMes };
  }, [leads, myId]);

  const tiles: Tile[] = [
    {
      key: "emergencia",
      label: "Emergências",
      hint: "Prioridade máxima — ligar já",
      Icon: Flame,
      to: "/crm",
      count: stats.emergencia.length,
      urgent: stats.emergencia.length > 0,
      tone: "danger",
    },
    {
      key: "agenda",
      label: "Minha agenda",
      hint: stats.atrasados.length ? `${stats.atrasados.length} vencendo/atrasado` : "Confirmar atendimentos (2h)",
      Icon: CalendarClock,
      to: "/crm",
      count: stats.agenda.length,
      urgent: stats.atrasados.length > 0,
      tone: "amber",
    },
    {
      key: "novos",
      label: "Novos leads",
      hint: "Recebidos, ainda não atendidos",
      Icon: Inbox,
      to: "/crm",
      count: stats.novos.length,
      tone: "primary",
    },
    {
      key: "followup",
      label: "Não atendido",
      hint: "Retornar a ligação",
      Icon: PhoneOff,
      to: "/crm",
      count: stats.naoAtendido.length,
      tone: "slate",
    },
    {
      key: "vendas",
      label: "Vendas no mês",
      hint: "Fechadas + faturadas",
      Icon: TrendingUp,
      to: "/crm",
      count: stats.vendasMes.length,
      tone: "emerald",
    },
    {
      key: "fila",
      label: "Fila (sem dono)",
      hint: "Distribuição SDR",
      Icon: Users,
      to: "/crm",
      count: stats.fila.length,
      tone: "primary",
    },
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <BackendTopBar title={`Olá, ${nome}`} subtitle="O que precisa da sua atenção hoje" />

      <main className="mx-auto max-w-3xl px-4 py-4 space-y-5">
        {/* CTA principal: cadastrar lead */}
        <Link
          to="/crm"
          className="group flex items-center gap-3 rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-4 text-primary-foreground shadow-lg shadow-primary/20 active:scale-[0.99] transition"
        >
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary-foreground/15 ring-1 ring-primary-foreground/25">
            <UserPlus className="h-6 w-6" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-display text-base font-semibold leading-tight">Cadastrar novo lead</span>
            <span className="block text-xs text-primary-foreground/80">Presencial · rua · visita</span>
          </span>
          <ChevronRight className="h-5 w-5 opacity-80" />
        </Link>

        {/* Grid de módulos com badges estilo notificação */}
        <section aria-label="Funções">
          <h2 className="mb-2 px-1 font-display text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
            Suas funções
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((t) => {
              const tone = TONE_STYLES[t.tone];
              const hasBadge = t.count > 0;
              return (
                <Link
                  key={t.key}
                  to={t.to}
                  className={cn(
                    "relative flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm active:scale-[0.98] transition",
                    t.urgent && "ring-2 ring-red-500/40",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span className={cn("grid h-10 w-10 place-items-center rounded-xl ring-1", tone.bg, tone.ring)}>
                      <t.Icon className={cn("h-5 w-5", tone.icon)} />
                    </span>
                    {hasBadge && (
                      <span
                        className={cn(
                          "min-w-[22px] rounded-full px-1.5 text-center text-[11px] font-bold leading-[22px] shadow-sm",
                          tone.badge,
                          t.urgent && "animate-pulse",
                        )}
                      >
                        {t.count > 99 ? "99+" : t.count}
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="font-display text-[14px] font-semibold leading-tight text-foreground">{t.label}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">{t.hint}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Link discreto para baixar app */}
        <Link
          to="/baixar-app"
          className="mt-2 flex items-center justify-between rounded-xl border border-dashed border-border/70 bg-transparent px-3 py-2.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Smartphone className="h-3.5 w-3.5" />
            App Android (beta)
          </span>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
        </Link>
      </main>
    </div>
  );
}
