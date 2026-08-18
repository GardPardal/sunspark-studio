import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTodayBoard } from "@/modules/hoje/today.functions";
import { getPriorityCards, type PriorityCard } from "@/modules/hoje/priority.functions";
import { getMyRole } from "@/lib/admin-users.functions";
import { BackendTopBar } from "@/components/backend-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Flame, Info, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClienteCard, EmptyState, InteractionDialog } from "@/modules/clientes/ui";
import type { ClienteRow } from "@/modules/clientes/shared";
import { FloatingNotes } from "@/components/solar/floating-notes";


export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({
    meta: [
      { title: "Hoje — Centro de Operações LZ7" },
      { name: "description", content: "A fila do seu dia: quem contatar agora, seus compromissos e o resultado do mês." },
      { property: "og:title", content: "Hoje — Centro de Operações LZ7" },
      { property: "og:description", content: "Faça agora: fila priorizada de clientes, agenda do dia e metas do mês." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: HojePage,
});

const SEV_STYLES: Record<PriorityCard["severity"], { chip: string; ring: string; Icon: typeof Info }> = {
  critical: { chip: "bg-red-600 text-white", ring: "ring-red-500/30", Icon: Flame },
  error: { chip: "bg-red-500 text-white", ring: "ring-red-500/25", Icon: AlertTriangle },
  warning: { chip: "bg-amber-500 text-white", ring: "ring-amber-500/25", Icon: AlertTriangle },
  info: { chip: "bg-primary text-primary-foreground", ring: "ring-primary/20", Icon: Info },
};

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function HojePage() {
  const [target, setTarget] = useState<ClienteRow | null>(null);

  const getRole = useServerFn(getMyRole);
  const getBoard = useServerFn(getTodayBoard);
  const getCards = useServerFn(getPriorityCards);

  const roleQ = useQuery({ queryKey: ["my_role"], queryFn: () => getRole() });
  const boardQ = useQuery({
    queryKey: ["today_board"],
    queryFn: () => getBoard({ data: undefined }) as any,
    refetchInterval: 60_000,
  });
  const cardsQ = useQuery<PriorityCard[]>({
    queryKey: ["priority_cards"],
    queryFn: () => getCards() as any,
    refetchInterval: 60_000,
  });

  const nome = roleQ.data?.fullName?.split(" ")[0] ?? "";
  const s = boardQ.data?.summary;
  const queue: ClienteRow[] = boardQ.data?.queue ?? [];
  const appts: any[] = boardQ.data?.appointments ?? [];
  const cards = cardsQ.data ?? [];

  const stats = [
    { label: "Novos", value: s?.novos ?? 0, to: "/clientes" },
    { label: "Retornar", value: s?.retorno ?? 0, to: "/clientes" },
    { label: "Follow-up", value: s?.followups ?? 0, to: "/clientes" },
    { label: "Compromissos", value: s?.compromissos ?? 0, to: "/agenda" },
  ];

  return (
    <div className="min-h-screen bg-secondary/30 pb-24">
      <BackendTopBar title="Hoje" subtitle="Sua fila de trabalho" />
      <main className="mx-auto max-w-4xl space-y-5 px-3 py-4 sm:px-4">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Olá{nome ? `, ${nome}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Comece pelo topo da lista. Cada card já traz a próxima ação.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((st) => (
            <Link key={st.label} to={st.to as any} className="block">
              <Card className="p-3 transition hover:shadow-md">
                <div className="font-display text-2xl font-semibold tabular-nums">{st.value}</div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{st.label}</div>
              </Card>
            </Link>
          ))}
        </div>

        {s && (s.vendasMes > 0 || s.faturamentoMes > 0) && (
          <Card className="flex items-center justify-between gap-3 border-emerald-500/25 bg-emerald-500/5 p-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Seu mês
              </div>
              <div className="font-display text-lg font-semibold">{BRL(s.faturamentoMes)}</div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              {s.vendasMes} venda{s.vendasMes === 1 ? "" : "s"}
            </div>
          </Card>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Faça agora</h2>
            <Button asChild size="sm" variant="ghost">
              <Link to="/clientes">
                Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {boardQ.isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/60" />
              ))}
            </div>
          )}

          {!boardQ.isLoading && queue.length === 0 && (
            <EmptyState
              title="Nada pendente agora"
              description="Você está em dia. Aproveite para revisar sua agenda ou prospectar novos clientes."
              action={
                <Button asChild size="sm" className="gap-1.5">
                  <Link to="/sdr-leadqualified">
                    <Plus className="h-4 w-4" /> Cadastrar novo lead
                  </Link>
                </Button>
              }
            />
          )}

          {queue.map((c) => (
            <ClienteCard key={c.id} c={c} onRegister={setTarget} highlight />
          ))}
        </section>

        {appts.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold">Agenda de hoje</h2>
            <Card className="divide-y">
              {appts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {hora(a.starts_at)}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        )}

        {cards.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold">Alertas da operação</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {cards.map((c) => {
                const sv = SEV_STYLES[c.severity];
                return (
                  <Card key={c.key} className={cn("p-4 ring-1 transition hover:shadow-md", sv.ring)}>
                    <div className="flex items-start gap-3">
                      <div className={cn("flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold", sv.chip)}>
                        <sv.Icon className="h-3.5 w-3.5" /> {c.count}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold leading-tight">{c.title}</div>
                        <div className="text-sm text-muted-foreground">{c.detail}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button asChild size="sm" variant="secondary">
                        <Link to={c.actionTo as any} search={c.actionSearch as any}>
                          {c.actionLabel} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <footer className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Tudo que você registra aqui atualiza automaticamente o CRM, a cadência e os relatórios.
        </footer>
      </main>

      <InteractionDialog open={!!target} onOpenChange={(v) => !v && setTarget(null)} cliente={target} />
      <FloatingNotes />

    </div>
  );
}
