import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSystemHealth, type HealthRow } from "@/lib/solar-os.functions";
import { ModuleShell } from "@/modules/shared/module-shell";
import { DsCard, DsCardHeader } from "@/components/ds/card";
import { DsBadge } from "@/components/ds/badge";
import { DsSkeletonList } from "@/components/ds/skeleton";
import { Activity, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mod/saude")({
  head: () => ({
    meta: [
      { title: "Saúde do Sistema — Solar OS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SaudePage,
});

const SERVICE_LABEL: Record<string, string> = {
  db: "Banco de Dados",
  auth: "Autenticação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  meta: "Meta Ads",
  google: "Google Calendar",
  ai: "LIZ (IA)",
  webhook: "Webhooks",
};

const STATUS_STYLE: Record<string, { tone: string; Icon: typeof Activity; label: string }> = {
  ok: { tone: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30", Icon: CheckCircle2, label: "Operacional" },
  warn: { tone: "text-amber-700 bg-amber-500/10 border-amber-500/30", Icon: AlertTriangle, label: "Alerta" },
  down: { tone: "text-red-700 bg-red-500/10 border-red-500/30", Icon: XCircle, label: "Fora do ar" },
  unknown: { tone: "text-muted-foreground bg-muted border-border", Icon: HelpCircle, label: "Desconhecido" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

function SaudePage() {
  const fn = useServerFn(listSystemHealth);
  const q = useQuery({
    queryKey: ["system_health"],
    queryFn: () => fn() as unknown as Promise<HealthRow[]>,
    refetchInterval: 60_000,
  });

  const rows = q.data ?? [];
  const okCount = rows.filter((r) => r.status === "ok").length;
  const downCount = rows.filter((r) => r.status === "down").length;

  return (
    <ModuleShell title="Saúde do Sistema" subtitle="Status vivo das integrações" active="admin">
      <div className="grid gap-3 sm:grid-cols-3">
        <DsCard><div className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Serviços monitorados</p><p className="mt-1 font-display text-2xl font-semibold">{rows.length}</p></div></DsCard>
        <DsCard><div className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Operacionais</p><p className="mt-1 font-display text-2xl font-semibold text-emerald-700">{okCount}</p></div></DsCard>
        <DsCard><div className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Fora do ar</p><p className={cn("mt-1 font-display text-2xl font-semibold", downCount > 0 ? "text-red-700" : "text-muted-foreground")}>{downCount}</p></div></DsCard>
      </div>

      <DsCard>
        <DsCardHeader title="Integrações" subtitle="Atualizado automaticamente a cada minuto" />
        <div className="divide-y divide-border/60">
          {q.isLoading && (
            <div className="p-4"><DsSkeletonList rows={5} /></div>
          )}
          {!q.isLoading && rows.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum serviço registrado ainda.</p>
          )}
          {rows.map((r) => {
            const style = STATUS_STYLE[r.status] ?? STATUS_STYLE.unknown;
            return (
              <div key={r.id} className="flex items-center gap-4 px-4 py-3">
                <span className={cn("grid h-10 w-10 place-items-center rounded-xl border", style.tone)}>
                  <style.Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{SERVICE_LABEL[r.service] ?? r.service}</p>
                    <DsBadge intent={r.status === "ok" ? "success" : r.status === "down" ? "danger" : r.status === "warn" ? "warning" : "neutral"}>
                      {style.label}
                    </DsBadge>
                  </div>
                  {r.message && <p className="truncate text-xs text-muted-foreground">{r.message}</p>}
                </div>
                <div className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">
                  {r.latency_ms != null && <div>{r.latency_ms}ms</div>}
                  <div>{timeAgo(r.last_checked_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </DsCard>
    </ModuleShell>
  );
}
