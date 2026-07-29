import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ModuleShell } from "@/modules/shared/module-shell";
import { getSystemHealth, type SystemHealth } from "@/modules/admin/health.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Saúde do Sistema" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminModule,
});

function statusIcon(s: string | null) {
  const v = (s ?? "").toLowerCase();
  if (v === "success" || v === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (v === "error" || v === "fail") return <XCircle className="h-4 w-4 text-red-600" />;
  return <AlertTriangle className="h-4 w-4 text-amber-600" />;
}

function AdminModule() {
  const fn = useServerFn(getSystemHealth);
  const q = useQuery<SystemHealth>({
    queryKey: ["mod_admin_health"],
    queryFn: () => fn({ data: {} }) as any,
    refetchInterval: 60_000,
  });
  const d = q.data;

  return (
    <ModuleShell title="Administração" subtitle="Saúde do sistema em tempo real" active="admin">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Activity className="h-4 w-4" /> Atualiza a cada 60s
      </div>

      {q.isLoading && <Card className="p-5">Carregando…</Card>}
      {q.error && <Card className="p-5 text-red-600 text-sm">Erro: {(q.error as Error).message}</Card>}

      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Leads hoje" value={d.leadsToday} />
            <Kpi label="Campanhas ativas" value={d.activeCampaigns} />
            <Kpi label="E-mails 24h" value={`${d.emails24h.total} (${d.emails24h.failed} falha)`} tone={d.emails24h.failed > 0 ? "amber" : "emerald"} />
            <Kpi label="Erros de integração 24h" value={d.integrationErrors24h} tone={d.integrationErrors24h > 0 ? "amber" : "emerald"} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Sync Meta Ads</h3>
                {statusIcon(d.meta.last_status)}
              </div>
              <div className="text-xs text-muted-foreground">
                Último run: {d.meta.last_run_at ? new Date(d.meta.last_run_at).toLocaleString("pt-BR") : "—"}
              </div>
              <div className="text-sm">{d.meta.last_message ?? "Sem mensagens."}</div>
              {d.meta.items != null && <Badge variant="secondary">Itens: {d.meta.items}</Badge>}
            </Card>
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Webhook Ploomes</h3>
                {statusIcon(d.ploomes.last_status)}
              </div>
              <div className="text-xs text-muted-foreground">
                Último evento: {d.ploomes.last_run_at ? new Date(d.ploomes.last_run_at).toLocaleString("pt-BR") : "—"}
              </div>
              <div className="text-sm">{d.ploomes.last_message ?? "Aguardando eventos."}</div>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Log de integrações (últimos 20)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Quando</th>
                    <th className="text-left px-3 py-2">Provider</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-right px-3 py-2">Itens</th>
                    <th className="text-left px-3 py-2">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {d.syncLog.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2">{l.provider}</td>
                      <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5">{statusIcon(l.status)}{l.status}</span></td>
                      <td className="px-3 py-2 text-right">{l.items_imported}</td>
                      <td className="px-3 py-2 max-w-[420px] truncate" title={l.message ?? ""}>{l.message ?? "—"}</td>
                    </tr>
                  ))}
                  {d.syncLog.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sem eventos recentes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </ModuleShell>
  );
}

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "emerald" | "amber" }) {
  const cls = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${cls}`}>{value}</div>
    </Card>
  );
}
