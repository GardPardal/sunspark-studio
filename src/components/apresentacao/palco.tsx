/**
 * Palco da apresentação mensal (/apresentacao): slides 16:9 escalados para qualquer tela,
 * navegação por teclado/clique, visão geral e números animados. Só apresentação:
 * os dados chegam prontos por props.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, animate, motion, useAnimationFrame, useInView } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BadgeDollarSign,
  Building2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Heart,
  FileSignature,
  LayoutGrid,
  Maximize2,
  Megaphone,
  Mic,
  Pencil,
  Percent,
  Receipt,
  RefreshCw,
  Rocket,
  Sparkles,
  Sun,
  Target,
  Trophy,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { Agregado, NotasApresentacao, RelatorioMes } from "@/lib/apresentacao.functions";
import { CAMPANHAS, pctMeta, vencedora, type Campanha, type Casa } from "./casas";

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
export const nomeMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1] ?? mes;
const mesCurto = (mes: string) => nomeMes(mes).slice(0, 3);

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
function brlCurto(v: number) {
  const a = Math.abs(v);
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (a >= 1e3) return `R$ ${Math.round(v / 1e3).toLocaleString("pt-BR")} mil`;
  return brl(v);
}
const int = (v: number) => Math.round(v).toLocaleString("pt-BR");
const pct = (v: number, casas = 1) =>
  `${v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`;

function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}

/* ------------------------------------------------------------------ */
/* Peças visuais                                                       */
/* ------------------------------------------------------------------ */

/** Número que conta do zero quando o slide aparece. */
function Conta({
  valor,
  formato = int,
  duracao = 1.4,
}: {
  valor: number;
  formato?: (v: number) => string;
  duracao?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const visivel = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!visivel) return;
    const c = animate(0, valor, {
      duration: duracao,
      ease: EASE,
      onUpdate: setV,
    });
    return () => c.stop();
  }, [visivel, valor, duracao]);
  return (
    <span ref={ref} className="tabular-nums">
      {formato(v)}
    </span>
  );
}

function Delta({ atual, anterior, rotulo }: { atual: number; anterior: number; rotulo: string }) {
  const d = variacao(atual, anterior);
  if (d == null) return <span className="text-apr-dim">sem base em {rotulo}</span>;
  const sobe = d >= 0;
  const Icon = sobe ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold " +
        (sobe ? "bg-success/15 text-success" : "bg-danger/15 text-danger")
      }
    >
      <Icon className="h-4 w-4" aria-hidden />
      {sobe ? "+" : ""}
      {pct(d, 0)} vs {rotulo}
    </span>
  );
}

const EASE = [0.16, 1, 0.3, 1] as const;

const subir = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.12 + i * 0.07, duration: 0.6, ease: EASE },
  }),
};

