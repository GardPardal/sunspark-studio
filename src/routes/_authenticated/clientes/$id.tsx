import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BackendTopBar } from "@/components/backend-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarDays, CheckCircle2, History, User2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCliente } from "@/modules/clientes/clientes.functions";
import { STAGE_LABEL } from "@/modules/clientes/clientes.server";
import { EmptyState, InteractionDialog, QuickActions, STAGE_TONE, relTime } from "@/modules/clientes/ui";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do cliente — Solar OS LZ7" },
      { name: "description", content: "Ficha 360° do cliente: dados, próxima ação, agenda e histórico completo." },
      { property: "og:title", content: "Ficha do cliente — Solar OS LZ7" },
      { property: "og:description", content: "Tudo sobre o cliente em uma página, com ações rápidas." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ClienteFicha,
});

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ClienteFicha() {
  const { id } = Route.useParams();
  const [dlg, setDlg] = useState(false);
  const get = useServerFn(getCliente);
  const q = useQuery({
    queryKey: ["cliente", id],
    queryFn: () => get({ data: { id } }) as any,
  });

  const lead = q.data?.lead;
  const raw = q.data?.raw;

  return (
    <div className="min-h-screen bg-secondary/30 pb-24">
      <BackendTopBar title="Ficha do cliente" subtitle="Tudo em um só lugar" />
      <main className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:px-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
          <Link to="/clientes">
            <ArrowLeft className="h-4 w-4" /> Voltar para Clientes
          </Link>
        </Button>

        {q.isLoading && <div className="h-40 animate-pulse rounded-2xl bg-muted/60" />}

        {q.isError && (
          <EmptyState
            title="Cliente indisponível"
            description="Não foi possível abrir esta ficha. Verifique se o cliente ainda está atribuído a você."
            action={<Button onClick={() => q.refetch()}>Tentar de novo</Button>}
          />
        )}

        {lead && (
          <>
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="font-display text-xl font-semibold tracking-tight">{lead.nome}</h1>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {[lead.cidade, lead.estado].filter(Boolean).join(" · ") || "Sem cidade informada"}
                  </div>
                </div>
                <Badge className={cn("border-0 text-[10px] font-bold uppercase", STAGE_TONE[lead.stage] ?? "")}>
                  {STAGE_LABEL[lead.stage] ?? lead.stage}
                </Badge>
              </div>

              {lead.next_action && (
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary">Próxima ação</div>
                  <div className="text-sm font-semibold">{lead.next_action}</div>
                  {lead.next_action_at && (
                    <div className="text-xs text-muted-foreground">{relTime(lead.next_action_at)}</div>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <QuickActions cliente={lead} size="default" />
                <Button variant="secondary" className="gap-1.5" onClick={() => setDlg(true)}>
                  <CheckCircle2 className="h-4 w-4" /> Registrar interação
                </Button>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                {[
                  ["Telefone", lead.telefone],
                  ["E-mail", raw?.email || "—"],
                  ["Conta de luz", lead.valor_conta || "—"],
                  ["Origem", lead.origem || "—"],
                  ["Responsável", q.data?.ownerName || "Sem responsável"],
                  ["Criado em", fmtDate(lead.created_at)],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="font-medium break-words">{v as string}</dd>
                  </div>
                ))}
              </dl>

              {raw?.mensagem && (
                <p className="mt-4 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">{raw.mensagem}</p>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold">
                <CalendarDays className="h-4 w-4 text-primary" /> Agenda
              </h2>
              {(q.data?.appointments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum compromisso com este cliente.</p>
              ) : (
                <ul className="space-y-2">
                  {q.data.appointments.map((a: any) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2 text-sm">
                      <span className="truncate font-medium">{a.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(a.starts_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold">
                <History className="h-4 w-4 text-primary" /> Histórico
              </h2>
              {(q.data?.timeline ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda não há registros para este cliente.</p>
              ) : (
                <ol className="relative space-y-4 border-l pl-4">
                  {q.data.timeline.map((e: any) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <div className="text-sm font-semibold">{e.title}</div>
                      {e.summary && <div className="text-sm text-muted-foreground">{e.summary}</div>}
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{fmtDate(e.ts)}</span>
                        {e.actor_name && (
                          <span className="inline-flex items-center gap-1">
                            <User2 className="h-3 w-3" /> {e.actor_name}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </>
        )}
      </main>

      <InteractionDialog open={dlg} onOpenChange={setDlg} cliente={lead ? { id: lead.id, nome: lead.nome } : null} />
    </div>
  );
}
