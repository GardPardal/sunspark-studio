import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  BatteryCharging,
  Brain,
  ChevronLeft,
  ChevronRight,
  Home,
  LayoutGrid,
  Maximize2,
  Mic,
  Play,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  BASE_H,
  BASE_W,
  EASE,
  EQUIPE_APOIO,
  FundoApresentacao,
  MomentoPitch,
  useEscala,
} from "@/components/apresentacao/palco";
import { CAMPANHAS } from "@/components/apresentacao/casas";
import type { SlideTreino } from "@/components/treinamento/blocos";
import { SLIDES_COMERCIAL } from "@/components/treinamento/comercial";
import { SLIDES_DISC } from "@/components/treinamento/disc";
import { SLIDES_HIBRIDO } from "@/components/treinamento/hibrido";

export const Route = createFileRoute("/_authenticated/treinamento")({
  head: () => ({
    meta: [
      { title: "Treinamento Comercial · LZ7 Solar OS" },
      {
        name: "description",
        content:
          "Treinamentos do time comercial LZ7 em tela cheia: Treinamento Comercial, Sistema híbrido, DISC em Vendas e Momento pitch de vendas.",
      },
      { property: "og:title", content: "Treinamento Comercial · LZ7 Solar OS" },
      {
        property: "og:description",
        content: "Treinamentos do time comercial LZ7 para apresentar em tela cheia.",
      },
    ],
  }),
  component: TreinamentoPage,
});

/* ---------------- blocos ---------------- */

/** Vendedores da campanha mais recente cadastrada + equipe de apoio (sorteio do pitch). */
function nomesPitch() {
  const meses = Object.keys(CAMPANHAS).sort();
  const c = CAMPANHAS[meses[meses.length - 1]];
  const vendedores = c ? c.casas.flatMap((k) => k.membros.map((m) => m.nome)) : [];
  return Array.from(new Set([...vendedores, ...EQUIPE_APOIO]));
}

type Bloco = {
  id: "comercial" | "hibrido" | "disc" | "pitch";
  nome: string;
  desc: string;
  icone: LucideIcon;
  slides: SlideTreino[];
};

const BLOCOS: Record<Bloco["id"], Bloco> = {
  comercial: {
    id: "comercial",
    nome: "Treinamento Comercial",
    desc: "Postura · DISC · Arsenal · Objeções · Desconto",
    icone: Trophy,
    slides: SLIDES_COMERCIAL,
  },
  hibrido: {
    id: "hibrido",
    nome: "Sistema híbrido",
    desc: "Solar + bateria · backup · Fio B · objeções",
    icone: BatteryCharging,
    slides: SLIDES_HIBRIDO,
  },
  disc: {
    id: "disc",
    nome: "DISC em Vendas",
    desc: "Os 4 animais · teste · matriz · dinâmica",
    icone: Brain,
    slides: SLIDES_DISC,
  },
  pitch: {
    id: "pitch",
    nome: "Momento pitch de vendas",
    desc: "Cronômetro e sorteio de quem apresenta",
    icone: Mic,
    slides: [
      {
        id: "pitch",
        titulo: "Momento pitch de vendas",
        icone: Mic,
        render: () => <MomentoPitch nomes={nomesPitch()} />,
      },
    ],
  },
};

type Item = { id: Bloco["id"]; ativo: boolean };
const PADRAO: Item[] = [
  { id: "comercial", ativo: true },
  { id: "hibrido", ativo: true },
  { id: "disc", ativo: true },
  { id: "pitch", ativo: true },
];
const CHAVE = "lz7:treinamento:ordem";

function lerOrdem(): Item[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
    if (Array.isArray(v) && v.length === PADRAO.length && v.every((x) => x?.id in BLOCOS))
      return v as Item[];
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  return PADRAO;
}

/* ---------------- página ---------------- */