function Item({
  i = 0,
  className,
  children,
}: {
  i?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div custom={i} variants={subir} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

function Kicker({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[15px] font-semibold uppercase tracking-[0.22em] text-apr-glow">
      <Icon className="h-5 w-5" aria-hidden />
      {children}
    </div>
  );
}

function Titulo({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-3 font-display text-[52px] font-semibold leading-[1.05] tracking-tight text-apr-text">
      {children}
    </h2>
  );
}

function Painel({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={
        "rounded-3xl border border-apr-line/80 bg-apr-surface/70 p-7 shadow-[0_30px_80px_-40px_rgb(0_0_0/0.8)] backdrop-blur " +
        className
      }
    >
      {children}
    </div>
  );
}

/** Barras horizontais com rótulo e valor (forma: magnitude por categoria). */
function Barras({
  dados,
  medida,
  cor = "signed",
  max = 7,
}: {
  dados: Agregado[];
  medida: "qtd" | "valor";
  cor?: "signed" | "billed";
  max?: number;
}) {
  const linhas = dados.slice(0, max);
  const resto = dados.slice(max);
  const outras = resto.length
    ? {
        chave: `Outras ${resto.length === 1 ? "1 categoria" : `${resto.length} categorias`}`,
        qtd: resto.reduce((s, r) => s + r.qtd, 0),
        valor: resto.reduce((s, r) => s + r.valor, 0),
      }
    : null;
  // A escala vem só das categorias nomeadas: a soma de "outras" não é uma categoria.
  const topo = Math.max(1, ...linhas.map((l) => l[medida]));
  const total = dados.reduce((s, l) => s + l[medida], 0) || 1;
  if (!linhas.length) return <p className="text-lg text-apr-dim">Sem registros no mês.</p>;
  return (
    <ul className="space-y-3.5">
      {linhas.map((l, i) => (
        <li key={l.chave} title={`${l.chave}: ${int(l.qtd)} · ${brl(l.valor)}`}>
          <div className="mb-1.5 flex items-baseline justify-between gap-4 text-[17px]">
            <span className="truncate text-apr-text">{l.chave}</span>
            <span className="shrink-0 tabular-nums text-apr-muted">
              <b className="font-semibold text-apr-text">
                {medida === "valor" ? brlCurto(l.valor) : int(l.qtd)}
              </b>
              <span className="ml-2 text-[14px]">{pct((l[medida] / total) * 100, 0)}</span>
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-apr-line/60">
            <motion.div
              className={
                "h-full rounded-full " + (cor === "signed" ? "bg-apr-signed" : "bg-apr-billed")
              }
              initial={{ width: 0 }}
              animate={{ width: `${(l[medida] / topo) * 100}%` }}
              transition={{ delay: 0.25 + i * 0.06, duration: 0.9, ease: EASE }}
            />
          </div>
        </li>
      ))}
      {outras && (
        <li className="flex items-baseline justify-between gap-4 pt-1 text-[16px] text-apr-dim">
          <span>+ {outras.chave}</span>
          <span className="tabular-nums">
            {medida === "valor" ? brlCurto(outras.valor) : int(outras.qtd)} ·{" "}
            {pct((outras[medida] / total) * 100, 0)}
          </span>
        </li>
      )}
    </ul>
  );
}

/** Colunas por dia (forma: contagem ao longo do mês). */
function Diario({
  serie,
  cor,
  rotulo,
  altura = 150,
}: {
  serie: number[];
  cor: "signed" | "billed";
  rotulo: string;
  altura?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const topo = Math.max(1, ...serie);
  const total = serie.reduce((s, n) => s + n, 0);
  return (
    <div className="relative">
      <div className="flex items-end gap-[3px]" style={{ height: altura }}>
        {serie.map((n, i) => (
          <div
            key={i}
            className="relative flex h-full flex-1 cursor-default items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <motion.div
              className={
                "w-full rounded-t-[4px] " +
                (cor === "signed" ? "bg-apr-signed" : "bg-apr-billed") +
                (hover != null && hover !== i ? " opacity-40" : "")
              }
              initial={{ height: 0 }}
              animate={{ height: `${(n / topo) * 100}%` }}
              transition={{ delay: 0.2 + i * 0.015, duration: 0.7, ease: EASE }}
              style={{ minHeight: n ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[13px] text-apr-dim">
        <span>dia 1</span>
        <span>
          {int(total)} {rotulo} no mês
        </span>
        <span>dia {serie.length}</span>
      </div>
      {hover != null && (
        <div
          className="pointer-events-none absolute -top-12 rounded-lg border border-apr-line bg-apr-bg px-3 py-1.5 text-[14px] text-apr-text shadow-lg"
          style={{ left: `calc(${((hover + 0.5) / serie.length) * 100}% - 60px)` }}
        >
          Dia {hover + 1}: <b>{int(serie[hover])}</b> {rotulo}
        </div>
      )}
    </div>
  );
}

/** Colunas agrupadas por mês: assinado x faturado (mesma unidade, um eixo). */
function Historico({ dados, mesAtual }: { dados: RelatorioMes["historico"]; mesAtual: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const topo = Math.max(1, ...dados.flatMap((d) => [d.assinadoValor, d.faturadoValor]));
  // Largura igual à área útil do painel (≈1368px): o SVG fica em escala 1:1 no palco.
  const W = 1368;
  const H = 200;
  const grupo = W / dados.length;
  const bw = Math.min(54, grupo * 0.3);
  const y = (v: number) => H - (v / topo) * (H - 46);
  const coluna = (x: number, v: number) => {
    const top = y(v);
    const r = Math.min(4, (H - top) / 2);
    return `M${x},${H} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + bw - r},${top} Q${x + bw},${top} ${x + bw},${top + r} L${x + bw},${H} Z`;
  };
  return (
    <div className="relative">
      <div className="mb-4 flex items-center gap-6 text-[15px] text-apr-muted">
        <span className="flex items-center gap-2">
          <i className="h-3 w-3 rounded-sm bg-apr-signed" /> Assinado
        </span>
        <span className="flex items-center gap-2">
          <i className="h-3 w-3 rounded-sm bg-apr-billed" /> Faturado
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 34}`} className="w-full overflow-visible" role="img">
        <title>Valor assinado e faturado nos últimos 6 meses</title>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={y(topo * f)}
            y2={y(topo * f)}
            className="stroke-apr-line"
            strokeDasharray="2 6"
          />
        ))}
        {dados.map((d, i) => {
          const cx = i * grupo + grupo / 2;
          const atual = d.mes === mesAtual;
          const apagado = hover != null && hover !== i;
          return (
            <g
              key={d.mes}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="cursor-default"
              opacity={apagado ? 0.4 : 1}
            >
              <rect x={i * grupo} y={0} width={grupo} height={H + 34} fill="transparent" />
              <motion.path
                d={coluna(cx - bw - 1, d.assinadoValor)}
                className="fill-apr-signed"
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                style={{ transformOrigin: `0px ${H}px` }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.8, ease: EASE }}
              />
              <motion.path
                d={coluna(cx + 1, d.faturadoValor)}
                className="fill-apr-billed"
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                style={{ transformOrigin: `0px ${H}px` }}
                transition={{ delay: 0.28 + i * 0.08, duration: 0.8, ease: EASE }}
              />
              {atual && (
                // Rótulo do mês em destaque, ao lado do par de colunas (não sobre elas).
                <g
                  transform={`translate(${cx + bw + 130 < W ? cx + bw + 14 : cx - bw - 124}, ${y(Math.max(d.assinadoValor, d.faturadoValor)) + 6})`}
                >
                  <rect x={0} y={-9} width={10} height={10} rx={2} className="fill-apr-signed" />
                  <text x={16} y={0} className="fill-apr-text text-[15px] font-semibold">
                    {brlCurto(d.assinadoValor)}
                  </text>
                  <rect x={0} y={13} width={10} height={10} rx={2} className="fill-apr-billed" />
                  <text x={16} y={22} className="fill-apr-text text-[15px] font-semibold">
                    {brlCurto(d.faturadoValor)}
                  </text>
                </g>
              )}
              <text
                x={cx}
                y={H + 26}
                textAnchor="middle"
                className={
                  atual ? "fill-apr-text text-[16px] font-semibold" : "fill-apr-dim text-[15px]"
                }
              >
                {mesCurto(d.mes)}
              </text>
            </g>
          );
        })}
        <line x1={0} x2={W} y1={H} y2={H} className="stroke-apr-line" />
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute top-8 rounded-xl border border-apr-line bg-apr-bg/95 px-4 py-3 text-[15px] text-apr-text shadow-xl"
          style={{
            left: `clamp(0px, calc(${((hover + 0.5) / dados.length) * 100}% - 110px), calc(100% - 230px))`,
          }}
        >
          <div className="mb-1 font-semibold">{nomeMes(dados[hover].mes)}</div>
          <div className="flex items-center gap-2">
            <i className="h-2.5 w-2.5 rounded-sm bg-apr-signed" /> Assinado:{" "}
            <b>{brl(dados[hover].assinadoValor)}</b> ({int(dados[hover].assinadoQtd)})
          </div>
          <div className="flex items-center gap-2">
            <i className="h-2.5 w-2.5 rounded-sm bg-apr-billed" /> Faturado:{" "}
            <b>{brl(dados[hover].faturadoValor)}</b>
          </div>
        </div>
      )}
    </div>
  );
}

function Lista({
  itens,
  vazio,
  icone: Icon,
}: {
  itens: string[];
  vazio: string;
  icone: LucideIcon;
}) {
  if (!itens.length)
    return (
      <div className="flex h-[420px] items-center justify-center rounded-3xl border border-dashed border-apr-line text-xl text-apr-dim">
        {vazio}
      </div>
    );
  // Poucos itens: viram cartões grandes, para o recado ocupar o palco.
  if (itens.length <= 2)
    return (
      <ul className="grid gap-6">
        {itens.map((t, i) => (
          <Item
            key={i}
            i={i}
            className="flex items-start gap-7 rounded-[28px] border border-apr-line/70 bg-apr-surface/60 p-10"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-apr-signed/15 text-apr-glow">
              <Icon className="h-8 w-8" aria-hidden />
            </span>
            <span className="font-display text-[38px] font-semibold leading-tight text-apr-text">
              {t}
            </span>
          </Item>
        ))}
      </ul>
    );
  const duas = itens.length > 5;
  return (
    <ul className={"grid gap-4 " + (duas ? "grid-cols-2" : "grid-cols-1")}>
      {itens.map((t, i) => (
        <Item
          key={i}
          i={i}
          className="flex gap-4 rounded-2xl border border-apr-line/70 bg-apr-surface/60 p-5"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-apr-signed/15 text-apr-glow">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span className={(duas ? "text-[19px]" : "text-[23px]") + " leading-snug text-apr-text"}>
            {t}
          </span>
        </Item>
      ))}
    </ul>
  );
}

/**
 * Momento pitch de vendas: cronômetro com anel de progresso e sorteio de quem apresenta.
 * Teclas: T inicia/pausa · R zera · S sorteia. Os botões funcionam com o mouse.
 */
function MomentoPitch({ nomes }: { nomes: string[] }) {
  const [minutos, setMinutos] = useState(3);
  const [resta, setResta] = useState(180);
  const [rodando, setRodando] = useState(false);
  const [vez, setVez] = useState<string | null>(null);
  const [sorteando, setSorteando] = useState(false);
  const [ja, setJa] = useState<string[]>([]);

  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setResta((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [rodando]);
  useEffect(() => {
    if (resta === 0) setRodando(false);
  }, [resta]);

  const zerar = useCallback(() => {
    setRodando(false);
    setResta(minutos * 60);
  }, [minutos]);
  const ajustar = (d: number) => {
    const m = Math.min(15, Math.max(1, minutos + d));
    setMinutos(m);
    setRodando(false);
    setResta(m * 60);
  };
  const sortear = useCallback(() => {
    const livres = nomes.filter((n) => !ja.includes(n));
    const pool = livres.length ? livres : nomes;
    if (!pool.length || sorteando) return;
    setSorteando(true);
    let n = 0;
    const giro = setInterval(() => {
      setVez(pool[Math.floor(Math.random() * pool.length)]);
      if (++n >= 16) {
        clearInterval(giro);
        const escolhido = pool[Math.floor(Math.random() * pool.length)];
        setVez(escolhido);
        setJa((x) => (livres.length ? [...x, escolhido] : [escolhido]));
        setSorteando(false);
        setRodando(false);
        setResta(minutos * 60);
      }
    }, 90);
  }, [nomes, ja, sorteando, minutos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "t") setRodando((x) => (resta > 0 ? !x : x));
      else if (k === "r") zerar();
      else if (k === "s") sortear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resta, zerar, sortear]);

  const total = minutos * 60;
  const frac = total ? resta / total : 0;
  const R = 150;
  const C = 2 * Math.PI * R;
  const mm = String(Math.floor(resta / 60)).padStart(2, "0");
  const ss = String(resta % 60).padStart(2, "0");
  const fim = resta === 0;
  const alerta = !fim && resta <= 30;
  const botao =
    "rounded-2xl border border-apr-line bg-apr-surface/80 px-5 py-3 text-[17px] font-semibold text-apr-text transition-colors hover:border-apr-glow";

  return (
    <div className="relative z-20 h-full">
      <Kicker icon={Mic}>Momento pitch de vendas</Kicker>
      <Titulo>
        Venda para a gente em {minutos} minuto{minutos === 1 ? "" : "s"}
      </Titulo>
      <div className="mt-8 grid grid-cols-[1fr_440px] items-center gap-10">
        <div>
          <div className="text-[17px] uppercase tracking-[0.2em] text-apr-dim">
            Quem apresenta agora
          </div>
          <motion.div
            key={sorteando ? "giro" : (vez ?? "ninguem")}
            initial={{ opacity: 0.4, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className={
              "mt-3 min-h-[110px] font-display text-[84px] font-semibold leading-tight " +
              (vez ? "text-apr-text" : "text-apr-line")
            }
          >
            {vez ?? "Sorteie um nome"}
          </motion.div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={sortear} className={botao + " bg-apr-gold/15 text-apr-gold"}>
              <Sparkles className="mr-2 inline h-5 w-5" aria-hidden />
              Sortear (S)
            </button>
            <button onClick={() => setRodando((x) => (resta > 0 ? !x : x))} className={botao}>
              {rodando ? "Pausar" : "Iniciar"} (T)
            </button>
            <button onClick={zerar} className={botao}>
              Zerar (R)
            </button>
            <button onClick={() => ajustar(-1)} className={botao} aria-label="Menos um minuto">
              −1 min
            </button>
            <button onClick={() => ajustar(1)} className={botao} aria-label="Mais um minuto">
              +1 min
            </button>
          </div>
          <div className="mt-8 text-[16px] leading-relaxed text-apr-muted">
            Roteiro: <b className="text-apr-text">abertura</b> (quem é o cliente) ·{" "}
            <b className="text-apr-text">dor</b> (quanto paga de luz) ·{" "}
            <b className="text-apr-text">solução</b> (sistema e economia) ·{" "}
            <b className="text-apr-text">objeção</b> · <b className="text-apr-text">fechamento</b>.
          </div>
          {ja.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2 text-[14px]">
              <span className="text-apr-dim">Já apresentaram:</span>
              {ja.map((n) => (
                <span key={n} className="rounded-full bg-apr-surface px-3 py-0.5 text-apr-muted">
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="relative mx-auto h-[400px] w-[400px]">
          <svg viewBox="-200 -200 400 400" className="absolute inset-0 -rotate-90">
            <circle r={R} fill="none" className="stroke-apr-line" strokeWidth={14} />
            <motion.circle
              r={R}
              fill="none"
              strokeWidth={14}
              strokeLinecap="round"
              className={fim || alerta ? "stroke-apr-gold" : "stroke-apr-signed"}
              strokeDasharray={C}
              animate={{ strokeDashoffset: C * (1 - frac) }}
              transition={{ duration: 0.9, ease: "linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              animate={fim ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={fim ? { repeat: Infinity, duration: 0.8 } : {}}
              className={
                "font-display text-[76px] font-semibold tabular-nums leading-none " +
                (fim || alerta ? "text-apr-gold" : "text-apr-text")
              }
            >
              {fim ? "Tempo!" : `${mm}:${ss}`}
            </motion.div>
            <div className="mt-3 text-[16px] text-apr-dim">
              {fim ? "aplausos 👏" : rodando ? "valendo" : "pronto para começar"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const COR_CASA: Record<Casa["cor"], { bar: string; text: string; ring: string }> = {
  valaris: { bar: "bg-apr-valaris", text: "text-apr-valaris", ring: "border-apr-valaris/50" },
  nordran: { bar: "bg-apr-nordran", text: "text-apr-nordran", ring: "border-apr-nordran/50" },
  aureon: { bar: "bg-apr-aureon", text: "text-apr-aureon", ring: "border-apr-aureon/50" },
};

/** Barra de meta da casa, com a linha do mínimo exigido (71%). */
function BarraMeta({
  rotulo,
  valor,
  meta,
  fmt,
  minimo,
  cor,
  atraso,
}: {
  rotulo: string;
  valor: number;
  meta: number;
  fmt: (v: number) => string;
  minimo?: number;
  cor: string;
  atraso: number;
}) {
  const p = pctMeta(valor, meta);
  const ok = minimo == null || p >= minimo;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[16px]">
        <span className="text-apr-muted">{rotulo}</span>
        <span className="tabular-nums text-apr-muted">
          <b className="text-apr-text">{fmt(valor)}</b> / {fmt(meta)}
        </span>
      </div>
      <div className="relative mt-2 h-3 rounded-full bg-apr-line/60">
        <motion.div
          className={"h-full rounded-full " + cor}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, p)}%` }}
          transition={{ delay: atraso, duration: 1.1, ease: EASE }}
        />
        {minimo != null && (
          <span
            className="absolute -top-1 h-5 w-[2px] rounded bg-apr-text/70"
            style={{ left: `${minimo}%` }}
            title={`mínimo ${minimo}%`}
          />
        )}
      </div>
      <div
        className={
          "mt-1 text-right text-[15px] font-semibold " + (ok ? "text-apr-text" : "text-apr-dim")
        }
      >
        {pct(p, 0)}
        {minimo != null && (ok ? " ✓" : ` · mínimo ${minimo}%`)}
      </div>
    </div>
  );
}

function SlideCasas({ c, mes }: { c: Campanha; mes: string }) {
  return (
    <div>
      <Kicker icon={Crown}>Campanha de vendas</Kicker>
      <Titulo>A disputa das casas em {mes.toLowerCase()}</Titulo>
      <div className="mt-7 grid grid-cols-3 gap-6">
        {c.casas.map((k, i) => {
          const cor = COR_CASA[k.cor];
          return (
            <motion.div
              key={k.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.15, duration: 0.8, ease: EASE }}
              className={"rounded-[28px] border bg-apr-surface/70 p-6 backdrop-blur " + cor.ring}
            >
              <div className="flex items-center gap-4">
                <img src={k.brasao} alt={k.nome} className="h-[96px] w-auto" />
                <div>
                  <div className="font-display text-[28px] font-semibold leading-tight text-apr-text">
                    {k.nome}
                  </div>
                  <div
                    className={"text-[15px] font-semibold uppercase tracking-[0.16em] " + cor.text}
                  >
                    {k.unidade}
                  </div>
                  <div className="text-[14px] text-apr-dim">
                    {k.membros.map((x) => x.nome).join(" · ")}
                  </div>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <BarraMeta
                  rotulo="Prospecção"
                  valor={k.total.prosp}
                  meta={k.total.prospMeta}
                  fmt={int}
                  minimo={c.criterios.minProsp}
                  cor={cor.bar}
                  atraso={0.5 + i * 0.15}
                />
                <BarraMeta
                  rotulo="Vendas"
                  valor={k.total.vendas}
                  meta={k.total.vendasMeta}
                  fmt={int}
                  cor={cor.bar}
                  atraso={0.6 + i * 0.15}
                />
                <BarraMeta
                  rotulo="Faturamento"
                  valor={k.total.fat}
                  meta={k.total.fatMeta}
                  fmt={brlCurto}
                  minimo={c.criterios.minFat}
                  cor={cor.bar}
                  atraso={0.7 + i * 0.15}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
      <Item i={4} className="mt-5 flex items-center justify-between gap-6 text-[15px] text-apr-dim">
        <span>
          <b className="text-apr-muted">Critérios de conquista:</b> {c.criterios.texto.join(" · ")}.
          Meta conforme a rampagem da equipe.
        </span>
        <span className="shrink-0">Fonte: {c.fonte}</span>
      </Item>
    </div>
  );
}

function SlideTrono({ c }: { c: Campanha }) {
  const v = vencedora(c);
  /** O que a casa bateu e o que faltou nos mínimos de prospecção e faturamento. */
  const situacao = (k: Casa) => {
    const pp = pctMeta(k.total.prosp, k.total.prospMeta);
    const pf = pctMeta(k.total.fat, k.total.fatMeta);
    const bateu: string[] = [];
    const faltou: string[] = [];
    (pp >= c.criterios.minProsp ? bateu : faltou).push(`prospecção ${pct(pp, 0)}`);
    (pf >= c.criterios.minFat ? bateu : faltou).push(`faturamento ${pct(pf, 0)}`);
    return { bateu, faltou };
  };
  return (
    <div className="relative grid h-full grid-cols-[1fr_560px] items-center gap-10">
      <div>
        <Kicker icon={Crown}>O trono</Kicker>
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1, ease: EASE }}
          className="mt-5 font-display text-[92px] font-semibold leading-[0.98] tracking-tight text-apr-text"
        >
          {v ? (
            <>
              {v.nome}
              <br />
              <span className="text-apr-gold">conquista o trono</span>
            </>
          ) : (
            <>
              O trono
              <br />
              ainda aguarda
              <br />
              <span className="bg-gradient-to-r from-apr-gold to-apr-glow bg-clip-text text-transparent">
                seu soberano
              </span>
            </>
          )}
        </motion.h2>
        <Item i={3} className="mt-8 max-w-[700px] text-[22px] leading-snug text-apr-muted">
          {v
            ? "Bateu a prospecção, bateu o faturamento e fez mais vendas. A coroa é de vocês."
            : "Nenhuma casa fechou o mês com 71% da prospecção e 71% do faturamento. A coroa continua em jogo."}
        </Item>
        <div className="mt-8 space-y-3">
          {c.casas.map((k, i) => (
            <Item key={k.id} i={4 + i} className="flex items-center gap-4 text-[18px]">
              <img src={k.brasao} alt="" aria-hidden className="h-12 w-auto" />
              <span className="w-[190px] leading-tight">
                <span className="block font-semibold text-apr-text">{k.nome}</span>
                <span className="text-[14px] text-apr-dim">{k.unidade}</span>
              </span>
              <span className="flex flex-wrap gap-2 text-[16px]">
                {situacao(k).bateu.map((t) => (
                  <span key={t} className="rounded-full bg-success/15 px-3 py-0.5 text-success">
                    ✓ bateu {t}
                  </span>
                ))}
                {situacao(k).faltou.map((t) => (
                  <span key={t} className="rounded-full bg-apr-line/60 px-3 py-0.5 text-apr-muted">
                    ✗ faltou {t}
                  </span>
                ))}
              </span>
            </Item>
          ))}
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 1.4, ease: EASE }}
        className="relative flex h-[720px] items-end justify-center"
      >
        <div className="absolute bottom-6 h-[60px] w-[420px] rounded-[50%] bg-apr-gold/25 blur-2xl" />
        <img src="/apresentacao/trono.png" alt="Trono" className="relative h-[680px] w-auto" />
        {v && (
          <motion.img
            src={v.brasao}
            alt={v.nome}
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 1, ease: EASE }}
            className="absolute top-[150px] h-[200px] w-auto"
          />
        )}
      </motion.div>
    </div>
  );
}

/** Ocupa o palco inteiro, por baixo do conteúdo do slide (ignora o recuo das margens). */
function Sangria({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden
      className={
        "pointer-events-none absolute -bottom-[90px] -left-[88px] -right-[88px] -top-[72px] overflow-hidden " +
        className
      }
    >
      {children}
    </div>
  );
}

/** Raios de luz dourada descendo do alto + poeira de luz subindo. */
function LuzDourada({ intensidade = 1 }: { intensidade?: number }) {
  const poeira = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        x: (i * 53) % 100,
        y: 40 + ((i * 29) % 60),
        t: 7 + ((i * 17) % 9),
        d: ((i * 13) % 50) / 10,
        r: 1.5 + (i % 3),
      })),
    [],
  );
  return (
    <>
      <motion.div
        className="absolute left-1/2 top-[-420px] h-[1400px] w-[1400px] -translate-x-1/2 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,transparent_0deg,color-mix(in_oklch,var(--color-apr-gold)_22%,transparent)_8deg,transparent_16deg,transparent_30deg,color-mix(in_oklch,var(--color-apr-gold)_16%,transparent)_38deg,transparent_46deg,transparent_314deg,color-mix(in_oklch,var(--color-apr-gold)_16%,transparent)_322deg,transparent_330deg,transparent_344deg,color-mix(in_oklch,var(--color-apr-gold)_22%,transparent)_352deg,transparent_360deg)] blur-[18px]"
        initial={{ opacity: 0, rotate: -8 }}
        animate={{ opacity: intensidade, rotate: 8 }}
        transition={{
          opacity: { duration: 2.4 },
          rotate: { duration: 24, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
        }}
      />
      <motion.div
        className="absolute left-1/2 top-[-260px] h-[620px] w-[1100px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--color-apr-gold)_30%,transparent),transparent)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.55 * intensidade, 0.9 * intensidade, 0.55 * intensidade] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      {poeira.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-apr-gold"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.r, height: p.r }}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 0.9, 0], y: -260 }}
          transition={{ duration: p.t, delay: p.d, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

/** Trigal dourado balançando ao vento (desenhado em SVG). */
function Trigal() {
  const espigas = useMemo(
    () =>
      Array.from({ length: 64 }, (_, i) => {
        const x = (i / 63) * 1776 + (((i * 37) % 23) - 11);
        const h = 170 + ((i * 41) % 150);
        return {
          x,
          h,
          curva: ((i * 19) % 40) - 20,
          t: 3.6 + ((i * 7) % 20) / 10,
          atraso: ((i * 11) % 30) / 10,
          fundo: i % 3 === 0,
        };
      }),
    [],
  );
  return (
    <svg
      viewBox="0 0 1776 420"
      preserveAspectRatio="none"
      className="absolute inset-x-0 bottom-0 h-[420px] w-full"
    >
      <defs>
        <linearGradient id="trigo-g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-apr-gold)" stopOpacity="0.95" />
          <stop offset="1" stopColor="var(--color-apr-gold)" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {espigas.map((e, i) => {
        const base = 420;
        const topo = base - e.h;
        const cx = e.x + e.curva;
        return (
          <motion.g
            key={i}
            style={{ transformOrigin: `${e.x}px ${base}px` }}
            animate={{ rotate: [-2.5, 2.5, -2.5] }}
            transition={{ duration: e.t, delay: e.atraso, repeat: Infinity, ease: "easeInOut" }}
            opacity={e.fundo ? 0.35 : 0.8}
          >
            <path
              d={`M${e.x},${base} Q${e.x + e.curva * 0.4},${base - e.h * 0.5} ${cx},${topo}`}
              stroke="url(#trigo-g)"
              strokeWidth={2}
              fill="none"
            />
            {Array.from({ length: 7 }, (_, k) => {
              const yy = topo + 6 + k * 9;
              return (
                <g key={k}>
                  <ellipse
                    cx={cx - 4}
                    cy={yy}
                    rx={3}
                    ry={7}
                    transform={`rotate(-28 ${cx - 4} ${yy})`}
                    fill="url(#trigo-g)"
                  />
                  <ellipse
                    cx={cx + 4}
                    cy={yy}
                    rx={3}
                    ry={7}
                    transform={`rotate(28 ${cx + 4} ${yy})`}
                    fill="url(#trigo-g)"
                  />
                </g>
              );
            })}
            <line
              x1={cx}
              y1={topo}
              x2={cx + e.curva * 0.1}
              y2={topo - 22}
              stroke="var(--color-apr-gold)"
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          </motion.g>
        );
      })}
    </svg>
  );
}

/** Texto que aparece palavra por palavra; as palavras de `destaque` ganham o dourado. */
function Revela({
  texto,
  destaqueDe,
  atraso = 0,
  passo = 0.11,
  className = "",
}: {
  texto: string;
  destaqueDe?: number;
  atraso?: number;
  passo?: number;
  className?: string;
}) {
  const palavras = texto.split(" ");
  return (
    <span className={className}>
      {palavras.map((p, i) => {
        const ouro = destaqueDe != null && i >= destaqueDe;
        return (
          <motion.span
            key={i}
            className={
              "inline-block " +
              (ouro
                ? "bg-gradient-to-b from-apr-gold to-[color-mix(in_oklch,var(--color-apr-gold)_70%,var(--color-apr-glow))] bg-clip-text text-transparent"
                : "")
            }
            initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: atraso + i * passo, duration: 0.9, ease: EASE }}
          >
            {p}
            {i < palavras.length - 1 ? "\u00a0" : ""}
          </motion.span>
        );
      })}
    </span>
  );
}

