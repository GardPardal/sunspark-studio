import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Terminal,
  Activity,
  Play,
  Pause,
  Sparkles,
  Radio,
  Zap,
  ArrowDownCircle,
  Copy,
  Check,
  Brain,
  Cpu,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
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
  const queryClient = useQueryClient();
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEngineActive, setIsEngineActive] = useState(true);
  const [intervalMs] = useState<number>(3500);
  
  // Real-time dynamic brain telemetry states
  const [cpuLoad, setCpuLoad] = useState<number>(78);
  const [activeSynapses, setActiveSynapses] = useState<number>(1024);
  const [currentThought, setCurrentThought] = useState<string>(
    "Aguardando leitura de diálogos. A LIZ analisa cada mensagem de cliente e resposta de vendedor para extrair inteligência comercial."
  );
  const [lastScannedContact, setLastScannedContact] = useState<{ name: string; phone: string } | null>(null);

  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Fetch initial & background logs
  const { data: serverLogs = [] } = useQuery({
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
    refetchInterval: 10000,
  });

  // Local active memory logs stream
  const [streamLogs, setStreamLogs] = useState<HackerLogEntry[]>([]);

  // Sincroniza server logs com o stream local
  useEffect(() => {
    if (serverLogs && serverLogs.length > 0) {
      setStreamLogs((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        const newOnes = serverLogs.filter((l) => !existingIds.has(l.id));
        if (newOnes.length === 0) return prev;
        return [...newOnes.reverse(), ...prev].slice(0, 150);
      });
    }
  }, [serverLogs]);

  // Mutação do Ciclo Neural Cognitivo Ativo (Lê WhatsApp, Pensa e Aprende)
  const thinkCycleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/public/liz-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "live_think" }),
      });
      if (!res.ok) {
        throw new Error("Falha no ciclo neural");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      setCpuLoad(Math.floor(65 + Math.random() * 30));
      setActiveSynapses((prev) => prev + Math.floor(Math.random() * 4) + 1);

      if (data.contactName) {
        setLastScannedContact({
          name: data.contactName,
          phone: data.maskedPhone || "+55 43 99***",
        });
      }

      if (data.thoughtProcess) {
        setCurrentThought(data.thoughtProcess);
      }

      if (data.ruleLearned) {
        toast.success(
          `✨ NOVA REGRA EXTRAÍDA: "${data.ruleLearned.titulo}"`,
          { duration: 4000 }
        );
        queryClient.invalidateQueries({ queryKey: ["liz_learnings"] });
        queryClient.invalidateQueries({ queryKey: ["liz_global_status"] });
      }

      if (Array.isArray(data.telemetryLogs) && data.telemetryLogs.length > 0) {
        setStreamLogs((prev) => {
          const newEntries = [...data.telemetryLogs, ...prev];
          return newEntries.slice(0, 200);
        });
      }
    },
    onError: (err) => {
      console.warn("[LIZ Live Think Notice]", err);
    },
  });

  // Loop autônomo do cérebro em tempo real
  useEffect(() => {
    if (!isEngineActive) return;

    thinkCycleMutation.mutate();

    const interval = setInterval(() => {
      if (!thinkCycleMutation.isPending) {
        thinkCycleMutation.mutate();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isEngineActive, intervalMs]);

  // Rolagem suave automática para a linha mais recente
  useEffect(() => {
    if (autoScroll) {
      terminalBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamLogs, autoScroll]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Linha de telemetria copiada!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLogs = streamLogs.filter((log) => {
    if (filter === "ALL") return true;
    if (filter === "THINK") return log.type === "EVAL";
    if (filter === "LEARNED") return log.type === "LEARNED";
    if (filter === "OBSERVED") return log.type === "OBSERVED";
    return log.type === filter;
  });

  const getTagColor = (type: HackerLogEntry["type"]) => {
    switch (type) {
      case "LEARNED":
        return "text-emerald-400 bg-emerald-950/90 border-emerald-500/50";
      case "OBSERVED":
        return "text-cyan-400 bg-cyan-950/90 border-cyan-500/50";
      case "TRAINER":
        return "text-purple-400 bg-purple-950/90 border-purple-500/50";
      case "EVAL":
        return "text-amber-400 bg-amber-950/90 border-amber-500/50";
      default:
        return "text-slate-400 bg-slate-900 border-slate-700";
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#05070c] border border-emerald-500/30 rounded-xl overflow-hidden shadow-2xl font-mono">
      {/* Top Cyber Command Bar */}
      <div className="bg-[#080d1a] border-b border-emerald-500/30 p-4 space-y-3">
        {/* Top Row: System Identity & Stats */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 shadow-lg shadow-emerald-500/10">
              <Brain className={`h-5 w-5 text-emerald-400 ${isEngineActive ? "animate-pulse" : "opacity-40"}`} />
              {isEngineActive && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white tracking-wider text-sm flex items-center gap-1.5 font-mono">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  LIZ_NEURAL_CORE::ESTUDO_AO_VIVO
                </span>
                <Badge
                  className={`text-[10px] font-mono gap-1 ${
                    isEngineActive
                      ? "bg-emerald-950 text-emerald-300 border-emerald-500/40 animate-pulse"
                      : "bg-slate-900 text-slate-400 border-slate-700"
                  }`}
                >
                  <Radio className="h-2.5 w-2.5" />
                  {isEngineActive ? "MOTOR_PENSANDO_LIVE" : "MOTOR_PAUSADO"}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400 font-mono pt-0.5">
                Escuta de conversas no WhatsApp • Extração contínua de argumentos & objeções
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 bg-black/70 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300">
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
              <span>Carga: <b className="text-cyan-300">{cpuLoad}%</b></span>
            </div>

            <div className="flex items-center gap-1.5 bg-black/70 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300">
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              <span>Sinapses: <b className="text-amber-300">{activeSynapses}</b></span>
            </div>

            {lastScannedContact && (
              <div className="flex items-center gap-1.5 bg-black/70 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-emerald-300">
                <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                <span>Estudando: <b>{lastScannedContact.name}</b></span>
              </div>
            )}
          </div>
        </div>

        {/* Dedicated Roomy Thought Card (NO truncation, full comfortable reading) */}
        <div className="bg-black/80 border border-emerald-500/30 rounded-xl p-3.5 shadow-inner">
          <div className="flex items-center gap-2 pb-1.5 text-xs font-bold text-amber-400">
            <Sparkles className="h-3.5 w-3.5 animate-spin text-amber-400" />
            <span>RACIOCÍNIO ATIVO DA LIZ (AO VIVO):</span>
          </div>
          <div className="text-xs text-slate-100 font-mono leading-relaxed whitespace-pre-wrap break-words pl-1 border-l-2 border-emerald-500/60 py-0.5">
            {currentThought}
          </div>
        </div>

        {/* Bottom Controls & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Filter Chips */}
          <div className="flex items-center gap-1 bg-black/60 border border-slate-800 rounded-lg p-1 text-[11px] overflow-x-auto no-scrollbar">
            {[
              { key: "ALL", label: "TODOS OS LOGS" },
              { key: "OBSERVED", label: "🛰️ SCAN WA" },
              { key: "THINK", label: "💭 RACIOCÍNIO" },
              { key: "LEARNED", label: "✨ REGRAS ABSORVIDAS" },
              { key: "SYSTEM", label: "⚡ SISTEMA" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded transition font-mono whitespace-nowrap ${
                  filter === f.key
                    ? "bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-500/50 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEngineActive(!isEngineActive)}
              className={`h-8 px-3 text-xs font-mono border font-semibold ${
                isEngineActive
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/50 hover:bg-emerald-950"
                  : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
              }`}
            >
              {isEngineActive ? <Pause className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
              {isEngineActive ? "PAUSAR MOTOR" : "LIGAR MOTOR"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => thinkCycleMutation.mutate()}
              disabled={thinkCycleMutation.isPending}
              className="h-8 px-3 text-xs font-mono border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 font-bold shadow-sm"
              title="Força a análise e estudo de um diálogo agora"
            >
              {thinkCycleMutation.isPending ? (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5 mr-1.5" />
              )}
              ESTUDAR DIÁLOGO AGORA
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoScroll(!autoScroll)}
              className={`h-8 px-2.5 text-xs font-mono border-slate-800 ${
                autoScroll ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30" : "text-slate-400"
              }`}
            >
              <ArrowDownCircle className="h-3.5 w-3.5 mr-1.5" />
              {autoScroll ? "SCROLL: ON" : "SCROLL: OFF"}
            </Button>
          </div>
        </div>
      </div>

      {/* Terminal Stream View Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#05070c] text-slate-300 text-xs leading-relaxed selection:bg-emerald-500/30 selection:text-emerald-200 min-h-[300px]">
        {/* Terminal Boot Header */}
        <div className="text-slate-600 pb-2 border-b border-slate-900 font-mono text-[11px] space-y-0.5">
          <div>[LZ7_NEURAL_ENGINE] Continuous Learning Pipeline Online (Z-API & Supabase Live).</div>
          <div className="text-emerald-500/70">
            {">>"} Autonomous Dialogue Evaluator running at {intervalMs / 1000}s pulse rate.
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-600 font-mono text-xs space-y-2">
            <Activity className="h-6 w-6 animate-spin text-emerald-500/60 mx-auto" />
            <p className="text-emerald-400/70 font-bold">{">>"} LIZ ESTÁ LENDO AS MENSAGENS DO WHATSAPP...</p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Cada interação humana ou pergunta de cliente é analisada em tempo real para extrair novos argumentos e quebras de objeções.
            </p>
          </div>
        ) : (
          filteredLogs.map((entry) => (
            <div
              key={entry.id}
              className="group relative flex items-start gap-3 rounded-xl border border-slate-900/80 bg-slate-950/60 p-3 transition hover:border-slate-800 hover:bg-slate-900/50 shadow-sm"
            >
              <span className="text-[11px] text-slate-500 shrink-0 select-none pt-0.5 font-mono">
                {entry.timestamp}
              </span>

              <span
                className={`text-[10px] px-2 py-0.5 rounded-md border uppercase font-bold shrink-0 ${getTagColor(
                  entry.type,
                )}`}
              >
                {entry.tag}
              </span>

              <div className="flex-1 min-w-0 font-mono space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white tracking-wide text-xs">{entry.title}</span>
                  {entry.source && (
                    <span className="text-[10px] text-slate-500">[{entry.source}]</span>
                  )}
                </div>
                <div className="text-slate-200 text-xs leading-relaxed whitespace-pre-wrap break-words bg-black/40 p-2 rounded-lg border border-slate-900">
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
                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-emerald-400 transition shrink-0"
                title="Copiar log"
              >
                {copiedId === entry.id ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          ))
        )}

        <div ref={terminalBottomRef} />
      </div>

      {/* Terminal Live Prompt Bar */}
      <div className="px-4 py-2.5 bg-[#070a12] border-t border-slate-900 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">liz@lz7-brain:~$</span>
          <span className="text-slate-300 animate-pulse truncate max-w-md">
            {thinkCycleMutation.isPending
              ? "analisando_dialogo_em_tempo_real... █"
              : isEngineActive
                ? `escutando_mensagens_whatsapp (pulso ${intervalMs / 1000}s)... █`
                : "motor_em_pausa. clique em LIGAR MOTOR █"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span>Total de eventos: <b className="text-white">{streamLogs.length}</b></span>
          <span className="text-slate-700">|</span>
          <span className="text-emerald-400 flex items-center gap-1 font-bold">
            <ShieldCheck className="h-3.5 w-3.5" /> NEURAL_SHADOW_ACTIVE
          </span>
        </div>
      </div>
    </div>
  );
}
