import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ModuleShell } from "@/modules/shared/module-shell";
import { getAuditReport, type AuditReport } from "@/modules/audit/inventory.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Compass, GitBranch, Layers, Route as RouteIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria da plataforma — LZ7" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const fn = useServerFn(getAuditReport);
  const q = useQuery<AuditReport>({
    queryKey: ["audit_report"],
    queryFn: () => fn() as any,
    refetchInterval: 5 * 60_000,
  });
  const d = q.data;

  return (
    <ModuleShell title="Auditoria" subtitle="Inventário vivo do sistema" active="admin">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Activity className="h-4 w-4" /> Atualiza a cada 5min
      </div>

      {q.isLoading && <div className="h-24 animate-pulse rounded-2xl bg-muted/60" />}

      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Rotas" value={d.summary.routes} Icon={RouteIcon} />
            <Stat label="Server fns" value={d.summary.server_functions} Icon={GitBranch} />
            <Stat label="Tabelas" value={d.summary.tables} Icon={Layers} />
            <Stat
              label="Diagnósticos abertos"
              value={d.summary.diagnostics_open}
              Icon={Activity}
              tone="warning"
            />
            <Stat
              label="Erros integração 24h"
              value={d.summary.integrations_error_24h}
              Icon={Activity}
              tone={d.summary.integrations_error_24h ? "danger" : "ok"}
            />
          </div>

          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <Compass className="h-4 w-4" /> Mapa de navegação por objetivo
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {d.navigation_map.map((area) => (
                <div key={area.area} className="rounded-xl border border-border/60 p-3 bg-card">
                  <div className="mb-2 text-sm font-bold text-primary">{area.area}</div>
                  <ul className="space-y-1.5 text-sm">
                    {area.items.map((it) => (
                      <li key={it.label}>
                        <div className="font-medium">{it.label}</div>
                        <div className="text-xs text-muted-foreground">{it.question}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 font-semibold">Inventário de rotas</div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3">Rota</th>
                    <th className="py-1 pr-3">Área</th>
                    <th className="py-1 pr-3">Perfis</th>
                    <th className="py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.routes.map((r) => (
                    <tr key={r.path} className="border-t border-border/50">
                      <td className="py-1.5 pr-3 font-mono text-xs">{r.path}</td>
                      <td className="py-1.5 pr-3">{r.area}</td>
                      <td className="py-1.5 pr-3">{r.audience.join(", ")}</td>
                      <td className="py-1.5">
                        <Badge variant="secondary">{r.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <Card className="p-4">
              <div className="mb-2 font-semibold">Duplicidades a monitorar</div>
              <ul className="space-y-2 text-sm">
                {d.duplicates.map((x, i) => (
                  <li key={i} className="rounded-lg border border-border/60 p-2">
                    <div className="text-xs font-mono text-muted-foreground">{x.kind}</div>
                    <div>{x.items.join("  vs  ")}</div>
                    <div className="text-xs text-muted-foreground">{x.note}</div>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-4">
              <div className="mb-2 font-semibold">Lacunas conhecidas</div>
              <ul className="space-y-2 text-sm">
                {d.gaps.map((g, i) => (
                  <li key={i} className="rounded-lg border border-border/60 p-2">
                    <div className="font-medium">{g.message}</div>
                    <div className="text-xs text-muted-foreground">{g.suggestion}</div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="p-4">
            <div className="mb-2 font-semibold">Saúde técnica (últimas 24h)</div>
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Integrações</div>
                {d.tech_health.integrations_last_24h.length === 0 && (
                  <div>Sem execuções registradas.</div>
                )}
                <ul className="space-y-1">
                  {d.tech_health.integrations_last_24h.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between border-b border-border/40 py-1"
                    >
                      <span>{r.provider}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant={r.status === "error" ? "destructive" : "secondary"}>
                          {r.status}
                        </Badge>
                        <span className="font-mono">{r.count}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">E-mails</div>
                <div>
                  Enviados: <span className="font-mono">{d.tech_health.email_last_24h.total}</span>
                </div>
                <div>
                  Falhas:{" "}
                  <span className="font-mono text-red-600">
                    {d.tech_health.email_last_24h.failed}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </ModuleShell>
  );
}

function Stat({
  label,
  value,
  Icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  Icon: typeof Activity;
  tone?: "neutral" | "warning" | "danger" | "ok";
}) {
  const color =
    tone === "danger"
      ? "text-red-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "ok"
          ? "text-emerald-600"
          : "text-primary";
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </Card>
  );
}
