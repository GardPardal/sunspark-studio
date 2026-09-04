import { createFileRoute, Link } from "@tanstack/react-router";
import { LizHackerTerminal } from "@/components/liz-hacker-terminal";
import { Button } from "@/components/ui/button";
import { Brain, ArrowLeft, Terminal, Shield, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lizlogs")({
  head: () => ({
    meta: [
      { title: "Terminal Hacker de Logs — LIZ Neural Stream" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LizLogsPage,
});

function LizLogsPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#030712] text-slate-100 p-4">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-emerald-500/20">
        <div className="flex items-center gap-3">
          <Link to="/liztreinamento">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-800 bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 gap-1.5 text-xs font-mono"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Treinamento
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-emerald-400 font-mono flex items-center gap-2">
                LIZ_NEURAL_OBSERVABILITY_SHELL <span className="text-[10px] text-emerald-600 font-normal">v2.5</span>
              </h1>
              <p className="text-[11px] text-slate-500 font-mono">
                Monitoramento contínuo de escuta, aprendizado em diálogos humanos e absorção de regras em tempo real.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/liztreinamento">
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold gap-1.5 shadow-md shadow-amber-500/20"
            >
              <Brain className="h-3.5 w-3.5" /> Abrir Sala de Treinamento
            </Button>
          </Link>
        </div>
      </div>

      {/* Terminal View Container */}
      <div className="flex-1 min-h-0">
        <LizHackerTerminal />
      </div>
    </div>
  );
}
