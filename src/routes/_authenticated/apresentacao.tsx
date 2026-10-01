import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, RefreshCw, Sun, X } from "lucide-react";
import { toast } from "sonner";

import {
  getNotasApresentacao,
  getRelatorioMes,
  saveNotasApresentacao,
  type NotasApresentacao,
} from "@/lib/apresentacao.functions";

/* ------------------------------------------------------------------ */
/* Rota                                                                */
/* ------------------------------------------------------------------ */

function mesAnteriorBR() {
  const hoje = new Date(Date.now() - 3 * 3600_000);
  const y = hoje.getUTCFullYear();
  const m = hoje.getUTCMonth(); // 0-based → mês anterior em 1-based
  return m === 0 ? `${y - 1}-12` : `${y}-${String(m).padStart(2, "0")}`;
}

export const Route = createFileRoute("/_authenticated/apresentacao")({
  validateSearch: (s: Record<string, unknown>) => ({
    mes:
      typeof s.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s.mes) ? s.mes : mesAnteriorBR(),
  }),
  head: () => ({
    meta: [
      { title: "Apresentação de Resultados · LZ7 Solar OS" },
      {
        name: "description",
        content:
          "Reunião de fechamento do mês da LZ7 Energia: leads, vendas assinadas e faturadas, margem, unidades e reconhecimento do time, com números reais do Ploomes.",
      },
      { property: "og:title", content: "Apresentação de Resultados · LZ7 Solar OS" },
      {
        property: "og:description",
        content: "Fechamento mensal da LZ7 Energia em tela cheia, com dados reais do Ploomes.",
      },
    ],
  }),
  component: ApresentacaoPage,
});

import { FundoApresentacao, PalcoApresentacao, nomeMes } from "@/components/apresentacao/palco";

/* ------------------------------------------------------------------ */
/* Editor das anotações                                                */
/* ------------------------------------------------------------------ */

function Editor({
  mes,
  notas,
  onFechar,
}: {
  mes: string;
  notas: NotasApresentacao;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(saveNotasApresentacao);
  const [titulo, setTitulo] = useState(notas.titulo);
  const [txt, setTxt] = useState({
    feito: notas.feito.join("\n"),
    remember: notas.remember.join("\n"),
    avisos: notas.avisos.join("\n"),
    proximos: notas.proximos.join("\n"),
  });
  const salvar = useMutation({
    mutationFn: () => {
      const linhas = (s: string) =>
        s
          .split("\n")
          .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
          .filter(Boolean);
      return salvarFn({
        data: {
          mes,
          notas: {
            titulo,
            feito: linhas(txt.feito),
            remember: linhas(txt.remember),
            avisos: linhas(txt.avisos),
            proximos: linhas(txt.proximos),
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Anotações salvas.");
      qc.invalidateQueries({ queryKey: ["apresentacao-notas", mes] });
      onFechar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const campos: [keyof typeof txt, string, string][] = [
    ["feito", "O que fizemos", "Uma entrega por linha"],
    ["remember", "Remember do mês", "Um ponto por linha"],
    ["avisos", "Avisos", "Um aviso por linha"],
    ["proximos", "Próximos passos", "Uma meta ou passo por linha"],
  ];
  return (
    <motion.aside
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="absolute inset-y-0 right-0 z-30 flex w-[min(560px,100vw)] flex-col border-l border-apr-line bg-apr-bg/98 text-apr-text shadow-2xl"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-apr-line px-6 py-4">
        <div className="font-display text-xl font-semibold">Anotações da reunião</div>
        <button
          onClick={onFechar}
          className="rounded-lg p-2 text-apr-muted hover:bg-apr-surface hover:text-apr-text"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <label className="block">
          <span className="text-sm text-apr-muted">Título</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-apr-line bg-apr-surface px-3 py-2 text-apr-text outline-none focus:border-apr-signed"
          />
        </label>
        {campos.map(([k, rot, dica]) => (
          <label key={k} className="block">
            <span className="text-sm text-apr-muted">
              {rot} <span className="text-apr-dim">· {dica}</span>
            </span>
            <textarea
              value={txt[k]}
              onChange={(e) => setTxt((t) => ({ ...t, [k]: e.target.value }))}
              rows={k === "feito" ? 8 : 5}
              className="mt-1.5 w-full resize-y rounded-xl border border-apr-line bg-apr-surface px-3 py-2 text-[15px] leading-relaxed text-apr-text outline-none focus:border-apr-signed"
            />
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-3 border-t border-apr-line px-6 py-4">
        <button
          onClick={onFechar}
          className="rounded-xl px-4 py-2 text-apr-muted hover:text-apr-text"
        >
          Cancelar
        </button>
        <button
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-apr-signed px-5 py-2 font-semibold text-apr-bg disabled:opacity-60"
        >
          {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar
        </button>
      </div>
    </motion.aside>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

function ApresentacaoPage() {
  const { mes } = Route.useSearch();
  const navigate = Route.useNavigate();
  const relFn = useServerFn(getRelatorioMes);
  const notasFn = useServerFn(getNotasApresentacao);
  const [forcar, setForcar] = useState(0);
  const [editando, setEditando] = useState(false);

  const rel = useQuery({
    queryKey: ["apresentacao-relatorio", mes, forcar],
    queryFn: () => relFn({ data: { mes, forcar: forcar > 0 } }),
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const notas = useQuery({
    queryKey: ["apresentacao-notas", mes],
    queryFn: () => notasFn({ data: { mes } }),
    staleTime: 60_000,
  });

  if (rel.data && notas.data)
    return (
      <PalcoApresentacao
        relatorio={rel.data}
        notas={notas.data.notas}
        mes={mes}
        podeEditar={notas.data.podeEditar}
        relendo={rel.isFetching}
        onMudarMes={(m) => navigate({ search: { mes: m } })}
        onReler={() => setForcar((f) => f + 1)}
        editando={editando}
        onEditar={() => setEditando(true)}
        onFecharEditor={() => setEditando(false)}
        editor={
          <AnimatePresence>
            <Editor mes={mes} notas={notas.data.notas} onFechar={() => setEditando(false)} />
          </AnimatePresence>
        }
      />
    );

  const erro = (rel.error ?? notas.error) as Error | null;
  return (
    <FundoApresentacao>
      {erro ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="font-display text-2xl">Não deu para carregar a apresentação</div>
          <div className="max-w-xl text-apr-muted">{erro.message}</div>
          <button
            onClick={() => {
              rel.refetch();
              notas.refetch();
            }}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-apr-signed px-5 py-2.5 font-semibold text-apr-bg"
          >
            <RefreshCw className="h-4 w-4" /> Tentar de novo
          </button>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
          >
            <Sun className="h-16 w-16 text-apr-glow" aria-hidden />
          </motion.div>
          <div className="font-display text-2xl">
            Lendo os números de {nomeMes(mes).toLowerCase()} no Ploomes…
          </div>
          <div className="text-apr-dim">Leva alguns segundos na primeira vez.</div>
        </div>
      )}
    </FundoApresentacao>
  );
}
