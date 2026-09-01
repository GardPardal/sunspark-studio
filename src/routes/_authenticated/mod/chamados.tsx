import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClientTickets, type ClientTicket } from "@/lib/solar-os.functions";
import { ModuleShell } from "@/modules/shared/module-shell";
import { DsCard, DsCardHeader } from "@/components/ds/card";
import { DsBadge } from "@/components/ds/badge";
import { DsEmpty } from "@/components/ds/empty";
import { DsSkeletonList } from "@/components/ds/skeleton";
import { LifeBuoy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/chamados")({
  head: () => ({
    meta: [
      { title: "Portal do Cliente — Chamados" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const PRIO: Record<string, "danger" | "warning" | "primary" | "neutral"> = {
  urgent: "danger",
  high: "warning",
  normal: "primary",
  low: "neutral",
};

function Page() {
  const fn = useServerFn(listClientTickets);
  const q = useQuery({
    queryKey: ["client_tickets"],
    queryFn: () => fn() as unknown as Promise<ClientTicket[]>,
  });

  return (
    <ModuleShell
      title="Portal do Cliente"
      subtitle="Chamados abertos por clientes pós-venda"
      active="admin"
    >
      <DsCard>
        <DsCardHeader title="Chamados" subtitle="Suporte e pós-venda" />
        <div className="p-4">
          {q.isLoading ? (
            <DsSkeletonList rows={3} />
          ) : (q.data ?? []).length === 0 ? (
            <DsEmpty
              icon={<LifeBuoy className="h-5 w-5" />}
              title="Nenhum chamado aberto"
              description="Assim que um cliente abrir um chamado pelo portal, ele aparecerá aqui."
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {(q.data ?? []).map((t) => (
                <li key={t.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium">{t.subject}</p>
                    <DsBadge intent={PRIO[t.priority] ?? "neutral"}>{t.priority}</DsBadge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.client_name}
                    {t.client_email ? ` · ${t.client_email}` : ""}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DsCard>
    </ModuleShell>
  );
}
