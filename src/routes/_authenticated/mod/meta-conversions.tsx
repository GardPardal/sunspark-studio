import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModuleShell } from "@/modules/shared/module-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { metaListEvents, metaGetEvent, metaRetryEvent } from "@/lib/meta-debug.functions";
import { RefreshCw, Send, CheckCircle2, XCircle, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/meta-conversions")({
  head: () => ({
    meta: [
      { title: "Log de Conversões Meta — SO Comercial LZ7" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MetaConversionsPage,
});

function MetaConversionsPage() {
  const qc = useQueryClient();
  const list = useServerFn(metaListEvents);
  const get = useServerFn(metaGetEvent);
  const retry = useServerFn(metaRetryEvent);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const evtQ = useQuery({ queryKey: ["meta-conv", "events"], queryFn: () => list({ data: { limit: 100 } }) });
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

  const rows = (evtQ.data as any)?.events ?? [];

  return (
    <ModuleShell title="Log de Conversões Meta" subtitle="Todos os eventos enviados para a Meta CAPI" active="meta-conversions">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">{rows.length} eventos</div>
        <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["meta-conv"] })}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Nome/Tel</th>
                  <th className="text-left px-3 py-2">Evento</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">HTTP</th>
                  <th className="text-left px-3 py-2">Event ID</th>
                  <th className="text-right px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      lead: {r.lead_id ? r.lead_id.slice(0, 8) : "—"}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.event_name}</td>
                    <td className="px-3 py-2">
                      {r.status === "ok" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/40">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> ok
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" /> {r.status}
                        </Badge>
                      )}
                      {r.test_mode && <Badge variant="outline" className="ml-1">TEST</Badge>}
                    </td>
                    <td className="px-3 py-2">{r.http_status ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.event_id?.slice(0, 10) || "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedId(r.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={retryMut.isPending}
                        onClick={() => retryMut.mutate(r.id)}
                        title="Reenviar evento"
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
          {!selectedId && <p className="text-sm text-muted-foreground">Selecione um evento para ver payload e resposta da Meta.</p>}
          {selectedId && detQ.data && (detQ.data as any).event && (
            <div className="space-y-3 text-xs">
              <div><b>fbtrace_id:</b> <code>{(detQ.data as any).event.fbtrace_id || "—"}</code></div>
              <div>
                <b>Request payload:</b>
                <pre className="mt-1 bg-muted p-2 rounded max-h-64 overflow-auto">
                  {JSON.stringify((detQ.data as any).event.request_payload, null, 2)}
                </pre>
              </div>
              <div>
                <b>Response Meta:</b>
                <pre className="mt-1 bg-muted p-2 rounded max-h-48 overflow-auto">
                  {JSON.stringify((detQ.data as any).event.response, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </Card>
      </div>
    </ModuleShell>
  );
}