/**
 * Equipe de apoio que nem sempre aparece no Ploomes (marketing, SDR, pós-vendas...).
 * Entra junto com quem teve lead ou venda no mês. Nomes como estão no Ploomes.
 */
const EQUIPE_APOIO = [
  "Alison Amaral",
  "Stephany Martins",
  "Dayan Machado",
  "Flavia Valerio",
  "Victor Oliveira",
  "Caio Souza",
  "Leticia Campos",
  "Maria Vitória",
  "Nioma Mesquita",
  "Pamela Ramos",
  "Kisuco",
  "Gabriel",
  "Foguinho",
];

/** Junta as listas sem repetir a mesma pessoa (compara nome e sobrenome sem acento). */
function juntaEquipe(...listas: string[][]) {
  const chave = (n: string) =>
    n
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 2)
      .join(" ");
  const vistos = new Map<string, string>();
  for (const l of listas)
    for (const n of l) if (n && !vistos.has(chave(n))) vistos.set(chave(n), n);
  return [...vistos.values()];
}

/**
 * Nomes que chegam flutuando de todos os cantos e se agrupam em dois anéis que giram
 * em sentidos opostos em volta de um sol. Quem está "na frente" do anel fica maior.
 */
function AnelEquipe({ nomes, centro }: { nomes: string[]; centro: ReactNode }) {
  const [t, setT] = useState(0);
  const inicio = useRef<number | null>(null);
  useAnimationFrame((agora) => {
    if (inicio.current == null) inicio.current = agora;
    setT((agora - inicio.current) / 1000);
  });
  const W = 1424;
  const H = 470;
  const cx = W / 2;
  const cy = H / 2;
  // três anéis, cada um com nomes proporcionais ao tamanho (o de fora leva mais),
  // girando em sentidos alternados e bem devagar
  const corte1 = Math.round(nomes.length * 0.44);
  const corte2 = corte1 + Math.round(nomes.length * 0.34);
  const aneis = [
    {
      rx: 650,
      ry: 205,
      vel: 0.014,
      nomes: nomes.slice(0, corte1),
      texto: "text-[23px]",
      borda: "border-apr-gold/45",
    },
    {
      rx: 455,
      ry: 128,
      vel: -0.018,
      nomes: nomes.slice(corte1, corte2),
      texto: "text-[21px]",
      borda: "border-apr-glow/40",
    },
    {
      rx: 255,
      ry: 60,
      vel: 0.022,
      nomes: nomes.slice(corte2),
      texto: "text-[19px]",
      borda: "border-apr-billed/40",
    },
  ];
  // espalhados pela tela antes de se agrupar
  const espalha = (i: number) => ({
    x: ((i * 397) % W) - cx,
    y: ((i * 211) % (H - 40)) - cy + 20, // espalhados só na área dos anéis, sem cobrir o título
  });
  const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  let k = 0;
  return (
    <div className="relative" style={{ width: W, height: H }}>
      <div className="absolute inset-0 flex items-center justify-center">{centro}</div>
      {aneis.flatMap((a, ai) =>
        a.nomes.map((nome, i) => {
          const idx = k++;
          const ang = (i / a.nomes.length) * Math.PI * 2 + t * a.vel * Math.PI * 2;
          const profundidade = (Math.sin(ang) + 1) / 2; // 0 = atrás, 1 = na frente
          const alvoX = Math.cos(ang) * a.rx;
          const alvoY = Math.sin(ang) * a.ry;
          // flutua solto e vai se juntando entre 2,8 s e 5,5 s
          const g = ease((t - 2.8 - idx * 0.04) / 2.7);
          const e = espalha(idx);
          const flutua = Math.sin(t * 1.3 + idx) * 10 * (1 - g);
          const x = e.x + (alvoX - e.x) * g;
          const y = e.y + (alvoY - e.y) * g + flutua;
          const escala = 0.72 + 0.4 * (g * profundidade + (1 - g) * 0.6);
          const surge = ease((t - 0.4 - idx * 0.07) / 0.8);
          const op = surge * (0.45 + 0.55 * (g * profundidade + (1 - g)));
          return (
            <span
              key={nome}
              className={
                "absolute left-0 top-0 whitespace-nowrap rounded-full border px-4 py-1.5 font-semibold backdrop-blur " +
                "bg-apr-bg/70 px-5 py-2 text-apr-text " +
                a.texto +
                " " +
                a.borda
              }
              style={{
                transform: `translate(${cx + x}px, ${cy + y}px) translate(-50%, -50%) scale(${escala})`,
                opacity: op,
                zIndex: Math.round(profundidade * 100) + ai,
                filter: g > 0.9 && profundidade < 0.25 ? "blur(0.6px)" : undefined,
              }}
            >
              {nome}
            </span>
          );
        }),
      )}
    </div>
  );
}

