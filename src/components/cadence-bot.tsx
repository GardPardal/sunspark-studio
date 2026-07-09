import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, X, Clock, CalendarCheck, Info, MessageSquare } from "lucide-react";
import { getMyCadenceStatus } from "@/lib/cadence-bot.functions";

export function CadenceBot() {
  const [open, setOpen] = useState(false);
  const getFn = useServerFn(getMyCadenceStatus);
  const { data } = useQuery({
    queryKey: ["cadence-status"],
    queryFn: () => getFn(),
    refetchInterval: 60000,
  });

  const totalPending = (data?.stats.overdue ?? 0) + (data?.stats.today ?? 0);

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed left-4 bottom-[calc(env(safe-area-inset-bottom)+88px)] sm:bottom-6 sm:left-auto sm:right-24 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition"
        aria-label="Assistente de cadência"
      >
        <Bot className="h-6 w-6" />
        {totalPending > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
            {totalPending}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 bottom-[calc(env(safe-area-inset-bottom)+160px)] sm:left-auto sm:right-24 sm:bottom-24 z-50 w-auto sm:w-[min(95vw,380px)]">
          <Card className="p-0 overflow-hidden border-primary/30 shadow-2xl">
            <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <div>
                  <div className="text-sm font-semibold leading-none">Assistente LZ7</div>
                  <div className="text-[10px] opacity-80 mt-0.5">Cadência e boas práticas</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="hover:bg-white/20 rounded p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3 text-sm bg-secondary/20">
              <Bubble>
                Oi! 👋 Eu te ajudo a manter a cadência em dia. Vamos ver como você está?
              </Bubble>

              {data && data.stats.overdue > 0 && (
                <Bubble variant="warn">
                  <div className="font-semibold text-red-700 mb-1">
                    <Clock className="h-3.5 w-3.5 inline mr-1" />
                    {data.stats.overdue} tarefa(s) atrasada(s)
                  </div>
                  <ul className="text-xs space-y-1 pl-4 list-disc text-red-900">
                    {data.overdue.slice(0, 5).map((t) => (
                      <li key={t.id}>
                        <strong>{t.lead_nome}</strong> — {t.title} ({t.channel})
                      </li>
                    ))}
                    {data.overdue.length > 5 && <li className="italic">+ {data.overdue.length - 5} outras</li>}
                  </ul>
                  <div className="mt-2 text-xs">Vá ao card do lead no kanban e marque como concluída.</div>
                </Bubble>
              )}

              {data && data.stats.today > 0 && (
                <Bubble variant="info">
                  <div className="font-semibold text-primary mb-1">
                    <CalendarCheck className="h-3.5 w-3.5 inline mr-1" />
                    {data.stats.today} tarefa(s) para hoje
                  </div>
                  <ul className="text-xs space-y-1 pl-4 list-disc">
                    {data.today.slice(0, 5).map((t) => (
                      <li key={t.id}>
                        <strong>{t.lead_nome}</strong> — {t.title} ({t.channel})
                      </li>
                    ))}
                  </ul>
                </Bubble>
              )}

              {data && data.stats.overdue === 0 && data.stats.today === 0 && (
                <Bubble>
                  🎉 Você está em dia com sua cadência! Continue assim.
                </Bubble>
              )}

              <Bubble variant="info">
                <div className="font-semibold mb-1"><Info className="h-3.5 w-3.5 inline mr-1" /> Como funciona a distribuição</div>
                <div className="text-xs leading-relaxed">
                  Leads de <strong>tráfego</strong> caem na fila comum e são distribuídos pela <strong>Coordenação (SDR)</strong> por sorteio (roleta) entre consultores da sua unidade. Você não escolhe — atende quem cai.
                  <br /><br />
                  Leads <strong>offline</strong> (indicação, evento, etc.) você mesmo cadastra e já ficam com você.
                </div>
              </Bubble>

              <Bubble>
                <div className="font-semibold mb-1"><MessageSquare className="h-3.5 w-3.5 inline mr-1" /> Etapas do funil</div>
                <div className="text-xs space-y-1">
                  <div><Badge variant="outline" className="mr-1">Novo</Badge> Ainda sem contato</div>
                  <div><Badge variant="outline" className="mr-1">Atendimento</Badge> Já iniciou conversa</div>
                  <div><Badge variant="outline" className="mr-1">Não atendido</Badge> Tentou e não respondeu</div>
                  <div><Badge variant="outline" className="mr-1">Venda</Badge> Fechou a venda</div>
                  <div><Badge variant="outline" className="mr-1">Faturado</Badge> Nota emitida</div>
                  <div><Badge variant="outline" className="mr-1">Perdido</Badge> Não avançou</div>
                </div>
              </Bubble>
            </div>

            <div className="border-t p-2 bg-background">
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setOpen(false)}>
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function Bubble({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "warn" | "info" }) {
  const cls =
    variant === "warn"
      ? "bg-red-50 border-red-200"
      : variant === "info"
        ? "bg-primary/5 border-primary/20"
        : "bg-background border";
  return <div className={`rounded-lg border p-3 ${cls}`}>{children}</div>;
}
