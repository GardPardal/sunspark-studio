import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPriorityCards, type PriorityCard } from "@/modules/hoje/priority.functions";
import { getMyRole } from "@/lib/admin-users.functions";
import { BackendTopBar } from "@/components/backend-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, CheckCircle2, Flame, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({
    meta: [
      { title: "Hoje — Centro de Operações LZ7" },
      { name: "description", content: "O que precisa da sua atenção agora." },
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

function HojePage() {
  const getRole = useServerFn(getMyRole);
  const getCards = useServerFn(getPriorityCards);
  const roleQ = useQuery({ queryKey: ["my_role"], queryFn: () => getRole() });
  const cardsQ = useQuery<PriorityCard[]>({
    queryKey: ["priority_cards"],
    queryFn: () => getCards() as any,
    refetchInterval: 45_000,
  });

  const nome = roleQ.data?.fullName?.split(" ")[0] ?? "";
  const cards = cardsQ.data ?? [];
  const hasNothing = !cardsQ.isLoading && cards.length === 0;

  return (
    <div className="min-h-screen bg-secondary/30 pb-24">
      <BackendTopBar title="Hoje" subtitle="O que precisa da sua atenção agora" />
      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-4 space-y-4">
        <header className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Olá{nome ? `, ${nome}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Prioridades ordenadas por urgência. Um clique para resolver.
          </p>
        </header>

        <nav aria-label="Atalhos rápidos" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { to: "/sdr-leadqualified", label: "Novo lead (SDR)" },
            { to: "/leads", label: "Leads WhatsApp" },
            { to: "/crm", label: "CRM" },
            { to: "/agenda", label: "Agenda" },
          ].map((a) => (
            <Link
              key={a.to}
              to={a.to as any}
              search={{} as any}
              className="shrink-0 rounded-full border bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:bg-accent"
            >
              {a.label}
            </Link>
          ))}
        </nav>


        {cardsQ.isLoading && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/60" />
            ))}
          </div>
        )}

        {hasNothing && (
          <Card className="p-6 flex items-center gap-3 border-emerald-200 bg-emerald-50/70">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <div className="font-semibold">Nada urgente agora.</div>
              <div className="text-sm text-muted-foreground">
                Aproveite para acompanhar sua agenda ou revisar campanhas.
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => {
            const s = SEV_STYLES[c.severity];
            return (
              <Card key={c.key} className={cn("p-4 ring-1 transition hover:shadow-md", s.ring)}>
                <div className="flex items-start gap-3">
                  <div className={cn("rounded-xl px-2.5 py-1.5 text-xs font-bold flex items-center gap-1", s.chip)}>
                    <s.Icon className="h-3.5 w-3.5" /> {c.count}
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

        <footer className="pt-2 text-xs text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          Este painel evolui automaticamente conforme sua rotina — sem menus para memorizar.
        </footer>
      </main>
    </div>
  );
}