/** Sol em órbita da capa: anéis girando em volta do valor assinado no mês. */
function Orbita({ valor, kwp }: { valor: number; kwp: number }) {
  const aneis = [
    { r: 250, dur: 60, dots: 3, cls: "stroke-apr-line" },
    { r: 196, dur: 42, dots: 2, cls: "stroke-apr-signed/40" },
    { r: 142, dur: 28, dots: 1, cls: "stroke-apr-billed/40" },
  ];
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 1.4, ease: EASE }}
      className="pointer-events-none absolute right-[-40px] top-1/2 h-[540px] w-[540px] -translate-y-1/2"
    >
      <div className="absolute inset-[150px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-apr-gold)_55%,transparent),color-mix(in_oklch,var(--color-apr-signed)_18%,transparent)_55%,transparent_72%)] blur-[2px]" />
      {aneis.map((a, i) => (
        <motion.svg
          key={a.r}
          viewBox="-270 -270 540 540"
          className="absolute inset-0"
          animate={{ rotate: i % 2 ? -360 : 360 }}
          transition={{ repeat: Infinity, duration: a.dur, ease: "linear" }}
        >
          <circle r={a.r} fill="none" className={a.cls} strokeWidth={1.5} strokeDasharray="2 10" />
          {Array.from({ length: a.dots }, (_, k) => {
            const ang = (k / a.dots) * Math.PI * 2 + i;
            return (
              <circle
                key={k}
                cx={Math.cos(ang) * a.r}
                cy={Math.sin(ang) * a.r}
                r={i === 0 ? 5 : 7}
                className={
                  i === 1 ? "fill-apr-glow" : i === 2 ? "fill-apr-billed" : "fill-apr-gold"
                }
              />
            );
          })}
        </motion.svg>
      ))}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[14px] font-semibold uppercase tracking-[0.25em] text-apr-text/80">
          Assinado
        </div>
        <div className="mt-1 font-display text-[52px] font-semibold leading-none text-apr-text">
          <Conta valor={valor} formato={brlCurto} duracao={2} />
        </div>
        {kwp > 0 && (
          <div className="mt-2 text-[16px] text-apr-text/80">{int(kwp)} kWp em energia solar</div>
        )}
      </div>
    </motion.div>
  );
}

