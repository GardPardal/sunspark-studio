import { createFileRoute, Link } from "@tanstack/react-router";
import { ModuleShell, MODULES } from "@/modules/shared/module-shell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/mod/")({
  head: () => ({
    meta: [
      { title: "Módulos — SO Comercial LZ7" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ModIndex,
});

function ModIndex() {
  return (
    <ModuleShell title="Sistema Operacional Comercial" subtitle="Escolha um módulo" active="">
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 to-transparent p-5">
        <h1 className="font-display text-xl font-semibold">Módulos independentes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          CRM, Marketing, IA, BI, Financeiro e Administração. Nada foi substituído — tudo o que já funciona continua no mesmo lugar. Os módulos adicionam camadas de análise, saúde e inteligência sobre os dados existentes.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link key={m.key} to={m.to} className="block">
            <Card className="p-4 hover:shadow-md transition h-full">
              <div className="flex items-start gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-xl bg-muted/60 ${m.tone}`}>
                  <m.Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="font-semibold">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.hint}</div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </ModuleShell>
  );
}
