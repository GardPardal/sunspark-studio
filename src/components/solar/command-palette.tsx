import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, X, ArrowRight, Zap } from "lucide-react";
import { solarSearch, type SearchHit } from "@/lib/solar-os.functions";
import { cn } from "@/lib/utils";

const ENTITY_LABEL: Record<string, string> = {
  lead: "Lead",
  sale: "Venda",
  user: "Pessoa",
  campaign: "Campanha",
  creative: "Criativo",
  appointment: "Agendamento",
};

const ENTITY_TONE: Record<string, string> = {
  lead: "text-blue-600 bg-blue-500/10",
  sale: "text-emerald-700 bg-emerald-500/10",
  user: "text-fuchsia-600 bg-fuchsia-500/10",
  campaign: "text-orange-600 bg-orange-500/10",
  creative: "text-amber-600 bg-amber-500/10",
  appointment: "text-sky-600 bg-sky-500/10",
};

type Command = {
  id: string;
  label: string;
  hint?: string;
  to: string;
  keywords: string[];
};

const COMMANDS: Command[] = [
  {
    id: "c-hoje",
    label: "Ir para Hoje",
    hint: "Centro de operações",
    to: "/hoje",
    keywords: ["hoje", "home", "dashboard", "prioridade"],
  },
  {
    id: "c-crm",
    label: "Abrir CRM / Leads",
    to: "/crm",
    keywords: ["crm", "leads", "funil", "pipeline"],
  },
  {
    id: "c-leads-wpp",
    label: "Leads do WhatsApp",
    hint: "Lista interna /leads",
    to: "/leads",
    keywords: ["leads", "whatsapp", "wpp", "lista"],
  },
  {
    id: "c-responsaveis",
    label: "Responsáveis do Ploomes",
    hint: "Sincronizar usuários e vínculos",
    to: "/mod/responsaveis",
    keywords: ["responsavel", "ploomes", "usuarios", "vendedores", "sincronizar"],
  },
  {
    id: "c-sdr",
    label: "Cadastrar lead qualificado (SDR)",
    to: "/sdr-leadqualified",
    keywords: ["sdr", "qualificado", "cadastro", "ploomes", "novo lead"],
  },
  {
    id: "c-ranking",
    label: "Ranking de vendedores",
    hint: "Competição de vendas",
    to: "/ranking",
    keywords: ["ranking", "competicao", "premiacao", "vendedores", "placar", "podio"],
  },

  {
    id: "c-agenda",
    label: "Abrir Agenda",
    to: "/agenda",
    keywords: ["agenda", "compromissos", "calendario"],
  },
  {
    id: "c-marketing",
    label: "Marketing",
    to: "/mod/marketing",
    keywords: ["marketing", "meta", "ads", "campanhas"],
  },
  {
    id: "c-bi",
    label: "BI / Indicadores",
    to: "/mod/bi",
    keywords: ["bi", "indicadores", "kpi", "vendas"],
  },
  {
    id: "c-financeiro",
    label: "Financeiro",
    to: "/mod/financeiro",
    keywords: ["financeiro", "cac", "roas", "receita"],
  },
  {
    id: "c-liz",
    label: "Abrir LIZ Studio (imagens)",
    to: "/liz-studio",
    keywords: ["liz", "imagem", "midjourney", "criativo"],
  },
  {
    id: "c-ia",
    label: "Insights da IA",
    to: "/mod/ia",
    keywords: ["ia", "insights", "recomendacoes"],
  },
  {
    id: "c-saude",
    label: "Saúde do sistema",
    to: "/mod/saude",
    keywords: ["saude", "status", "integracao", "health"],
  },
  {
    id: "c-automacoes",
    label: "Automações / Workflows",
    to: "/mod/automacoes",
    keywords: ["automacao", "workflow", "regra"],
  },
  {
    id: "c-chamados",
    label: "Chamados de clientes",
    to: "/mod/chamados",
    keywords: ["chamado", "portal", "ticket", "cliente"],
  },
  {
    id: "c-admin",
    label: "Administração",
    to: "/admin",
    keywords: ["admin", "usuarios", "permissoes"],
  },
  {
    id: "c-wa-inbox",
    label: "WhatsApp — caixa de entrada",
    to: "/mod/whatsapp",
    keywords: ["whatsapp", "wpp", "conversas", "inbox", "atendimento"],
  },
  {
    id: "c-wa-kb",
    label: "WhatsApp — base de conhecimento",
    to: "/mod/whatsapp/conhecimento",
    keywords: ["conhecimento", "kb", "documentos", "ia", "rag"],
  },
  {
    id: "c-wa-config",
    label: "WhatsApp — configuração da IA",
    to: "/mod/whatsapp/config",
    keywords: ["whatsapp", "config", "bot", "sombra", "persona"],
  },
  {
    id: "c-inventario",
    label: "Inventário de estoque",
    to: "/inventario",
    keywords: ["inventario", "estoque", "almoxarifado", "material", "saldo"],
  },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const search = useServerFn(solarSearch);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounced remote search
  useEffect(() => {
    if (!open) return;
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = (await search({ data: { q, limit: 12 } })) as unknown as SearchHit[];
        setHits(rows);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, open, search]);

  const filteredCommands = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return COMMANDS;
    return COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(t) || c.keywords.some((k) => k.includes(t)),
    );
  }, [q]);

  const items = useMemo(() => {
    const cmds = filteredCommands.map((c) => ({ kind: "cmd" as const, cmd: c }));
    const results = hits.map((h) => ({ kind: "hit" as const, hit: h }));
    return [...cmds.slice(0, 6), ...results];
  }, [filteredCommands, hits]);

  const go = (idx: number) => {
    const it = items[idx];
    if (!it) return;
    if (it.kind === "cmd") {
      navigate({ to: it.cmd.to });
    } else {
      const h = it.hit;
      if (h.entity_type === "lead") navigate({ to: "/crm", search: { lead: h.entity_id } as any });
      else if (h.entity_type === "appointment") navigate({ to: "/agenda" });
      else if (h.entity_type === "user") navigate({ to: "/admin" });
      else if (h.entity_type === "campaign" || h.entity_type === "creative")
        navigate({ to: "/mod/marketing" });
      else if (h.entity_type === "sale") navigate({ to: "/mod/bi" });
    }
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(items.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(cursor);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[10vh] px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Busca global e comandos"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKey}
            placeholder="Buscar leads, vendas, campanhas ou comandos..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              buscando…
            </span>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {q ? "Nada encontrado." : "Digite para buscar em toda a plataforma."}
            </div>
          )}
          {items.map((it, i) => {
            const active = i === cursor;
            if (it.kind === "cmd") {
              return (
                <button
                  key={it.cmd.id}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                    active ? "bg-primary/10 text-foreground" : "hover:bg-muted/50",
                  )}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Zap className="h-4 w-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-medium">{it.cmd.label}</span>
                    {it.cmd.hint && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {it.cmd.hint}
                      </span>
                    )}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              );
            }
            const h = it.hit;
            const tone = ENTITY_TONE[h.entity_type] ?? "text-muted-foreground bg-muted";
            return (
              <button
                key={`${h.entity_type}-${h.entity_id}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(i)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition",
                  active ? "bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-semibold uppercase",
                    tone,
                  )}
                >
                  {(ENTITY_LABEL[h.entity_type] ?? h.entity_type).slice(0, 3)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-medium">{h.title}</span>
                  {h.subtitle && (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {h.subtitle}
                    </span>
                  )}
                </span>
                {h.badge && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {h.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="border-t border-border/60 bg-muted/30 px-4 py-2 text-[10px] text-muted-foreground flex items-center justify-between">
          <span>↑↓ navegar · ↵ abrir · esc fechar</span>
          <span className="font-mono">⌘K</span>
        </div>
      </div>
    </div>
  );
}
