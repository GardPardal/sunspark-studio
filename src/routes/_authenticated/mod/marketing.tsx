import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ModuleShell } from "@/modules/shared/module-shell";
import {
  runCampaignDiagnostico,
  type DiagnosticoResp,
} from "@/modules/marketing/diagnostico.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, Zap, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing — Diagnóstico Inteligente" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MarketingModule,
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function MarketingModule() {
  const fn = useServerFn(runCampaignDiagnostico);
  const q = useQuery<DiagnosticoResp>({
    queryKey: ["mod_mkt_diag"],
    queryFn: () => fn() as any,
    staleTime: 60_000,
  });

  return (
    <ModuleShell
      title="Marketing"
      subtitle="Diagnóstico automático de campanhas"
      active="marketing"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/marketing-hub"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Abrir Hub de Marketing
        </Link>
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-muted/70"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Painel Meta Ads (Admin)
        </Link>
      </div>

      {q.isLoading && <Card className="p-5">Analisando campanhas…</Card>}
      {q.error && (
        <Card className="p-5 text-red-600 text-sm">Erro: {(q.error as Error).message}</Card>
      )}

      {q.data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <SumCard tone="red" label="Críticos" value={q.data.summary.critical} />
            <SumCard tone="amber" label="Atenção" value={q.data.summary.warning} />
            <SumCard tone="blue" label="Info" value={q.data.summary.info} />
          </div>

          <Card className="p-4">
            <div className="text-xs text-muted-foreground">
              Período analisado: {q.data.from} → {q.data.to} · {q.data.alerts.length} alertas
              encontrados
            </div>
          </Card>

          <div className="space-y-3">
            {q.data.alerts.length === 0 && (
              <Card className="p-6 text-sm text-muted-foreground text-center">
                Nenhum problema detectado no período. Boa gestão!
              </Card>
            )}
            {q.data.alerts.map((a, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${sevBg(a.severity)}`}
                  >
                    {a.severity === "critical" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : a.severity === "warning" ? (
                      <TrendingDown className="h-5 w-5" />
                    ) : (
                      <Zap className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={sevBadge(a.severity)}>{a.severity.toUpperCase()}</Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {a.kind.replace(/_/g, " ")}
                      </Badge>
                      <span className="font-semibold truncate">{a.campaign_name}</span>
                    </div>
                    <div className="text-sm">
                      <b>O que:</b> {a.o_que}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <b>Por quê:</b> {a.por_que}
                    </div>
                    <div className="text-sm">
                      <b>Impacto:</b> {a.impacto}
                    </div>
                    <div className="text-sm text-emerald-700">
                      <b>Ação:</b> {a.acao}
                    </div>
                    {a.ganho_estimado_brl != null && a.ganho_estimado_brl > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Ganho/economia estimada: <b>{brl(a.ganho_estimado_brl)}</b>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </ModuleShell>
  );
}

function sevBg(s: string) {
  return s === "critical"
    ? "bg-red-100 text-red-700"
    : s === "warning"
      ? "bg-amber-100 text-amber-700"
      : "bg-blue-100 text-blue-700";
}
function sevBadge(s: string) {
  return s === "critical"
    ? "bg-red-600 hover:bg-red-600"
    : s === "warning"
      ? "bg-amber-600 hover:bg-amber-600"
      : "bg-blue-600 hover:bg-blue-600";
}

function SumCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "blue";
}) {
  const cls =
    tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-blue-700";
  return (
    <Card className="p-3 text-center">
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </Card>
  );
}
