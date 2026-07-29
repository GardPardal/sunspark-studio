import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listWorkflows, type Workflow } from "@/lib/solar-os.functions";
import { ModuleShell } from "@/modules/shared/module-shell";
import { DsCard, DsCardHeader } from "@/components/ds/card";
import { DsBadge } from "@/components/ds/badge";
import { DsEmpty } from "@/components/ds/empty";
import { DsSkeletonList } from "@/components/ds/skeleton";
import { Zap, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/automacoes")({
  head: () => ({
    meta: [
      { title: "Automações — Solar OS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  const fn = useServerFn(listWorkflows);
  const q = useQuery({
    queryKey: ["workflows"],
    queryFn: () => fn() as unknown as Promise<Workflow[]>,
  });

  return (
    <ModuleShell title="Automações" subtitle="Motor de workflows (Trigger → Steps)" active="admin">
      <DsCard>
        <DsCardHeader
          title="Fluxos ativos"
          subtitle="Cada workflow reage a um evento (novo lead, mudança de etapa, tempo) e executa passos automáticos."
        />
        <div className="p-4">
          {q.isLoading ? (
            <DsSkeletonList rows={3} />
          ) : (q.data ?? []).length === 0 ? (
            <DsEmpty
              icon={<Zap className="h-5 w-5" />}
              title="Nenhuma automação configurada"
              description="Comece criando uma regra simples — por exemplo, alertar o SDR quando um lead ficar sem resposta por 2h."
              actionLabel="Criar automação" onAction={() => alert("Editor visual chega em breve.")}
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {(q.data ?? []).map((w) => (
                <li key={w.id} className="flex items-center gap-3 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Zap className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{w.name}</p>
                    {w.description && <p className="truncate text-xs text-muted-foreground">{w.description}</p>}
                  </div>
                  <DsBadge intent={w.active ? "success" : "neutral"}>
                    {w.active ? "Ativo" : "Pausado"}
                  </DsBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DsCard>
    </ModuleShell>
  );
}
