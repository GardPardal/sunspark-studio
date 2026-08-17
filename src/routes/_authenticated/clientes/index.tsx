import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BackendTopBar } from "@/components/backend-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { listClientes } from "@/modules/clientes/clientes.functions";
import { CLIENT_FILTERS, type ClienteRow } from "@/modules/clientes/clientes.server";
import { ClienteCard, EmptyState, InteractionDialog } from "@/modules/clientes/ui";

export const Route = createFileRoute("/_authenticated/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — Solar OS LZ7" },
      { name: "description", content: "Todos os seus clientes e leads em uma visão única, com a próxima ação de cada um." },
      { property: "og:title", content: "Clientes — Solar OS LZ7" },
      { property: "og:description", content: "Visão comercial única: leads e clientes com próxima ação recomendada." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const [filter, setFilter] = useState("todos");
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"meus" | "todos">("meus");
  const [target, setTarget] = useState<ClienteRow | null>(null);

  const list = useServerFn(listClientes);
  const query = useQuery({
    queryKey: ["clientes", filter, q, scope],
    queryFn: () => list({ data: { filter, q, scope } }) as any,
    staleTime: 15_000,
  });

  const rows: ClienteRow[] = query.data?.rows ?? [];
  const counts: Record<string, number> = query.data?.counts ?? {};
  const canSeeAll = !!query.data?.canSeeAll;

  const filters = useMemo(() => CLIENT_FILTERS, []);

  return (
    <div className="min-h-screen bg-secondary/30 pb-24">
      <BackendTopBar title="Clientes" subtitle="Sua visão comercial completa" />
      <main className="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, telefone ou cidade"
              className="h-11 pl-9"
            />
          </div>
          {canSeeAll && (
            <Button
              variant={scope === "todos" ? "default" : "secondary"}
              className="h-11 gap-1.5"
              onClick={() => setScope(scope === "todos" ? "meus" : "todos")}
            >
              <Users className="h-4 w-4" /> {scope === "todos" ? "Toda a equipe" : "Só os meus"}
            </Button>
          )}
        </div>

        <nav aria-label="Filtros" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition",
                filter === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {f.label}
              {counts[f.key] != null && <span className="ml-1.5 opacity-70">{counts[f.key]}</span>}
            </button>
          ))}
        </nav>

        {query.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/60" />
            ))}
          </div>
        )}

        {query.isError && (
          <EmptyState
            title="Não foi possível carregar seus clientes"
            description="Tente novamente em instantes. Se persistir, avise a administração."
            action={<Button onClick={() => query.refetch()}>Tentar de novo</Button>}
          />
        )}

        {!query.isLoading && !query.isError && rows.length === 0 && (
          <EmptyState
            title="Nenhum cliente neste filtro"
            description="Assim que novos leads forem distribuídos para você, eles aparecerão aqui automaticamente."
            action={<Button variant="secondary" onClick={() => setFilter("todos")}>Ver todos</Button>}
          />
        )}

        <div className="space-y-3">
          {rows.map((c) => (
            <ClienteCard key={c.id} c={c} onRegister={setTarget} />
          ))}
        </div>
      </main>

      <InteractionDialog open={!!target} onOpenChange={(v) => !v && setTarget(null)} cliente={target} />
    </div>
  );
}
