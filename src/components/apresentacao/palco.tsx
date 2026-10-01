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
import { AnimatePresence, animate, motion, useInView } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BadgeDollarSign,
  Building2,
  ChevronLeft,
  ChevronRight,
  Crown,
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

/**
 * Brilho da logo: o "7" da marca é verde-escuro e some no fundo escuro. Um contorno
 * de luz verde acompanha o desenho e destaca a logo sem alterar a marca.
 */
const LOGO_BRILHO =
  "[filter:drop-shadow(0_0_1.5px_var(--color-apr-glow))_drop-shadow(0_0_1.5px_var(--color-apr-glow))_drop-shadow(0_8px_28px_color-mix(in_oklch,var(--color-apr-glow)_45%,transparent))]";

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
              src="/lz7-logo-white.png"
              alt="LZ7 Energia"
              className={"h-[128px] w-auto " + LOGO_BRILHO}
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
      id: "maiores",
      titulo: "Maiores vendas",
      icone: Rocket,
      render: () => {
        const top = r.assinado.vendas.slice(0, 8);
        return (
          <div>
            <Kicker icon={Rocket}>Vendas assinadas</Kicker>
            <Titulo>Os maiores contratos de {mes.toLowerCase()}</Titulo>
            <div className="mt-9 grid grid-cols-[1fr_380px] gap-6">
              <Item i={0}>
                <Painel className="p-0">
                  <table className="w-full text-left text-[18px]">
                    <thead>
                      <tr className="border-b border-apr-line text-[14px] uppercase tracking-[0.14em] text-apr-dim">
                        <th className="px-6 py-4 font-medium">Cliente</th>
                        <th className="px-4 py-4 font-medium">Vendedor</th>
                        <th className="px-4 py-4 text-right font-medium">kWp</th>
                        <th className="px-6 py-4 text-right font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top.map((v, i) => (
                        <motion.tr
                          key={v.id}
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + i * 0.06 }}
                          className="border-b border-apr-line/50 last:border-0"
                        >
                          <td className="max-w-[420px] truncate px-6 py-3.5 text-apr-text">
                            {v.cliente || v.titulo}
                          </td>
                          <td className="px-4 py-3.5 text-apr-muted">{v.vendedor}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-apr-muted">
                            {v.kwp
                              ? v.kwp.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
                              : "—"}
                          </td>
                          <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-apr-text">
                            {brl(v.valor)}
                          </td>
                        </motion.tr>
                      ))}
                      {!top.length && (
                        <tr>
                          <td colSpan={4} className="px-6 py-10 text-center text-apr-dim">
                            Nenhuma venda assinada no mês.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Painel>
              </Item>
              <Item i={1} className="space-y-6">
                <Painel>
                  <div className="mb-4 text-[15px] uppercase tracking-[0.18em] text-apr-dim">
                    Por linha
                  </div>
                  <Barras dados={r.assinado.porLinha} medida="valor" max={4} />
                </Painel>
                <Painel>
                  <div className="mb-4 text-[15px] uppercase tracking-[0.18em] text-apr-dim">
                    Origem das vendas
                  </div>
                  <Barras dados={r.assinado.porOrigem} medida="valor" max={4} />
                </Painel>
              </Item>
            </div>
          </div>
        );
      },
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
              src="/lz7-logo-white.png"
              alt="LZ7 Energia"
              className={"mx-auto h-[150px] w-auto " + LOGO_BRILHO}
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
                src="/lz7-logo-white.png"
                alt="LZ7 Energia"
                className={"h-11 w-auto " + LOGO_BRILHO}
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
