import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ModuleShell } from "@/modules/shared/module-shell";
import { getPerfilBI, type PerfilBI } from "@/modules/bi/perfil.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/bi")({
  head: () => ({
    meta: [
      { title: "BI — Dashboards por perfil" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: BIModule,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function BIModule() {
  const fn = useServerFn(getPerfilBI);
  const q = useQuery<PerfilBI>({ queryKey: ["mod_bi_perfil"], queryFn: () => fn({ data: {} }) as any, staleTime: 30_000 });

  return (
    <ModuleShell title="Business Intelligence" subtitle="Visão adaptada ao seu perfil" active="bi">
      {q.isLoading && <Card className="p-5">Carregando…</Card>}
      {q.error && <Card className="p-5 text-red-600 text-sm">Erro: {(q.error as Error).message}</Card>}

      {q.data && (
        <>
          <Card className="p-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Perfil: {q.data.role}</Badge>
            <Badge variant={q.data.scope === "global" ? "default" : "secondary"}>
              Escopo: {q.data.scope === "global" ? "Empresa" : "Meus dados"}
            </Badge>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Leads no mês" value={q.data.leads_total} />
            <Kpi label="Novos" value={q.data.leads_novos} />
            <Kpi label="Em atendimento" value={q.data.leads_atendimento} />
            <Kpi label="Vendas" value={q.data.vendas} />
            <Kpi label="Receita" value={brl(q.data.receita)} tone="emerald" />
            <Kpi label="Conversão" value={`${q.data.taxa_conversao_pct.toFixed(1)}%`} tone="emerald" />
            <Kpi label="Agenda hoje" value={q.data.agenda_hoje} />
            <Kpi label="Atrasadas" value={q.data.agenda_atrasada} tone={q.data.agenda_atrasada > 0 ? "amber" : undefined} />
          </div>

          <Card className="p-4">
            <div className="font-semibold mb-2">Continuar em:</div>
            <div className="flex flex-wrap gap-2">
              <Link to="/crm" className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"><ExternalLink className="h-3.5 w-3.5" /> CRM completo</Link>
              <Link to="/agenda" className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-muted/70"><ExternalLink className="h-3.5 w-3.5" /> Agenda</Link>
              {q.data.scope === "global" && (
                <>
                  <Link to="/marketing-hub" className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-muted/70"><ExternalLink className="h-3.5 w-3.5" /> Hub Marketing</Link>
                  <Link to="/coordenacao" className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-muted/70"><ExternalLink className="h-3.5 w-3.5" /> Coordenação</Link>
                </>
              )}
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
