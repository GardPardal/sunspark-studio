import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Terminal,
  Activity,
  Play,
  Trash2,
  Filter,
  Sparkles,
  Download,
  CheckCircle2,
  Radio,
  Zap,
  ArrowDownCircle,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type HackerLogEntry = {
  id: string;
  timestamp: string;
  type: "LEARNED" | "OBSERVED" | "TRAINER" | "SYSTEM" | "EVAL";
  tag: string;
  title: string;
  detail: string;
  source?: string;
  rawPayload?: any;
};

export function LizHackerTerminal() {
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Fetch logs do endpoint
  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["liz_neural_logs"],
    queryFn: async () => {
      const res = await fetch("/api/public/liz-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logs" }),
      });
      if (!res.ok) return [] as HackerLogEntry[];
      const json = await res.json();
      return (json.logs || []) as HackerLogEntry[];
    },
    refetchInterval: 2500,
  });

  // Mutação para injetar pulso de teste
  const testPulseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/public/liz-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_log",
          title: "Simulação de Objeção: 'Prazo da Copel'",
          category: "dado_tecnico",
          content: "O prazo de vistoria e troca de medidor pela Copel é de 7 a 15 dias úteis após o pedido de ligação.",
        }),
      });
      return await res.json();
    },
    onSuccess: () => {
      toast.success("⚡ Pulso de telemetria injetado no terminal!");
      refetch();
    },
  });

  useEffect(() => {
    if (autoScroll) {
      terminalBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filter === "ALL") return true;
    return log.type === filter;
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Linha de log copiada!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTagColor = (type: HackerLogEntry["type"]) => {
    switch (type) {
      case "LEARNED":
        return "text-emerald-400 bg-emerald-950/80 border-emerald-500/40";
      case "OBSERVED":
        return "text-cyan-400 bg-cyan-950/80 border-cyan-500/40";
      case "TRAINER":
        return "text-purple-400 bg-purple-950/80 border-purple-500/40";
      case "EVAL":
        return "text-amber-400 bg-amber-950/80 border-amber-500/40";
      default:
        return "text-slate-400 bg-slate-900 border-slate-700";
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#05070c] border border-emerald-500/20 rounded-xl overflow-hidden shadow-2xl font-mono">
      {/* Terminal Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#0a0d14] border-b border-emerald-500/20 text-xs">
        {/* Terminal Header Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <span className="font-bold text-emerald-400 tracking-wider">
              LIZ_NEURAL_STREAM v2.5
            </span>
          </div>
          <Badge className="bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[10px] gap-1 animate-pulse">
            <Radio className="h-2.5 w-2.5" /> LIVE_MONITOR
          </Badge>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Chips */}
          <div className="flex items-center gap-1 bg-black/40 border border-slate-800 rounded-lg p-0.5 text-[10px]">
            {["ALL", "LEARNED", "OBSERVED", "TRAINER", "EVAL"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded transition ${
                  filter === f
                    ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`h-7 px-2.5 text-[11px] font-mono border-slate-800 ${
              autoScroll ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30" : "text-slate-400"
            }`}
          >
            <ArrowDownCircle className="h-3.5 w-3.5 mr-1" />
            {autoScroll ? "SCROLL: ON" : "SCROLL: PAUSED"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => testPulseMutation.mutate()}
            disabled={testPulseMutation.isPending}
            className="h-7 px-2.5 text-[11px] font-mono border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            title="Injeta um evento simulado para testar o terminal hacker"
          >
            <Zap className="h-3 w-3 mr-1" /> TEST_PULSE
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-7 px-2 text-slate-400 hover:text-white"
          >
            <Activity className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Terminal Screen Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#05070c] text-slate-300 text-xs leading-relaxed selection:bg-emerald-500/30 selection:text-emerald-200">
        {/* Boot Banner */}
        <div className="text-slate-600 pb-2 border-b border-slate-900 font-mono text-[11px]">
          <div>[LZ7_CORE_AI] Liz Neural Observability Stream initialized.</div>
          <div>[CONNECTED] Listening to WhatsApp Z-API Webhooks & Live SDR Training interactions.</div>
          <div className="text-emerald-500/70">
            {">>"} Neural Matrix Active. Learning Buffer Ready.
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-emerald-400 py-6">
            <Activity className="h-4 w-4 animate-spin" /> Carregando fluxo de telemetria...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-600 font-mono text-xs">
            <p className="text-emerald-500/40">{">>"} Aguardando eventos de aprendizado ao vivo...</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Converse com a LIZ ou deixe a Stephany responder clientes no WhatsApp para ver os logs em tempo real.
            </p>
          </div>
        ) : (
          filteredLogs.map((entry) => (
            <div
              key={entry.id}
              className="group relative flex items-start gap-2.5 rounded-lg border border-transparent p-2 transition hover:border-slate-800 hover:bg-slate-900/40"
            >
              <span className="text-[10px] text-slate-500 shrink-0 select-none pt-0.5 font-mono">
                {entry.timestamp}
              </span>

              <span
                className={`text-[9px] px-1.5 py-0.2 rounded border uppercase font-bold shrink-0 ${getTagColor(
                  entry.type,
                )}`}
              >
                {entry.tag}
              </span>

              <div className="flex-1 min-w-0 font-mono">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white tracking-wide">{entry.title}</span>
                  {entry.source && (
                    <span className="text-[10px] text-slate-500">[{entry.source}]</span>
                  )}
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5 whitespace-pre-wrap break-words leading-snug">
                  {entry.detail}
                </div>
              </div>

              <button
                onClick={() =>
                  copyToClipboard(
                    `[${entry.timestamp}] [${entry.tag}] ${entry.title}: ${entry.detail}`,
                    entry.id,
                  )
                }
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-emerald-400 transition"
                title="Copiar log"
              >
                {copiedId === entry.id ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))
        )}

        <div ref={terminalBottomRef} />
      </div>

      {/* Terminal Footer Prompt Line */}
      <div className="px-4 py-2 bg-[#080b12] border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">liz@lz7-core:~$</span>
          <span className="text-slate-400 animate-pulse">observing_dialogues_live... █</span>
        </div>
        <div>
          <span>Total de eventos: <b>{logs.length}</b></span>
        </div>
      </div>
    </div>
  );
}