function TreinamentoPage() {
  // a área logada não é renderizada no servidor (ssr: false), então dá para ler o navegador já aqui
  const [ordem, setOrdem] = useState<Item[]>(lerOrdem);
  const [apresentando, setApresentando] = useState(false);
  const [inicio, setInicio] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(ordem));
    } catch {
      /* ignora */
    }
  }, [ordem]);

  const blocos = ordem.filter((o) => o.ativo).map((o) => BLOCOS[o.id]);

  if (apresentando && blocos.length)
    return <Palco blocos={blocos} inicial={inicio} onMenu={() => setApresentando(false)} />;

  const mover = (k: number, d: -1 | 1) =>
    setOrdem((o) => {
      const n = [...o];
      const j = k + d;
      if (j < 0 || j >= n.length) return o;
      [n[k], n[j]] = [n[j], n[k]];
      return n;
    });

  let acumulado = 0;
  return (
    <FundoApresentacao>
      <div className="absolute inset-0 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-center px-6 py-12">
          <motion.img
            src="/apresentacao/lz7-energia-branco.png"
            alt="LZ7 Energia"
            className="h-16 w-auto self-start"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          />
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.7, ease: EASE }}
            className="mt-10 font-display text-5xl font-semibold tracking-tight text-apr-text sm:text-6xl"
          >
            Treinamento <span className="text-apr-glow">LZ7</span>
          </motion.h1>
          <p className="mt-3 text-lg text-apr-muted">
            Escolha a ordem e o que entra. Depois é só apertar F11 e passar com as setas.
          </p>

          <ol className="mt-10 space-y-3">
            {ordem.map((o, k) => {
              const b = BLOCOS[o.id];
              const primeiro = acumulado;
              if (o.ativo) acumulado += b.slides.length;
              return (
                <motion.li
                  key={o.id}
                  layout
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  className={
                    "flex items-center gap-4 rounded-2xl border p-4 transition-colors " +
                    (o.ativo
                      ? "border-apr-line bg-apr-surface/80"
                      : "border-apr-line/40 bg-apr-surface/30 opacity-55")
                  }
                >
                  <span className="w-8 text-center font-display text-2xl font-semibold text-apr-dim">
                    {k + 1}
                  </span>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-apr-signed/15 text-apr-glow">
                    <b.icone className="h-6 w-6" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-xl font-semibold text-apr-text">{b.nome}</div>
                    <div className="text-sm text-apr-muted">
                      {b.desc} · {b.slides.length} {b.slides.length === 1 ? "slide" : "slides"}
                    </div>
                  </div>
                  <button
                    onClick={() => mover(k, -1)}
                    disabled={k === 0}
                    className="rounded-lg p-2 text-apr-muted hover:bg-apr-bg hover:text-apr-text disabled:opacity-30"
                    aria-label={`Subir ${b.nome}`}
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => mover(k, 1)}
                    disabled={k === ordem.length - 1}
                    className="rounded-lg p-2 text-apr-muted hover:bg-apr-bg hover:text-apr-text disabled:opacity-30"
                    aria-label={`Descer ${b.nome}`}
                  >
                    <ArrowDown className="h-5 w-5" />
                  </button>
                  <label className="ml-1 flex cursor-pointer items-center gap-2 text-sm text-apr-muted">
                    <input
                      type="checkbox"
                      checked={o.ativo}
                      onChange={(e) =>
                        setOrdem((x) =>
                          x.map((y) => (y.id === o.id ? { ...y, ativo: e.target.checked } : y)),
                        )
                      }
                      className="h-4 w-4 accent-apr-signed"
                    />
                    Incluir
                  </label>
                  {o.ativo && (
                    <button
                      onClick={() => {
                        setInicio(primeiro);
                        setApresentando(true);
                      }}
                      className="rounded-lg p-2 text-apr-glow hover:bg-apr-bg"
                      title={`Começar por ${b.nome}`}
                      aria-label={`Começar por ${b.nome}`}
                    >
                      <Play className="h-5 w-5" />
                    </button>
                  )}
                </motion.li>
              );
            })}
          </ol>

          <button
            onClick={() => {
              setInicio(0);
              setApresentando(true);
            }}
            disabled={!blocos.length}
            className="mt-8 inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-apr-signed px-7 py-3.5 font-display text-lg font-semibold text-apr-bg transition-transform hover:scale-[1.02] disabled:opacity-40"
          >
            <Play className="h-5 w-5" /> Começar apresentação
          </button>
          <p className="mt-4 text-sm text-apr-dim">
            Atalhos: → ou espaço avança · ← volta · O mostra todos os slides · F tela cheia · Esc
            volta para este menu.
          </p>
        </div>
      </div>
    </FundoApresentacao>
  );
}

/* ---------------- palco ---------------- */