/** Confete do reconhecimento (decorativo). */
function Confete() {
  const pecas = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        x: (i * 37) % 100,
        d: 2.6 + ((i * 13) % 20) / 10,
        atraso: ((i * 7) % 30) / 20,
        rot: (i * 47) % 360,
        cor: i % 3,
        w: 6 + (i % 4) * 2,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pecas.map((p, i) => (
        <motion.span
          key={i}
          className={
            "absolute top-0 block rounded-[2px] " +
            (p.cor === 0 ? "bg-apr-gold" : p.cor === 1 ? "bg-apr-glow" : "bg-apr-billed")
          }
          style={{ left: `${p.x}%`, width: p.w, height: p.w * 0.45 }}
          initial={{ y: -40, rotate: p.rot, opacity: 0 }}
          animate={{ y: 960, rotate: p.rot + 540, opacity: [0, 1, 1, 0] }}
          transition={{ duration: p.d, delay: p.atraso, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slides                                                              */
/* ------------------------------------------------------------------ */

type Slide = { id: string; titulo: string; icone: LucideIcon; render: () => ReactNode };

function montaSlides(r: RelatorioMes, n: NotasApresentacao, hojeLongo: string): Slide[] {
  const mes = nomeMes(r.mes);
  const ant = nomeMes(r.mesAnterior);
  const ano = r.mes.slice(0, 4);
  const unidades = Array.from(
    new Set([
      ...r.assinado.porUnidade.map((u) => u.chave),
      ...r.faturado.porUnidade.map((u) => u.chave),
      ...r.leads.porUnidade.map((u) => u.chave),
    ]),
  ).filter((u) => u !== "Sem unidade");
  const porUni = (lista: Agregado[], u: string) =>
    lista.find((x) => x.chave === u) ?? { chave: u, qtd: 0, valor: 0 };
  /** Quem mais vendeu (valor) em cada unidade, pela unidade de cada venda. */
  const destaqueUni = (u: string) => {
    const m = new Map<string, { nome: string; qtd: number; valor: number }>();
    for (const v of r.assinado.vendas) {
      if (v.unidade !== u) continue;
      const x = m.get(v.vendedor) ?? { nome: v.vendedor, qtd: 0, valor: 0 };
      x.qtd++;
      x.valor += v.valor;
      m.set(v.vendedor, x);
    }
    return [...m.values()].sort((a, b) => b.valor - a.valor)[0] ?? null;
  };
  const semUni = {
    ass: porUni(r.assinado.porUnidade, "Sem unidade"),
    fat: porUni(r.faturado.porUnidade, "Sem unidade"),
  };
  const topUniValor = Math.max(
    1,
    ...unidades.flatMap((u) => [
      porUni(r.assinado.porUnidade, u).valor,
      porUni(r.faturado.porUnidade, u).valor,
    ]),
  );

  const campanha = CAMPANHAS[r.mes] ?? null;
  const slides: Slide[] = [
    {
      id: "capa",
      titulo: "Abertura",
      icone: Sun,
      render: () => (
        <div className="relative flex h-full flex-col justify-center">
          <Orbita valor={r.assinado.valor} kwp={r.assinado.kwp} />
          <Item>
            <img
              src="/apresentacao/lz7-energia-branco.png"
              alt="LZ7 Energia"
              className="h-[128px] w-auto"
            />
          </Item>
          <Item i={1} className="mt-9 flex items-center gap-4">
            <motion.span
              className="h-[2px] w-20 origin-left rounded-full bg-gradient-to-r from-apr-glow to-transparent"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5, duration: 1, ease: EASE }}
            />
            <span className="text-[20px] font-semibold uppercase tracking-[0.32em] text-apr-glow">
              Reunião de resultados
            </span>
          </Item>
          <Item i={2}>
            <h1 className="mt-3 bg-gradient-to-r from-apr-text via-apr-text to-apr-glow bg-clip-text pb-2 font-display text-[132px] font-semibold leading-[0.95] tracking-tight text-transparent">
              {mes}
            </h1>
          </Item>
          <Item i={3}>
            <div className="font-display text-[132px] font-semibold leading-[0.9] tracking-tight text-transparent [-webkit-text-stroke:2px_var(--color-apr-muted)]">
              {ano}
            </div>
          </Item>
          <Item i={4} className="mt-6 max-w-[820px] text-[26px] leading-snug text-apr-muted">
            Quanto vendemos, quanto faturamos e quem fez acontecer.
          </Item>
          <div className="mt-10 grid w-[760px] grid-cols-3 gap-4">
            {(
              [
                [Users, "leads no mês", int(r.leads.total), "bg-apr-glow"],
                [FileSignature, "vendas assinadas", int(r.assinado.qtd), "bg-apr-signed"],
                [Receipt, "faturados", brlCurto(r.faturado.valor), "bg-apr-billed"],
              ] as const
            ).map(([Icon, rot, valor, cor], i) => (
              <Item
                key={rot}
                i={5 + i}
                className="relative overflow-hidden rounded-2xl border border-apr-line/80 bg-apr-surface/70 px-5 py-4 backdrop-blur"
              >
                <span className={"absolute inset-x-0 top-0 h-[3px] " + cor} />
                <div className="flex items-center gap-2 text-[15px] text-apr-muted">
                  <Icon className="h-4 w-4 text-apr-glow" aria-hidden />
                  {rot}
                </div>
                <div className="mt-1.5 font-display text-[34px] font-semibold leading-none text-apr-text">
                  {valor}
                </div>
              </Item>
            ))}
          </div>
          <Item
            i={8}
            className="absolute bottom-0 left-0 flex items-center gap-2 text-[17px] text-apr-dim"
          >
            <Sun className="h-4 w-4 text-apr-gold" aria-hidden />
            {hojeLongo}
          </Item>
        </div>
      ),
    },
    {
      id: "proverbios",
      titulo: "Provérbios 11:26",
      icone: Heart,
      render: () => {
        const verso =
          "O povo amaldiçoa aquele que esconde o trigo, mas a bênção coroa aquele que se dispõe a vendê-lo.";
        const destaque = verso.split(" ").indexOf("bênção");
        return (
          <div className="relative flex h-full flex-col items-center justify-center text-center">
            <Sangria>
              <div className="absolute inset-0 bg-apr-bg/70" />
              <LuzDourada />
            </Sangria>
            <motion.div
              initial={{ opacity: 0, letterSpacing: "0.6em" }}
              animate={{ opacity: 1, letterSpacing: "0.38em" }}
              transition={{ duration: 2, ease: EASE }}
              className="relative text-[18px] font-semibold uppercase text-apr-gold"
            >
              Provérbios 11:26
            </motion.div>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6, duration: 1.4, ease: EASE }}
              className="relative mt-6 h-px w-[220px] bg-gradient-to-r from-transparent via-apr-gold to-transparent"
            />
            <blockquote className="relative mt-12 max-w-[1260px] font-display text-[66px] font-light leading-[1.22] tracking-tight text-apr-text">
              <Revela texto={verso} destaqueDe={destaque} atraso={1.1} passo={0.16} />
            </blockquote>
          </div>
        );
      },
    },
    {
      id: "trigo",
      titulo: "O nosso trigo",
      icone: Heart,
      render: () => {
        const nomes = juntaEquipe(
          r.vendedores.map((v) => v.nome),
          r.equipe ?? [],
          EQUIPE_APOIO,
        );
        return (
          <div className="relative flex h-full flex-col">
            <Sangria>
              <LuzDourada intensidade={0.55} />
              <Trigal />
              <div className="absolute inset-x-0 bottom-0 h-[160px] bg-gradient-to-t from-apr-bg to-transparent" />
            </Sangria>
            <Item
              i={0}
              className="relative text-[18px] font-semibold uppercase tracking-[0.32em] text-apr-gold"
            >
              O nosso trigo
            </Item>
            <h2 className="relative mt-3 max-w-[1424px] font-display text-[44px] font-semibold leading-[1.1] tracking-tight text-apr-text">
              <Revela
                texto="A energia do sol não serve de nada guardada."
                atraso={0.3}
                passo={0.09}
              />
              <br />
              <Revela
                texto="Ela só vira bênção nas mãos de quem tem coragem de oferecer."
                destaqueDe={5}
                atraso={1.2}
                passo={0.09}
              />
            </h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.8, duration: 1.2, ease: EASE }}
              className="relative mt-3 max-w-[1400px] text-[21px] leading-relaxed text-apr-muted"
            >
              Em {mes.toLowerCase()},{" "}
              <b className="text-apr-text">
                <Conta valor={r.assinado.qtd} duracao={2.4} /> famílias e empresas disseram sim
              </b>
              . Cada sim passou pelas mãos de alguém deste time, de quem atende a quem instala. A
              LZ7 é do tamanho da coragem de vocês.
            </motion.p>
            <div className="relative -mx-[88px] mt-0 flex justify-center">
              <AnelEquipe
                nomes={nomes}
                centro={
                  <motion.div
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 4.6, duration: 1.4, ease: EASE }}
                    className="relative flex h-[150px] w-[150px] flex-col items-center justify-center rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-apr-gold)_55%,transparent),transparent_70%)] text-center"
                  >
                    <div className="font-display text-[44px] font-semibold leading-none text-apr-text">
                      {nomes.length}
                    </div>
                    <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-apr-text/80">
                      Time LZ7
                    </div>
                  </motion.div>
                }
              />
            </div>
          </div>
        );
      },
    },
    {
      id: "grupo",
      titulo: "Grupo LZ7",
      icone: Sun,
      render: () => (
        <div className="relative flex h-full flex-col justify-center">
          <Kicker icon={Sun}>Grupo LZ7</Kicker>
          <Item i={1}>
            <h2 className="mt-6 max-w-[1250px] font-display text-[68px] font-semibold leading-[1.08] tracking-tight text-apr-text">
              Um ecossistema em{" "}
              <span className="bg-gradient-to-r from-apr-glow to-apr-billed bg-clip-text text-transparent">
                energia limpa e mobilidade elétrica
              </span>
            </h2>
          </Item>
          <Item i={2} className="mt-6 max-w-[1100px] text-[28px] leading-snug text-apr-muted">
            Com atuação em educação, usinas solares e eletropostos.
          </Item>
          <div className="mt-14 grid grid-cols-4 gap-6">
            {(
              [
                ["/apresentacao/lz7-energia-branco.png", "LZ7 Energia", "Usinas solares"],
                ["/apresentacao/marca-eletroposto.png", "LZ7 Eletroposto", "Recarga de veículos"],
                ["/apresentacao/marca-mob.png", "LZ7 Mob", "Mobilidade elétrica"],
                ["/apresentacao/marca-pandora.png", "Pandora Energia", "Energia por assinatura"],
              ] as const
            ).map(([src, nome, papel], i) => (
              <Item
                key={nome}
                i={3 + i}
                className="flex h-[230px] flex-col items-center justify-between rounded-3xl border border-apr-line/80 bg-apr-surface/60 px-6 pb-6 pt-8 backdrop-blur"
              >
                <img src={src} alt={nome} className="h-[110px] w-auto max-w-full object-contain" />
                <div className="text-center">
                  <div className="font-display text-[20px] font-semibold text-apr-text">{nome}</div>
                  <div className="text-[15px] text-apr-muted">{papel}</div>
                </div>
              </Item>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "socios",
      titulo: "Sócios fundadores",
      icone: Users,
      render: () => {
        const pessoas = [
          {
            nome: ["Luiz Henrique", "Oliveira"],
            foto: "/apresentacao/socio-luiz-henrique.png",
            fatos: [
              "Engenheiro Eletricista · 2018",
              "Geração de Energia Sustentável",
              "~10 anos de mercado",
            ],
            frase: null as string | null,
            luz: "var(--color-apr-glow)",
          },
          {
            nome: ["Nelton Shishito", "Junior"],
            foto: "/apresentacao/socio-nelton.png",
            fatos: [
              "Engenheiro Eletricista · 2018",
              "Geração de Energia e Backup",
              "~10 anos de mercado",
            ],
            frase: "Vendas é pressão." as string | null,
            luz: "var(--color-apr-gold)",
          },
        ];
        return (
          <div className="relative h-full">
            <Sangria>
              <div className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-apr-line to-transparent" />
            </Sangria>
            <Item
              i={0}
              className="relative text-center text-[18px] font-semibold uppercase tracking-[0.32em] text-apr-gold"
            >
              Sócios fundadores do Grupo LZ7
            </Item>
            <div className="absolute -bottom-[90px] -left-[88px] -right-[88px] top-[30px] grid grid-cols-2">
              {pessoas.map((p, i) => (
                <div key={p.foto} className="relative overflow-hidden">
                  <motion.div
                    aria-hidden
                    className="absolute bottom-[40px] left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full"
                    style={{
                      background: `radial-gradient(closest-side, color-mix(in oklch, ${p.luz} 28%, transparent), transparent)`,
                    }}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.3, duration: 1.6, ease: EASE }}
                  />
                  <motion.img
                    src={p.foto}
                    alt={p.nome.join(" ")}
                    initial={{ opacity: 0, y: 60, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.35 + i * 0.3, duration: 1.4, ease: EASE }}
                    className={
                      "absolute bottom-0 right-[-10px] h-[740px] w-auto [mask-image:linear-gradient(to_bottom,black_70%,transparent_98%)]"
                    }
                  />
                  <div className="absolute inset-x-0 bottom-0 h-[300px] bg-gradient-to-t from-apr-bg via-apr-bg/70 to-transparent" />
                  {/* escurece o lado do texto: o nome nunca briga com a foto */}
                  <div className="absolute inset-y-0 left-0 w-[62%] bg-gradient-to-r from-apr-bg/85 via-apr-bg/50 to-transparent [mask-image:linear-gradient(to_bottom,transparent,black_45%)]" />
                  <div className="absolute bottom-[110px] left-[108px] [text-shadow:0_4px_28px_rgb(0_0_0/0.85)]">
                    <motion.div
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.9 + i * 0.3, duration: 1, ease: EASE }}
                      className="font-display text-[62px] font-semibold leading-[0.95] tracking-tight text-apr-text"
                    >
                      {p.nome[0]}
                      <br />
                      <span className="text-apr-muted">{p.nome[1]}</span>
                    </motion.div>
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 1.3 + i * 0.3, duration: 0.9, ease: EASE }}
                      className="mt-5 h-[3px] w-24 origin-left rounded-full"
                      style={{ background: p.luz }}
                    />
                    <motion.ul
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.5 + i * 0.3, duration: 1 }}
                      className="mt-4 space-y-1 text-[18px] text-apr-muted"
                    >
                      {p.fatos.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </motion.ul>
                  </div>
                  {p.frase && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
                      animate={{ opacity: 1, scale: 1, rotate: -3 }}
                      transition={{ delay: 2.2, duration: 1, ease: EASE }}
                      className="absolute left-[108px] top-[150px] max-w-[320px] font-display text-[50px] font-semibold leading-[1.05] text-apr-gold [text-shadow:0_4px_28px_rgb(0_0_0/0.85)]"
                    >
                      “{p.frase}”
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      },
    },
    {
      id: "numeros",
      titulo: "O mês em números",
      icone: Zap,
      render: () => {
        const tiles: {
          icon: LucideIcon;
          rotulo: string;
          valor: number;
          fmt: (v: number) => string;
          sub: ReactNode;
          delta: [number, number];
        }[] = [
          {
            icon: Users,
            rotulo: "Leads novos",
            valor: r.leads.total,
            fmt: int,
            sub: "contatos com negócio aberto no mês",
            delta: [r.leads.total, r.leads.anterior],
          },
          {
            icon: FileSignature,
            rotulo: "Vendas assinadas",
            valor: r.assinado.valor,
            fmt: brlCurto,
            sub: `${int(r.assinado.qtd)} contratos ganhos no Comercial`,
            delta: [r.assinado.valor, r.assinado.anterior.valor],
          },
          {
            icon: Receipt,
            rotulo: "Faturado",
            valor: r.faturado.valor,
            fmt: brlCurto,
            sub: `${int(r.faturado.qtd)} contratos iniciados no Financeiro`,
            delta: [r.faturado.valor, r.faturado.anterior.valor],
          },
          {
            icon: BadgeDollarSign,
            rotulo: "Ticket médio",
            valor: r.assinado.ticket,
            fmt: brlCurto,
            sub: r.assinado.kwp ? `${int(r.assinado.kwp)} kWp vendidos` : "por venda assinada",
            delta: [
              r.assinado.ticket,
              r.assinado.anterior.qtd ? r.assinado.anterior.valor / r.assinado.anterior.qtd : 0,
            ],
          },
        ];
        return (
          <div>
            <Kicker icon={Zap}>O mês em números</Kicker>
            <Titulo>{mes} de ponta a ponta</Titulo>
            <div className="mt-12 grid grid-cols-2 gap-6">
              {tiles.map((t, i) => (
                <Item key={t.rotulo} i={i}>
                  <Painel className="relative overflow-hidden">
                    <div className="flex items-center gap-3 text-[18px] text-apr-muted">
                      <t.icon className="h-6 w-6 text-apr-glow" aria-hidden />
                      {t.rotulo}
                    </div>
                    <div className="mt-4 font-display text-[76px] font-semibold leading-none text-apr-text">
                      <Conta valor={t.valor} formato={t.fmt} />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-4 text-[16px] text-apr-muted">
                      <span>{t.sub}</span>
                      <Delta atual={t.delta[0]} anterior={t.delta[1]} rotulo={ant.toLowerCase()} />
                    </div>
                  </Painel>
                </Item>
              ))}
            </div>
          </div>
        );
      },
    },
    {
      id: "leads",
      titulo: "Leads",
      icone: Users,
      render: () => (
        <div>
          <Kicker icon={Users}>Leads</Kicker>
          <Titulo>De onde veio cada cliente</Titulo>
          <div className="mt-10 grid h-[560px] grid-cols-[1fr_1.1fr_0.9fr] gap-6">
            <Item i={0}>
              <Painel className="flex h-full flex-col">
                <div className="text-[18px] text-apr-muted">Leads novos em {mes.toLowerCase()}</div>
                <div className="mt-2 font-display text-[104px] font-semibold leading-none text-apr-text">
                  <Conta valor={r.leads.total} />
                </div>
                <div className="mt-4 text-[17px]">
                  <Delta
                    atual={r.leads.total}
                    anterior={r.leads.anterior}
                    rotulo={ant.toLowerCase()}
                  />
                </div>
                <div className="mt-auto">
                  <div className="mb-4 text-[15px] uppercase tracking-[0.18em] text-apr-dim">
                    Dia a dia
                  </div>
                  <Diario serie={r.leads.porDia} cor="signed" rotulo="leads" altura={130} />
                </div>
              </Painel>
            </Item>
            <Item i={1}>
              <Painel className="h-full">
                <div className="mb-5 text-[15px] uppercase tracking-[0.18em] text-apr-dim">
                  Por origem
                </div>
                <Barras dados={r.leads.porOrigem} medida="qtd" max={6} />
              </Painel>
            </Item>
            <Item i={2}>
              <Painel className="h-full">
                <div className="mb-5 text-[15px] uppercase tracking-[0.18em] text-apr-dim">
                  Por unidade
                </div>
                <Barras dados={r.leads.porUnidade} medida="qtd" max={4} />
              </Painel>
            </Item>
          </div>
        </div>
      ),
    },
    {
      id: "vendas",
      titulo: "Assinado x faturado",
      icone: FileSignature,
      render: () => (
        <div>
          <Kicker icon={FileSignature}>Vendas</Kicker>
          <Titulo>Assinado x faturado</Titulo>
          <div className="mt-8 grid grid-cols-2 gap-6">
            {(
              [
                [
                  "signed",
                  "Assinado",
                  "contrato ganho no Comercial",
                  r.assinado.valor,
                  r.assinado.qtd,
                  r.assinado.anterior.valor,
                ],
                [
                  "billed",
                  "Faturado",
                  "contrato iniciado no Financeiro",
                  r.faturado.valor,
                  r.faturado.qtd,
                  r.faturado.anterior.valor,
                ],
              ] as const
            ).map(([cor, rotulo, def, valor, qtd, anterior], i) => (
              <Item key={rotulo} i={i}>
                <Painel className="relative overflow-hidden py-6">
                  <span
                    className={
                      "absolute inset-y-0 left-0 w-1.5 " +
                      (cor === "signed" ? "bg-apr-signed" : "bg-apr-billed")
                    }
                  />
                  <div className="flex items-baseline justify-between">
                    <div className="font-display text-[26px] font-semibold text-apr-text">
                      {rotulo}
                    </div>
                    <div className="text-[15px] text-apr-dim">{def}</div>
                  </div>
                  <div className="mt-3 font-display text-[62px] font-semibold leading-none text-apr-text">
                    <Conta valor={valor} formato={brl} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[17px] text-apr-muted">
                    <span>
                      <b className="text-apr-text">{int(qtd)}</b> contratos
                    </span>
                    <Delta atual={valor} anterior={anterior} rotulo={ant.toLowerCase()} />
                  </div>
                </Painel>
              </Item>
            ))}
          </div>
          <Item i={2} className="mt-6">
            <Painel className="py-5">
              <Historico dados={r.historico} mesAtual={r.mes} />
            </Painel>
          </Item>
          {r.assinado.assinatura.qtd > 0 && (
            <Item i={3} className="mt-3 text-[15px] text-apr-dim">
              Fora da contagem: {int(r.assinado.assinatura.qtd)} contratos de energia por assinatura
              ({brlCurto(r.assinado.assinatura.valor)}).
            </Item>
          )}
        </div>
      ),
    },
    {
      id: "margem",
      titulo: "Margem",
      icone: Percent,
      render: () => {
        const m = r.margem;
        const semMargem = m.vendasTotal - m.vendasComMargem;
        if (m.mediaPonderada == null)
          return (
            <div>
              <Kicker icon={Percent}>Margem</Kicker>
              <Titulo>Margem líquida média ponderada</Titulo>
              <Item i={1} className="mt-12 text-[26px] text-apr-muted">
                Sem vendas assinadas em {mes.toLowerCase()}.
              </Item>
            </div>
          );
        return (
          <div>
            <Kicker icon={Percent}>Margem</Kicker>
            <Titulo>Margem líquida média ponderada</Titulo>
            <div className="mt-10 grid grid-cols-[500px_1fr] gap-6">
              <Item i={0}>
                <Painel className="h-full">
                  <div className="text-[18px] text-apr-muted">
                    Sobre tudo que cada um faturou no mês
                  </div>
                  <div className="mt-3 font-display text-[120px] font-semibold leading-none text-apr-text">
                    <Conta valor={m.mediaPonderada} formato={(v) => pct(v)} />
                  </div>
                  <div className="mt-6 rounded-2xl border border-apr-line/70 bg-apr-bg/40 px-5 py-4 text-[17px] leading-relaxed text-apr-muted">
                    <b className="text-apr-text">Σ (margem × valor faturado) ÷ Σ valor faturado</b>
                    <br />
                    Sem margem registrada, o contrato entra com{" "}
                    <b className="text-apr-text">{pct(m.padrao, 0)}</b>.
                  </div>
                  <div className="mt-5 space-y-2 text-[17px] text-apr-muted">
                    <div>
                      Com margem registrada:{" "}
                      <b className="text-apr-text">{int(m.vendasComMargem)}</b> contratos ·{" "}
                      {brlCurto(m.valorComMargem)}
                      {m.mediaRegistradas != null && (
                        <>
                          {" "}
                          · média <b className="text-apr-text">{pct(m.mediaRegistradas)}</b>
                        </>
                      )}
                    </div>
                    <div>
                      Consideradas a {pct(m.padrao, 0)}:{" "}
                      <b className="text-apr-text">{int(semMargem)}</b> contratos ·{" "}
                      {brlCurto(m.valorTotal - m.valorComMargem)}
                    </div>
                  </div>
                  <div className="mt-4 text-[13px] leading-snug text-apr-dim">
                    Fonte: {m.campos.join(", ")} no Ploomes.
                  </div>
                </Painel>
              </Item>
              <Item i={1}>
                <Painel className="h-full">
                  <div className="mb-3 flex items-baseline justify-between text-[15px] uppercase tracking-[0.18em] text-apr-dim">
                    <span>Por vendedor</span>
                    <span className="normal-case tracking-normal">com margem / faturados</span>
                  </div>
                  <table className="w-full text-[18px]">
                    <tbody>
                      {m.porVendedor.slice(0, 9).map((v) => (
                        <tr key={v.nome} className="border-b border-apr-line/50 last:border-0">
                          <td className="py-2.5 text-apr-text">{v.nome}</td>
                          <td className="py-2.5 text-right tabular-nums text-apr-muted">
                            {int(v.comMargem)}/{int(v.vendas)}
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-apr-muted">
                            {brlCurto(v.valor)}
                          </td>
                          <td className="py-2.5 text-right font-semibold tabular-nums text-apr-text">
                            {pct(v.media)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Painel>
              </Item>
            </div>
          </div>
        );
      },
    },
    {
      id: "unidades",
      titulo: "Unidades",
      icone: Building2,
      render: () => (
        <div>
          <Kicker icon={Building2}>Vendas por unidade</Kicker>
          <Titulo>Cada base, um resultado</Titulo>
          <div
            className={"mt-10 grid gap-6 " + (unidades.length >= 3 ? "grid-cols-3" : "grid-cols-2")}
          >
            {unidades.map((u, i) => {
              const a = porUni(r.assinado.porUnidade, u);
              const f = porUni(r.faturado.porUnidade, u);
              const l = porUni(r.leads.porUnidade, u);
              return (
                <Item key={u} i={i}>
                  <Painel className="h-full">
                    <div className="font-display text-[30px] font-semibold text-apr-text">{u}</div>
                    <div className="text-[16px] text-apr-dim">{int(l.qtd)} leads no mês</div>
                    {(
                      [
                        ["signed", "Assinado", a],
                        ["billed", "Faturado", f],
                      ] as const
                    ).map(([cor, rot, x]) => (
                      <div key={rot} className="mt-7">
                        <div className="flex items-baseline justify-between text-[17px]">
                          <span className="text-apr-muted">{rot}</span>
                          <span className="text-apr-muted">
                            <b className="mr-2 font-display text-[30px] font-semibold text-apr-text">
                              {brlCurto(x.valor)}
                            </b>
                            {int(x.qtd)}
                          </span>
                        </div>
                        <div className="mt-2 h-3 overflow-hidden rounded-full bg-apr-line/60">
                          <motion.div
                            className={
                              "h-full rounded-full " +
                              (cor === "signed" ? "bg-apr-signed" : "bg-apr-billed")
                            }
                            initial={{ width: 0 }}
                            animate={{ width: `${(x.valor / topUniValor) * 100}%` }}
                            transition={{
                              delay: 0.3 + i * 0.1,
                              duration: 1,
                              ease: EASE,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <dl className="mt-7 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-apr-line/60 pt-5 text-[16px]">
                      <div>
                        <dt className="text-apr-dim">Conversão</dt>
                        <dd className="font-display text-[26px] font-semibold text-apr-text">
                          {l.qtd ? pct((a.qtd / l.qtd) * 100) : "—"}
                        </dd>
                        <dd className="text-[13px] text-apr-dim">assinadas ÷ leads</dd>
                      </div>
                      <div>
                        <dt className="text-apr-dim">Ticket médio</dt>
                        <dd className="font-display text-[26px] font-semibold text-apr-text">
                          {a.qtd ? brlCurto(a.valor / a.qtd) : "—"}
                        </dd>
                        <dd className="text-[13px] text-apr-dim">por venda assinada</dd>
                      </div>
                      {destaqueUni(u) && (
                        <div className="col-span-2 flex items-center gap-3 rounded-2xl bg-apr-gold/10 px-4 py-3">
                          <Crown className="h-5 w-5 shrink-0 text-apr-gold" aria-hidden />
                          <span className="text-apr-muted">
                            Destaque: <b className="text-apr-text">{destaqueUni(u)!.nome}</b> ·{" "}
                            {brlCurto(destaqueUni(u)!.valor)} em {int(destaqueUni(u)!.qtd)}{" "}
                            {destaqueUni(u)!.qtd === 1 ? "venda" : "vendas"}
                          </span>
                        </div>
                      )}
                    </dl>
                  </Painel>
                </Item>
              );
            })}
          </div>
          {(semUni.ass.qtd > 0 || semUni.fat.qtd > 0) && (
            <Item i={4} className="mt-5 text-[16px] text-apr-dim">
              Sem unidade no Ploomes: {int(semUni.ass.qtd)} assinadas ({brlCurto(semUni.ass.valor)})
              e {int(semUni.fat.qtd)} faturadas ({brlCurto(semUni.fat.valor)}).
            </Item>
          )}
        </div>
      ),
    },
    {
      id: "prospeccao",
      titulo: "Prospecção ativa",
      icone: Target,
      render: () => {
        const p = r.prospeccao;
        return (
          <div>
            <Kicker icon={Target}>Prospecção ativa</Kicker>
            <Titulo>O que o time gerou na rua</Titulo>
            <div className="mt-10 grid grid-cols-[1fr_1.3fr] gap-6">
              <Item i={0} className="space-y-6">
                <Painel>
                  <div className="text-[18px] text-apr-muted">
                    Leads de prospecção e ligação ativa
                  </div>
                  <div className="mt-2 font-display text-[96px] font-semibold leading-none text-apr-text">
                    <Conta valor={p.leads} />
                  </div>
                  <div className="mt-4 text-[17px]">
                    <Delta atual={p.leads} anterior={p.leadsAnterior} rotulo={ant.toLowerCase()} />
                  </div>
                </Painel>
                <Painel>
                  <div className="text-[18px] text-apr-muted">
                    Vendas assinadas vindas de prospecção
                  </div>
                  <div className="mt-2 flex items-baseline gap-4">
                    <span className="font-display text-[64px] font-semibold leading-none text-apr-text">
                      <Conta valor={p.vendas} />
                    </span>
                    <span className="text-[26px] text-apr-muted">{brlCurto(p.valorVendas)}</span>
                  </div>
                  <div className="mt-3 text-[16px] text-apr-dim">
                    {r.assinado.qtd ? pct((p.vendas / r.assinado.qtd) * 100, 0) : "—"} das vendas do
                    mês
                  </div>
                </Painel>
              </Item>
              <Item i={1}>
                <Painel className="h-full">
                  <div className="mb-5 text-[15px] uppercase tracking-[0.18em] text-apr-dim">
                    Leads de prospecção por vendedor
                  </div>
                  <Barras dados={p.porVendedor} medida="qtd" max={8} />
                </Painel>
              </Item>
            </div>
          </div>
        );
      },
    },
    {
      id: "ranking",
      titulo: "Ranking",
      icone: Award,
      render: () => {
        const topo = Math.max(1, ...r.vendedores.map((v) => v.valor));
        return (
          <div>
            <Kicker icon={Award}>Ranking de vendas</Kicker>
            <Titulo>Quem vendeu em {mes.toLowerCase()}</Titulo>
            <Item i={1} className="mt-9">
              <Painel className="p-0">
                <table className="w-full text-[18px]">
                  <thead>
                    <tr className="border-b border-apr-line text-left text-[14px] uppercase tracking-[0.14em] text-apr-dim">
                      <th className="w-16 px-6 py-4 font-medium">#</th>
                      <th className="px-4 py-4 font-medium">Vendedor</th>
                      <th className="px-4 py-4 font-medium">Unidade</th>
                      <th className="px-4 py-4 text-right font-medium">Vendas</th>
                      <th className="px-4 py-4 text-right font-medium">Ticket</th>
                      <th className="w-[360px] px-6 py-4 font-medium">Valor assinado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.vendedores.slice(0, 9).map((v, i) => (
                      <motion.tr
                        key={v.nome}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.05 }}
                        className="border-b border-apr-line/50 last:border-0"
                      >
                        <td className="px-6 py-2.5 font-display text-[22px] font-semibold text-apr-dim">
                          {i + 1}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-apr-text">{v.nome}</td>
                        <td className="px-4 py-2.5 text-apr-muted">{v.unidade}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-apr-text">
                          {int(v.qtd)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-apr-muted">
                          {brlCurto(v.ticket)}
                        </td>
                        <td className="px-6 py-2.5">
                          <div className="flex items-center gap-3">
                            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-apr-line/60">
                              <motion.div
                                className="h-full rounded-full bg-apr-signed"
                                initial={{ width: 0 }}
                                animate={{ width: `${(v.valor / topo) * 100}%` }}
                                transition={{ delay: 0.3 + i * 0.05, duration: 0.9 }}
                              />
                            </div>
                            <span className="w-[110px] text-right font-semibold tabular-nums text-apr-text">
                              {brlCurto(v.valor)}
                            </span>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </Painel>
            </Item>
          </div>
        );
      },
    },
    {
      id: "reconhecimento",
      titulo: "Reconhecimento",
      icone: Trophy,
      render: () => {
        const d = r.destaques;
        const podios: {
          icon: LucideIcon;
          titulo: string;
          sub: string;
          linhas: { nome: string; numero: string; extra: string }[];
        }[] = [
          {
            icon: Receipt,
            titulo: "Mais vendas faturadas",
            sub: "contratos iniciados no Financeiro",
            linhas: d.rankFaturadas.map((p) => ({
              nome: p.nome,
              numero: `${int(p.qtd)} ${p.qtd === 1 ? "faturada" : "faturadas"}`,
              extra: brlCurto(p.valor),
            })),
          },
          {
            icon: Trophy,
            titulo: "Mais vendas assinadas",
            sub: "contratos ganhos no Comercial",
            linhas: d.rankAssinadas.map((p) => ({
              nome: p.nome,
              numero: `${int(p.qtd)} ${p.qtd === 1 ? "venda" : "vendas"}`,
              extra: brlCurto(p.valor),
            })),
          },
          {
            icon: Crown,
            titulo: "Maior venda do mês",
            sub: "o contrato de maior valor",
            linhas: d.maioresVendas.map((v) => ({
              nome: v.nome,
              numero: brlCurto(v.valor),
              extra: `${v.cliente}${v.kwp ? ` · ${v.kwp.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWp` : ""}`,
            })),
          },
        ];
        const lider = d.maiorValor[0];
        return (
          <div className="relative h-full">
            <Confete />
            <Kicker icon={Trophy}>Reconhecimento</Kicker>
            <Titulo>Destaques de {mes.toLowerCase()}</Titulo>
            <div className="mt-9 grid grid-cols-3 gap-6">
              {podios.map((c, i) => {
                const [primeiro, ...resto] = c.linhas;
                return (
                  <motion.div
                    key={c.titulo}
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.2, duration: 0.8, ease: EASE }}
                    className="relative flex flex-col overflow-hidden rounded-[30px] border border-apr-gold/40 bg-gradient-to-b from-apr-gold/15 via-apr-surface/85 to-apr-surface/85 p-8 text-center shadow-[0_40px_120px_-60px_var(--color-apr-gold)]"
                  >
                    <motion.div
                      initial={{ rotate: -20, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{
                        delay: 0.55 + i * 0.2,
                        type: "spring",
                        stiffness: 180,
                        damping: 12,
                      }}
                      className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-apr-gold/20 text-apr-gold"
                    >
                      <c.icon className="h-9 w-9" aria-hidden />
                    </motion.div>
                    <div className="mt-4 text-[16px] font-semibold uppercase tracking-[0.2em] text-apr-gold">
                      {c.titulo}
                    </div>
                    <div className="text-[14px] text-apr-dim">{c.sub}</div>
                    {primeiro ? (
                      <>
                        <div className="mt-5 font-display text-[40px] font-semibold leading-tight text-apr-text">
                          {primeiro.nome}
                        </div>
                        <div className="mt-1 font-display text-[34px] font-semibold text-apr-gold">
                          {primeiro.numero}
                        </div>
                        <div className="mt-1 truncate text-[17px] text-apr-muted">
                          {primeiro.extra}
                        </div>
                        <ol className="mt-6 space-y-2 border-t border-apr-line/60 pt-4 text-left text-[16px]">
                          {resto.map((l, k) => (
                            <li key={l.nome + k} className="flex items-baseline gap-3">
                              <span className="w-6 font-display font-semibold text-apr-dim">
                                {k + 2}º
                              </span>
                              <span className="flex-1 truncate text-apr-text">{l.nome}</span>
                              <span className="font-semibold tabular-nums text-apr-muted">
                                {l.numero}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </>
                    ) : (
                      <div className="mt-8 text-[20px] text-apr-dim">Sem registros no mês.</div>
                    )}
                  </motion.div>
                );
              })}
            </div>
            {lider && (
              <Item
                i={4}
                className="mt-6 flex items-center justify-center gap-3 text-[19px] text-apr-muted"
              >
                <Award className="h-6 w-6 text-apr-gold" aria-hidden />
                Maior valor vendido no mês:
                <b className="text-apr-text">{lider.nome}</b>· {brlCurto(lider.valor)} em{" "}
                {int(lider.qtd)} {lider.qtd === 1 ? "venda" : "vendas"}
              </Item>
            )}
          </div>
        );
      },
    },
    ...(campanha
      ? ([
          {
            id: "casas",
            titulo: "Disputa das casas",
            icone: Crown,
            render: () => <SlideCasas c={campanha} mes={mes} />,
          },
          {
            id: "trono",
            titulo: "O trono",
            icone: Crown,
            render: () => <SlideTrono c={campanha} />,
          },
        ] as Slide[])
      : []),
    {
      id: "pitch",
      titulo: "Momento pitch de vendas",
      icone: Mic,
      render: () => (
        <MomentoPitch
          nomes={Array.from(
            new Set([
              ...r.vendedores.map((v) => v.nome),
              ...r.prospeccao.porVendedor.map((p) => p.chave),
            ]),
          ).filter((n) => n && n !== "Sem responsável")}
        />
      ),
    },
    {
      id: "avisos",
      titulo: "Avisos",
      icone: Megaphone,
      render: () => (
        <div>
          <Kicker icon={Megaphone}>Avisos</Kicker>
          <Titulo>Recados para o time</Titulo>
          <div className="mt-10">
            <Lista
              itens={n.avisos}
              icone={Megaphone}
              vazio="Aperte E para adicionar os avisos da reunião."
            />
          </div>
        </div>
      ),
    },
    {
      id: "proximos",
      titulo: "Próximos passos",
      icone: Rocket,
      render: () => (
        <div>
          <Kicker icon={Rocket}>Próximos passos</Kicker>
          <Titulo>O que vem agora</Titulo>
          <div className="mt-10">
            <Lista
              itens={n.proximos}
              icone={Rocket}
              vazio="Aperte E para escrever as metas e os próximos passos."
            />
          </div>
        </div>
      ),
    },
    {
      id: "fim",
      titulo: "Encerramento",
      icone: Sparkles,
      render: () => (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <Item>
            <img
              src="/apresentacao/lz7-energia-branco.png"
              alt="LZ7 Energia"
              className="mx-auto h-[150px] w-auto"
            />
          </Item>
          <Item i={1}>
            <div className="mt-12 font-display text-[110px] font-semibold leading-none tracking-tight text-apr-text">
              Obrigado, time.
            </div>
          </Item>
          <Item i={2} className="mt-8 text-[30px] text-apr-muted">
            {brlCurto(r.assinado.valor)} assinados em {mes.toLowerCase()}. Bora pra cima em{" "}
            {nomeMes(proximoMes(r.mes)).toLowerCase()}.
          </Item>
        </div>
      ),
    },
  ];
  // Slides de texto só entram quando têm conteúdo (nada de página vazia na reunião).
  return slides.filter(
    (s) =>
      (s.id !== "avisos" || n.avisos.length > 0) && (s.id !== "proximos" || n.proximos.length > 0),
  );
}

function proximoMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Palco (slides em tela cheia)                                        */
/* ------------------------------------------------------------------ */

const BASE_W = 1600;
const BASE_H = 900;

function useEscala() {
  const [s, setS] = useState(1);
  useEffect(() => {
    const f = () => setS(Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H));
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return s;
}

export function ultimosMeses(n: number) {
  const out: string[] = [];
  const hoje = new Date(Date.now() - 3 * 3600_000);
  let y = hoje.getUTCFullYear();
  let m = hoje.getUTCMonth() + 1;
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return out;
}

/** Fundo do palco (gradientes da marca + grade sutil). */
export function FundoApresentacao({
  children,
  cursorOculto = false,
  onClick,
}: {
  children: ReactNode;
  cursorOculto?: boolean;
  onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={
        "fixed inset-0 z-[300] overflow-hidden bg-apr-bg font-sans text-apr-text select-none " +
        (cursorOculto ? "cursor-none" : "")
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_85%_0%,color-mix(in_oklch,var(--color-apr-signed)_22%,transparent),transparent),radial-gradient(ellipse_55%_50%_at_0%_100%,color-mix(in_oklch,var(--color-apr-billed)_16%,transparent),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(var(--color-apr-text)_1px,transparent_1px),linear-gradient(90deg,var(--color-apr-text)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />
      {children}
    </div>
  );
}

export type PalcoProps = {
  relatorio: RelatorioMes;
  notas: NotasApresentacao;
  mes: string;
  podeEditar: boolean;
  relendo?: boolean;
  onMudarMes?: (mes: string) => void;
  onReler?: () => void;
  /** Painel de edição das anotações (mostrado quando `editando`). */
  editando?: boolean;
  onEditar?: () => void;
  onFecharEditor?: () => void;
  editor?: ReactNode;
  /** Slide inicial (0-based). */
  inicial?: number;
};

export function PalcoApresentacao({
  relatorio,
  notas,
  mes,
  podeEditar,
  relendo = false,
  onMudarMes,
  onReler,
  editando = false,
  onEditar,
  onFecharEditor,
  editor,
  inicial = 0,
}: PalcoProps) {
  const [idx, setIdx] = useState(inicial);
  const [dir, setDir] = useState(1);
  const [visao, setVisao] = useState(false);
  const [cursorOculto, setCursorOculto] = useState(false);
  const escala = useEscala();
  const hojeLongo = useMemo(
    () =>
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  const slides = useMemo(
    () => montaSlides(relatorio, notas, hojeLongo),
    [relatorio, notas, hojeLongo],
  );
  const total = slides.length;

  const ir = useCallback(
    (n: number) => {
      if (!total) return;
      const alvo = Math.max(0, Math.min(total - 1, n));
      setDir(alvo >= idx ? 1 : -1);
      setIdx(alvo);
    },
    [total, idx],
  );

  const telaCheia = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
      if (editando) {
        if (e.key === "Escape") onFecharEditor?.();
        return;
      }
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
        case "Enter":
          e.preventDefault();
          ir(idx + 1);
          break;
        case "ArrowLeft":
        case "PageUp":
        case "Backspace":
          e.preventDefault();
          ir(idx - 1);
          break;
        case "Home":
          ir(0);
          break;
        case "End":
          ir(total - 1);
          break;
        case "f":
        case "F":
          telaCheia();
          break;
        case "o":
        case "O":
        case "g":
        case "G":
          setVisao((v) => !v);
          break;
        case "e":
        case "E":
          if (podeEditar) onEditar?.();
          break;
        case "Escape":
          setVisao(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, total, ir, telaCheia, editando, podeEditar, onEditar, onFecharEditor]);

  // Esconde o cursor parado durante a apresentação
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const mexeu = () => {
      setCursorOculto(false);
      clearTimeout(t);
      t = setTimeout(() => setCursorOculto(true), 2500);
    };
    mexeu();
    window.addEventListener("mousemove", mexeu);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", mexeu);
    };
  }, []);

  const geradoEm = new Date(relatorio.geradoEm).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <FundoApresentacao
      cursorOculto={cursorOculto && !editando && !visao}
      onClick={(e) => {
        // Clique nas laterais do palco: esquerda volta, direita avança.
        // Botões, campos e painéis abertos não navegam.
        if (editando || visao) return;
        if (
          (e.target as HTMLElement).closest(
            "button,a,input,select,textarea,aside,[data-interativo]",
          )
        )
          return;
        const x = e.clientX / window.innerWidth;
        if (x < 0.18) ir(idx - 1);
        else if (x > 0.82) ir(idx + 1);
      }}
    >
      {/* palco 16:9 escalado para qualquer tela */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: BASE_W,
          height: BASE_H,
          transform: `translate(-50%, -50%) scale(${escala})`,
        }}
      >
        <AnimatePresence mode="wait" custom={dir}>
          <motion.section
            key={slides[idx].id}
            custom={dir}
            initial={{ opacity: 0, x: 60 * dir, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -60 * dir, filter: "blur(6px)" }}
            transition={{ duration: 0.45, ease: EASE }}
            className="absolute inset-0 px-[88px] pb-[90px] pt-[72px]"
            aria-roledescription="slide"
            aria-label={`${idx + 1} de ${total}: ${slides[idx].titulo}`}
          >
            {slides[idx].render()}
          </motion.section>
        </AnimatePresence>

        {/* rodapé do slide */}
        <div className="absolute inset-x-[88px] bottom-7 flex items-center justify-between text-[14px] text-apr-dim">
          <span className="flex items-center gap-4">
            {/* Logo em todo slide interno; capa e encerramento já têm a logo grande. */}
            {slides[idx].id !== "capa" && slides[idx].id !== "fim" && (
              <img
                src="/apresentacao/lz7-energia-branco.png"
                alt="LZ7 Energia"
                className="h-11 w-auto"
              />
            )}
            <span>
              {notas.titulo} · Fonte: {relatorio.fonte}, lido em {geradoEm}
            </span>
          </span>
          <span className="tabular-nums">
            {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* barra de progresso */}
      <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-apr-line/40">
        <motion.div
          className="h-full bg-gradient-to-r from-apr-signed to-apr-glow"
          animate={{ width: `${((idx + 1) / total) * 100}%` }}
          transition={{ duration: 0.5, ease: EASE }}
        />
      </div>

      {/* controles (somem com o cursor parado) */}
      <div
        className={
          "absolute right-5 top-5 z-20 flex items-center gap-1 rounded-2xl border border-apr-line/70 bg-apr-bg/70 p-1 backdrop-blur transition-opacity duration-300 " +
          (cursorOculto && !visao ? "pointer-events-none opacity-0" : "opacity-100")
        }
      >
        <select
          value={mes}
          onChange={(e) => {
            setIdx(0);
            onMudarMes?.(e.target.value);
          }}
          className="rounded-xl bg-transparent px-2 py-1.5 text-sm text-apr-text outline-none"
          aria-label="Mês"
        >
          {ultimosMeses(12).map((m) => (
            <option key={m} value={m} className="bg-apr-bg">
              {nomeMes(m)} {m.slice(0, 4)}
            </option>
          ))}
        </select>
        {(
          [
            [ChevronLeft, "Anterior (←)", () => ir(idx - 1)],
            [ChevronRight, "Próximo (→)", () => ir(idx + 1)],
            [LayoutGrid, "Todos os slides (O)", () => setVisao((v) => !v)],
            ...(podeEditar
              ? ([[Pencil, "Editar anotações (E)", () => onEditar?.()]] as const)
              : []),
            [RefreshCw, "Reler o Ploomes agora", () => onReler?.()],
            [Maximize2, "Tela cheia (F ou F11)", telaCheia],
          ] as const
        ).map(([Icon, rot, fn]) => (
          <button
            key={rot}
            onClick={fn}
            title={rot}
            aria-label={rot}
            className="rounded-xl p-2 text-apr-muted hover:bg-apr-surface hover:text-apr-text"
          >
            <Icon
              className={
                "h-4.5 w-4.5" + (rot.startsWith("Reler") && relendo ? " animate-spin" : "")
              }
            />
          </button>
        ))}
      </div>

      {/* visão geral */}
      <AnimatePresence>
        {visao && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 overflow-y-auto bg-apr-bg/95 p-10 backdrop-blur"
          >
            <div className="mx-auto max-w-6xl">
              <div className="mb-6 flex items-center justify-between">
                <div className="font-display text-3xl font-semibold">Todos os slides</div>
                <button
                  onClick={() => setVisao(false)}
                  className="rounded-xl p-2 text-apr-muted hover:bg-apr-surface"
                  aria-label="Fechar"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      ir(i);
                      setVisao(false);
                    }}
                    className={
                      "flex aspect-video flex-col justify-between rounded-2xl border p-4 text-left transition-colors " +
                      (i === idx
                        ? "border-apr-signed bg-apr-signed/10"
                        : "border-apr-line bg-apr-surface/60 hover:border-apr-muted")
                    }
                  >
                    <s.icone className="h-6 w-6 text-apr-glow" aria-hidden />
                    <div>
                      <div className="text-sm text-apr-dim">{String(i + 1).padStart(2, "0")}</div>
                      <div className="font-display text-lg font-semibold">{s.titulo}</div>
                    </div>
                  </button>
                ))}
              </div>
              {!!relatorio.avisos.length && (
                <div className="mt-8 rounded-2xl border border-apr-line p-5 text-sm text-apr-muted">
                  <div className="mb-2 font-semibold text-apr-text">Observações sobre os dados</div>
                  <ul className="list-disc space-y-1 pl-5">
                    {relatorio.avisos.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-8 text-sm text-apr-dim">
                Atalhos: → ou espaço avança · ← volta · O abre esta visão · F tela cheia
                {podeEditar ? " · E edita as anotações" : ""}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{editando && editor}</AnimatePresence>
    </FundoApresentacao>
  );
}
