import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ModuleShell } from "@/modules/shared/module-shell";
import { generateInsights, getInsightsBundlePreview, type InsightResponse } from "@/modules/ia/insights.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/ia")({
  head: () => ({
    meta: [
      { title: "IA — Motor de Insights" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: IAModule,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function IAModule() {
  const preview = useServerFn(getInsightsBundlePreview);
  const gen = useServerFn(generateInsights);
  const pv = useQuery({ queryKey: ["ia_preview"], queryFn: () => preview() as any });
  const m = useMutation<InsightResponse>({ mutationFn: () => gen() as any });

  return (
    <ModuleShell title="Motor de IA" subtitle="Insights baseados em dados reais dos últimos 30 dias" active="ia">
      <Card className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="font-semibold">Análise cruzada Marketing × CRM × Financeiro</h2>
            <p className="text-sm text-muted-foreground">
              A IA lê seus dados reais (não invente) e devolve o que fazer, por quê e o impacto estimado.
              {pv.data && (
                <> Bundle atual: <b>{pv.data.leadsCount}</b> leads · <b>{pv.data.metaRows}</b> linhas Meta desde {pv.data.periodo}.</>
              )}
            </p>
          </div>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Analisando…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Gerar insights</>}
          </Button>
        </div>
      </Card>

      {m.error && <Card className="p-5 text-red-600 text-sm">Erro: {(m.error as Error).message}</Card>}

      {m.data && (
        <>
          {m.data.bundle_summary && (
            <Card className="p-4 border-l-4 border-l-amber-500">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Resumo do momento</div>
              <p className="text-sm">{m.data.bundle_summary}</p>
            </Card>
          )}
          <div className="grid gap-3">
            {m.data.insights.map((i, idx) => (
              <Card key={idx} className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={i.prioridade === "alta" ? "bg-red-600" : i.prioridade === "media" ? "bg-amber-600" : "bg-slate-500"}>
                    {i.prioridade.toUpperCase()}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] uppercase">{i.categoria}</Badge>
                  <span className="font-semibold">{i.o_que}</span>
                </div>
                <div className="text-sm text-muted-foreground"><b>Por quê:</b> {i.por_que}</div>
                <div className="text-sm"><b>Impacto:</b> {i.impacto}</div>
                <div className="text-sm text-emerald-700"><b>Ação:</b> {i.acao}</div>
                {i.ganho_estimado_brl != null && i.ganho_estimado_brl > 0 && (
                  <div className="text-xs text-muted-foreground">Ganho estimado: <b>{brl(i.ganho_estimado_brl)}</b></div>
                )}
              </Card>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground text-right">
            Gerado em {new Date(m.data.generated_at).toLocaleString("pt-BR")} · Modelo: IA LZ7
          </div>
        </>
      )}
    </ModuleShell>
  );
}