function Palco({
  blocos,
  inicial,
  onMenu,
}: {
  blocos: Bloco[];
  inicial: number;
  onMenu: () => void;
}) {
  const slides = useMemo(
    () => blocos.flatMap((b) => b.slides.map((s) => ({ ...s, bloco: b }))),
    [blocos],
  );
  const total = slides.length;
  const [idx, setIdx] = useState(Math.min(inicial, total - 1));
  const [dir, setDir] = useState(1);
  const [visao, setVisao] = useState(false);
  const [cursorOculto, setCursorOculto] = useState(false);
  const escala = useEscala();

  const ir = useCallback(
    (n: number) => {
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
      // Na tela do pitch, T/R/S são do cronômetro.
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
        case "Escape":
          if (visao) setVisao(false);
          else if (!document.fullscreenElement) onMenu();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, total, ir, telaCheia, visao, onMenu]);

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

  const atual = slides[idx];
  const posNoBloco = slides.slice(0, idx + 1).filter((s) => s.bloco.id === atual.bloco.id).length;

  return (
    <FundoApresentacao
      cursorOculto={cursorOculto && !visao}
      onClick={(e) => {
        if (visao) return;
        if ((e.target as HTMLElement).closest("button,a,input,select,textarea,[data-interativo]"))
          return;
        const x = e.clientX / window.innerWidth;
        if (x < 0.18) ir(idx - 1);
        else if (x > 0.82) ir(idx + 1);
      }}
    >
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
            key={atual.bloco.id + atual.id}
            initial={{ opacity: 0, x: 60 * dir, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -60 * dir, filter: "blur(6px)" }}
            transition={{ duration: 0.45, ease: EASE }}
            className="absolute inset-0 px-[88px] pb-[90px] pt-[72px]"
            aria-roledescription="slide"
            aria-label={`${idx + 1} de ${total}: ${atual.titulo}`}
          >
            {atual.render()}
          </motion.section>
        </AnimatePresence>
        <div className="absolute inset-x-[88px] bottom-7 flex items-center justify-between text-[14px] text-apr-dim">
          <span className="flex items-center gap-4">
            <img
              src="/apresentacao/lz7-energia-branco.png"
              alt="LZ7 Energia"
              className="h-11 w-auto"
            />
            <span>{atual.bloco.nome}</span>
          </span>
          <span className="tabular-nums">
            {String(posNoBloco).padStart(2, "0")} /{" "}
            {String(atual.bloco.slides.length).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* progresso: um segmento por bloco */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex h-1 gap-[3px]">
        {blocos.map((b) => {
          const ini = slides.findIndex((s) => s.bloco.id === b.id);
          const n = b.slides.length;
          const feito = Math.max(0, Math.min(n, idx - ini + 1));
          return (
            <div key={b.id} className="h-full bg-apr-line/40" style={{ flex: n }}>
              <motion.div
                className="h-full bg-gradient-to-r from-apr-signed to-apr-glow"
                animate={{ width: `${(feito / n) * 100}%` }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </div>
          );
        })}
      </div>

      <div
        className={
          "absolute right-5 top-5 z-20 flex items-center gap-1 rounded-2xl border border-apr-line/70 bg-apr-bg/70 p-1 backdrop-blur transition-opacity duration-300 " +
          (cursorOculto && !visao ? "pointer-events-none opacity-0" : "opacity-100")
        }
      >
        {(
          [
            [Home, "Menu (Esc)", onMenu],
            [ChevronLeft, "Anterior (←)", () => ir(idx - 1)],
            [ChevronRight, "Próximo (→)", () => ir(idx + 1)],
            [LayoutGrid, "Todos os slides (O)", () => setVisao((v) => !v)],
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
            <Icon className="h-4.5 w-4.5" />
          </button>
        ))}
      </div>

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
              {blocos.map((b) => (
                <Secao key={b.id} titulo={b.nome}>
                  {slides.map((s, i) =>
                    s.bloco.id !== b.id ? null : (
                      <button
                        key={b.id + s.id}
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
                        <div className="font-display text-base font-semibold leading-tight">
                          {s.titulo}
                        </div>
                      </button>
                    ),
                  )}
                </Secao>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FundoApresentacao>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-apr-gold">
        {titulo}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{children}</div>
    </section>
  );
}
