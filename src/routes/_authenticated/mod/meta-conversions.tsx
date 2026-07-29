import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModuleShell } from "@/modules/shared/module-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  metaListEvents, metaGetEvent, metaRetryEvent, metaSendTestEvent, metaTodayMetrics,
} from "@/lib/meta-debug.functions";
import { RefreshCw, Send, CheckCircle2, XCircle, Eye, Play, AlertTriangle, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/meta-conversions")({
  head: () => ({
    meta: [
      { title: "Log de Conversões Meta — SO Comercial LZ7" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MetaConversionsPage,
});

const STATUS_STYLES: Record<string, string> = {
  aceito_meta: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  enviado: "bg-sky-500/15 text-sky-700 border-sky-500/40",
  reenviado: "bg-indigo-500/15 text-indigo-700 border-indigo-500/40",
  falhou: "bg-red-500/15 text-red-700 border-red-500/40",
  skipped_validation: "bg-amber-500/15 text-amber-800 border-amber-500/40",
  pendente: "bg-muted text-muted-foreground",
};

function StatusBadge({ detail, fallback }: { detail?: string; fallback?: string }) {
  const key = detail || fallback || "pendente";
  const cls = STATUS_STYLES[key] || "bg-muted text-muted-foreground";
  const Icon = key === "aceito_meta" ? CheckCircle2
    : key === "enviado" ? Send
    : key === "reenviado" ? RefreshCw
    : key === "skipped_validation" ? AlertTriangle
    : key === "falhou" ? XCircle
    : Clock;
  return (
    <Badge variant="outline" className={cls}>
      <Icon className="h-3 w-3 mr-1" /> {key.replace("_", " ")}
    </Badge>
  );
}

function MetricCard({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone ?? ""}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function MetaConversionsPage() {
  const qc = useQueryClient();
  const list = useServerFn(metaListEvents);
  const get = useServerFn(metaGetEvent);
  const retry = useServerFn(metaRetryEvent);
  const sendTest = useServerFn(metaSendTestEvent);
  const metrics = useServerFn(metaTodayMetrics);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const evtQ = useQuery({ queryKey: ["meta-conv", "events"], queryFn: () => list({ data: { limit: 100 } }) });
  const metQ = useQuery({ queryKey: ["meta-conv", "metrics"], queryFn: () => metrics() });
  const detQ = useQuery({
    queryKey: ["meta-conv", "det", selectedId],
    queryFn: () => selectedId ? get({ data: { id: selectedId } }) : Promise.resolve(null),
    enabled: !!selectedId,
  });

  const retryMut = useMutation({
    mutationFn: (id: string) => retry({ data: { id } }),
    onSuccess: (r: any) => {
      toast.success(r?.ok ? "Reenviado com sucesso" : "Reenvio falhou");
      qc.invalidateQueries({ queryKey: ["meta-conv"] });
    },
    onError: (e: any) => toast.error(e?.message || "erro no reenvio"),
  });

  const testMut = useMutation({
    mutationFn: () => sendTest({ data: { event: "CompleteRegistration", value: 1 } }),
    onSuccess: (r: any) => {
      const res = r?.result;
      toast.success(
        res?.ok
          ? `Evento de teste enviado · trace ${res.fbtrace_id ?? "—"}`
          : `Teste falhou: ${res?.response?.error?.message ?? "erro"}`,
      );
      qc.invalidateQueries({ queryKey: ["meta-conv"] });
    },
    onError: (e: any) => toast.error(e?.message || "erro no teste"),
  });

  const rows = (evtQ.data as any)?.events ?? [];
  const m = (metQ.data as any) ?? {};

  return (
    <ModuleShell title="Log de Conversões Meta" subtitle="Todos os eventos enviados para a Meta CAPI" active="meta-conversions">
      {/* Métricas do dia */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
        <MetricCard label="CompleteRegistration hoje" value={m.complete ?? "—"} />
        <MetricCard label="Total eventos" value={m.total ?? "—"} />
        <MetricCard label="Taxa de sucesso" value={m.total ? `${m.successRate ?? 0}%` : "—"} tone={m.successRate >= 90 ? "text-emerald-700" : m.successRate >= 60 ? "text-amber-700" : "text-red-700"} />
        <MetricCard label="Aceitos pela Meta" value={m.aceito ?? "—"} />
        <MetricCard label="Erros" value={m.errors ?? 0} tone={(m.errors ?? 0) > 0 ? "text-red-700" : ""} hint={m.skipped ? `${m.skipped} bloqueados por validação` : undefined} />
        <MetricCard label="Match Quality média" value={m.avgMatch ? `${m.avgMatch}/10` : "—"} tone={m.avgMatch >= 7 ? "text-emerald-700" : m.avgMatch >= 4 ? "text-amber-700" : "text-red-700"} />
      </div>

      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div className="text-sm text-muted-foreground">{rows.length} eventos listados · atualiza em tempo real</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["meta-conv"] })}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => testMut.mutate()} disabled={testMut.isPending}>
            <Play className="h-4 w-4 mr-1" /> {testMut.isPending ? "Enviando..." : "Enviar evento de teste"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Evento</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">HTTP</th>
                  <th className="text-left px-3 py-2">Match</th>
                  <th className="text-left px-3 py-2">Event ID</th>
                  <th className="text-right px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.event_name}</td>
                    <td className="px-3 py-2">
                      <StatusBadge detail={r.status_detail} fallback={r.status} />
                      {r.test_mode && <Badge variant="outline" className="ml-1">TEST</Badge>}
                    </td>
                    <td className="px-3 py-2">{r.http_status ?? "—"}</td>
                    <td className="px-3 py-2">{r.match_quality ? `${r.match_quality}/10` : "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.event_id?.slice(0, 10) || "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedId(r.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        disabled={retryMut.isPending || r.status_detail === "skipped_validation"}
                        onClick={() => retryMut.mutate(r.id)}
                        title={r.status_detail === "skipped_validation" ? "Sem payload — evento bloqueado por validação" : "Reenviar"}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhum evento ainda</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Detalhe do evento</h3>
          {!selectedId && <p className="text-sm text-muted-foreground">Selecione um evento para ver payload, resposta e motivos de validação.</p>}
          {selectedId && detQ.data && (detQ.data as any).event && (() => {
            const ev = (detQ.data as any).event;
            return (
              <div className="space-y-3 text-xs">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge detail={ev.status_detail} fallback={ev.status} />
                  {ev.test_mode && <Badge variant="outline">TEST</Badge>}
                  {ev.match_quality != null && <Badge variant="outline">Match {ev.match_quality}/10</Badge>}
                </div>
                <div><b>fbtrace_id:</b> <code>{ev.fbtrace_id || "—"}</code></div>
                <div><b>event_id:</b> <code>{ev.event_id || "—"}</code></div>
                {ev.validation_errors?.length ? (
                  <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2">
                    <b className="text-amber-800">Bloqueado por validação:</b>
                    <ul className="list-disc pl-4 mt-1">
                      {ev.validation_errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <b>Request payload:</b>
                  <pre className="mt-1 bg-muted p-2 rounded max-h-64 overflow-auto">
                    {JSON.stringify(ev.request_payload, null, 2)}
                  </pre>
                </div>
                <div>
                  <b>Response Meta:</b>
                  <pre className="mt-1 bg-muted p-2 rounded max-h-48 overflow-auto">
                    {JSON.stringify(ev.response, null, 2)}
                  </pre>
                </div>
              </div>
            );
          })()}
        </Card>
      </div>
    </ModuleShell>
  );
}
