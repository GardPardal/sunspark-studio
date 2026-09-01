import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModuleShell } from "@/modules/shared/module-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  metaDiagnose,
  metaSaveConfig,
  metaListEvents,
  metaGetEvent,
  metaSendTestEvent,
  metaRetryEvent,
  metaQualityScore,
} from "@/lib/meta-debug.functions";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  Activity,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/meta-debug")({
  head: () => ({
    meta: [
      { title: "Meta CAPI · Debug — SO Comercial LZ7" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MetaDebugPage,
});

const STAGES = ["novo", "atendimento", "agendado", "venda", "faturado", "nao_atendido", "perdido"];

function MetaDebugPage() {
  const qc = useQueryClient();
  const diag = useServerFn(metaDiagnose);
  const save = useServerFn(metaSaveConfig);
  const list = useServerFn(metaListEvents);
  const get = useServerFn(metaGetEvent);
  const sendTest = useServerFn(metaSendTestEvent);
  const retry = useServerFn(metaRetryEvent);
  const score = useServerFn(metaQualityScore);

  const diagQ = useQuery({ queryKey: ["meta-debug", "diag"], queryFn: () => diag() });
  const scoreQ = useQuery({ queryKey: ["meta-debug", "score"], queryFn: () => score() });
  const evtQ = useQuery({
    queryKey: ["meta-debug", "events"],
    queryFn: () => list({ data: { limit: 50 } }),
  });

  const [pixel, setPixel] = useState("");
  const [testCode, setTestCode] = useState("");
  const [stageMap, setStageMap] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!diagQ.data) return;
    setPixel(diagQ.data.pixelId || "");
    setTestCode(diagQ.data.testCode || "");
    const map: Record<string, string> = {};
    for (const s of diagQ.data.stageMap) map[s.stage] = s.event || "";
    setStageMap(map);
  }, [diagQ.data]);

  const saveM = useMutation({
    mutationFn: async () =>
      save({ data: { pixel_id: pixel, test_event_code: testCode, stage_map: stageMap } }),
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["meta-debug"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const testM = useMutation({
    mutationFn: async (event: string) => sendTest({ data: { event, value: 1 } }),
    onSuccess: (res: any) => {
      const r = res?.result;
      if (r?.ok) toast.success(`Enviado! fbtrace_id: ${r.fbtrace_id ?? "—"}`);
      else
        toast.error(
          `Falhou (HTTP ${r?.http_status}): ${JSON.stringify(r?.response?.error ?? r?.reason ?? "erro")}`,
        );
      qc.invalidateQueries({ queryKey: ["meta-debug"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha no envio"),
  });

  const retryM = useMutation({
    mutationFn: async (id: string) => retry({ data: { id } }),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success("Reenviado com sucesso");
      else toast.error(`Falha: ${JSON.stringify(r?.response?.error ?? r?.error ?? "erro")}`);
      qc.invalidateQueries({ queryKey: ["meta-debug"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha no reenvio"),
  });

  const detailQ = useQuery({
    queryKey: ["meta-debug", "evt", selectedId],
    queryFn: () => get({ data: { id: selectedId! } }),
    enabled: !!selectedId,
  });

  const scoreColor = useMemo(() => {
    const s = scoreQ.data?.score ?? 0;
    if (s >= 80) return "text-emerald-600";
    if (s >= 50) return "text-amber-600";
    return "text-red-600";
  }, [scoreQ.data]);

  return (
    <ModuleShell
      title="Meta CAPI · Debug"
      subtitle="Auditoria e controle da integração Pixel + CAPI"
      active="marketing"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Score + status */}
        <Card className="p-4 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Qualidade CAPI (24h)
          </div>
          <div className={`mt-2 font-display text-5xl font-semibold ${scoreColor}`}>
            {scoreQ.data?.score ?? "…"}
            <span className="text-lg text-muted-foreground">/100</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              Eventos: <b>{scoreQ.data?.total ?? 0}</b>
            </div>
            <div>
              OK: <b className="text-emerald-600">{scoreQ.data?.ok ?? 0}</b>
            </div>
            <div>
              Erros: <b className="text-red-600">{scoreQ.data?.errors ?? 0}</b>
            </div>
            <div>
              c/ fbtrace_id: <b>{scoreQ.data?.withTrace ?? 0}</b>
            </div>
            <div>
              c/ event_id: <b>{scoreQ.data?.withEventId ?? 0}</b>
            </div>
            <div>
              Média user_data: <b>{scoreQ.data?.avgUserDataFields ?? 0}</b>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <StatusChip ok={!!scoreQ.data?.pixelConfigured} label="Pixel" />
            <StatusChip ok={!!scoreQ.data?.tokenConfigured} label="Token" />
            <StatusChip
              ok={!!scoreQ.data?.testMode}
              label="Test Mode"
              neutral={!scoreQ.data?.testMode}
            />
          </div>
        </Card>

        {/* Config */}
        <Card className="p-4 lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4" /> Credenciais + ping ao Graph
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Pixel ID</Label>
              <Input
                value={pixel}
                onChange={(e) => setPixel(e.target.value)}
                placeholder="1649997982077195"
              />
            </div>
            <div>
              <Label>Test Event Code (opcional)</Label>
              <Input
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
                placeholder="TEST12345"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Se preenchido, eventos vão para "Test Events" no Events Manager.
              </p>
            </div>
          </div>
          <div className="rounded-lg border p-2 text-xs">
            {diagQ.data?.ping?.ok ? (
              <span className="text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Ping OK · Pixel{" "}
                <b>{diagQ.data.ping.name ?? diagQ.data.ping.id}</b>
              </span>
            ) : (
              <span className="text-red-700 flex items-center gap-2">
                <XCircle className="h-4 w-4" /> Ping falhou ·{" "}
                {JSON.stringify(
                  diagQ.data?.ping?.error ?? diagQ.data?.ping?.message ?? "sem credenciais",
                )}
              </span>
            )}
          </div>

          <div>
            <div className="text-sm font-medium mb-2">
              Mapa de eventos por Stage (Ploomes → Meta)
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {STAGES.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="w-28 text-xs text-muted-foreground">{s}</span>
                  <select
                    className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={stageMap[s] ?? ""}
                    onChange={(e) => setStageMap((m) => ({ ...m, [s]: e.target.value }))}
                  >
                    <option value="">— não enviar —</option>
                    {(diagQ.data?.allEvents ?? []).map((ev: string) => (
                      <option key={ev} value={ev}>
                        {ev}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
              {saveM.isPending ? "Salvando…" : "Salvar configuração"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["meta-debug"] });
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
          </div>
        </Card>
      </div>

      {/* Envio de teste */}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-medium mb-2">
          <Send className="h-4 w-4" /> Enviar evento de teste
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Usa um lead sintético e força <code>test_event_code</code> (o configurado ou{" "}
          <code>TEST12345</code>). Aparece em Events Manager → Test Events.
        </p>
        <div className="flex flex-wrap gap-2">
          {(diagQ.data?.allEvents ?? []).map((ev: string) => (
            <Button
              key={ev}
              size="sm"
              variant="secondary"
              onClick={() => testM.mutate(ev)}
              disabled={testM.isPending}
            >
              {ev}
            </Button>
          ))}
        </div>
      </Card>

      {/* Lista de eventos */}
      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="text-sm font-medium">Últimos 50 eventos CAPI</div>
          <Button size="sm" variant="ghost" onClick={() => evtQ.refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-2">Quando</th>
                <th className="p-2">Evento</th>
                <th className="p-2">Status</th>
                <th className="p-2">HTTP</th>
                <th className="p-2">fbtrace_id</th>
                <th className="p-2">event_id</th>
                <th className="p-2">Teste?</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {(evtQ.data?.events ?? []).map((e: any) => (
                <tr key={e.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-2 font-medium">{e.event_name}</td>
                  <td className="p-2">
                    {e.status === "ok" ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-0">ok</Badge>
                    ) : e.status === "skipped" ? (
                      <Badge variant="outline">skipped</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border-0">erro</Badge>
                    )}
                  </td>
                  <td className="p-2">{e.http_status ?? "—"}</td>
                  <td
                    className="p-2 font-mono text-[10px] max-w-[160px] truncate"
                    title={e.fbtrace_id ?? ""}
                  >
                    {e.fbtrace_id ?? "—"}
                  </td>
                  <td
                    className="p-2 font-mono text-[10px] max-w-[140px] truncate"
                    title={e.event_id ?? ""}
                  >
                    {e.event_id?.slice(0, 12) ?? "—"}
                  </td>
                  <td className="p-2">{e.test_mode ? "sim" : "não"}</td>
                  <td className="p-2 flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedId(e.id)}>
                      ver
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => retryM.mutate(e.id)}
                      disabled={retryM.isPending}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!evtQ.data?.events?.length && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    <AlertTriangle className="inline h-4 w-4 mr-1" /> Nenhum evento ainda. Envie um
                    teste acima.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detalhe */}
      {selectedId && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Detalhe do evento</div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
              Fechar
            </Button>
          </div>
          {detailQ.isLoading ? (
            "…"
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Payload enviado</div>
                <pre className="text-[10px] bg-muted/40 p-2 rounded max-h-96 overflow-auto">
                  {JSON.stringify(detailQ.data?.event?.request_payload, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Resposta Meta</div>
                <pre className="text-[10px] bg-muted/40 p-2 rounded max-h-96 overflow-auto">
                  {JSON.stringify(detailQ.data?.event?.response, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </Card>
      )}
    </ModuleShell>
  );
}

function StatusChip({ ok, label, neutral }: { ok: boolean; label: string; neutral?: boolean }) {
  if (neutral) return <Badge variant="outline">{label}</Badge>;
  return (
    <Badge
      className={
        ok ? "bg-emerald-100 text-emerald-700 border-0" : "bg-red-100 text-red-700 border-0"
      }
    >
      {ok ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  );
}
