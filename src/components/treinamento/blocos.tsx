/**
 * Peças de slide do /treinamento, no mesmo padrão visual da /apresentacao
 * (palco escuro 1600×900, Sora/Manrope, tokens apr-*).
 *
 * Texto rico: *negrito* · _destaque verde_ · ~vermelho~ · ^dourado^ · [D]/[I]/[S]/[C] cores DISC.
 */
import { Fragment, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { EASE, Item, LuzDourada, Sangria } from "@/components/apresentacao/palco";

export type SlideTreino = {
  id: string;
  titulo: string;
  icone: LucideIcon;
  render: () => ReactNode;
};

/** Os PDFs eram 1456 px de largura com muito vazio; no palco 1600×900 o texto cresce ~20%. */
const F = 1.2;
const px = (n: number) => Math.round(n * F * 10) / 10;

/* ---------------- texto rico ---------------- */

const TOKEN = /(\*[^*]+\*|_[^_]+_|~[^~]+~|\^[^^]+\^|\[[DISC]\][^[]*\[\/\])/g;

const COR_DISC: Record<string, string> = {
  D: "text-disc-d",
  I: "text-disc-i",
  S: "text-disc-s",
  C: "text-disc-c",
};

export function Rico({ t }: { t: string }) {
  const partes = t.split(TOKEN).filter(Boolean);
  return (
    <>
      {partes.map((p, i) => {
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2)
          return (
            <b key={i} className="font-semibold text-apr-text">
              {p.slice(1, -1)}
            </b>
          );
        if (p.startsWith("_") && p.endsWith("_") && p.length > 2)
          return (
            <span key={i} className="text-apr-glow">
              {p.slice(1, -1)}
            </span>
          );
        if (p.startsWith("~") && p.endsWith("~") && p.length > 2)
          return (
            <span key={i} className="text-danger">
              {p.slice(1, -1)}
            </span>
          );
        if (p.startsWith("^") && p.endsWith("^") && p.length > 2)
          return (
            <span key={i} className="text-apr-gold">
              {p.slice(1, -1)}
            </span>
          );
        const disc = p.match(/^\[([DISC])\](.*)\[\/\]$/);
        if (disc)
          return (
            <span key={i} className={COR_DISC[disc[1]]}>
              {disc[2]}
            </span>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

/* ---------------- cabeçalho ---------------- */

export function Cabecalho({
  tag,
  kicker,
  titulo,
  corTag = "apr-glow",
}: {
  tag?: string;
  kicker?: string;
  titulo: string;
  corTag?: "apr-glow" | "disc-d" | "disc-i" | "disc-s" | "disc-c";
}) {
  const tagCls: Record<string, string> = {
    "apr-glow": "border-apr-glow/40 bg-apr-glow/10 text-apr-glow",
    "disc-d": "border-disc-d/50 bg-disc-d/15 text-disc-d",
    "disc-i": "border-disc-i/50 bg-disc-i/15 text-disc-i",
    "disc-s": "border-disc-s/50 bg-disc-s/15 text-disc-s",
    "disc-c": "border-disc-c/50 bg-disc-c/15 text-disc-c",
  };
  return (
    <div>
      <Item i={0} className="flex items-center gap-4">
        {tag && (
          <span
            className={
              "rounded-full border px-4 py-1 text-[14px] font-semibold uppercase tracking-[0.18em] " +
              tagCls[corTag]
            }
          >
            {tag}
          </span>
        )}
        {kicker && (
          <span className="text-[15px] font-semibold uppercase tracking-[0.22em] text-apr-muted">
            {kicker}
          </span>
        )}
      </Item>
      <Item i={1}>
        <h2 className="mt-4 font-display text-[54px] font-semibold leading-[1.08] tracking-tight text-apr-text">
          <Rico t={titulo} />
        </h2>
      </Item>
    </div>
  );
}

/* ---------------- blocos ---------------- */

export type Tom = "neutro" | "bom" | "ruim" | "ouro" | "azul" | "D" | "I" | "S" | "C";

const TOM: Record<Tom, { caixa: string; titulo: string; barra: string }> = {
  neutro: {
    caixa: "border-apr-line/80 bg-apr-surface/70",
    titulo: "text-apr-glow",
    barra: "bg-apr-glow",
  },
  bom: { caixa: "border-success/40 bg-success/10", titulo: "text-success", barra: "bg-success" },
  ruim: { caixa: "border-danger/40 bg-danger/10", titulo: "text-danger", barra: "bg-danger" },
  ouro: {
    caixa: "border-apr-gold/45 bg-apr-gold/10",
    titulo: "text-apr-gold",
    barra: "bg-apr-gold",
  },
  azul: {
    caixa: "border-apr-billed/45 bg-apr-billed/10",
    titulo: "text-apr-billed",
    barra: "bg-apr-billed",
  },
  D: { caixa: "border-disc-d/45 bg-disc-d/10", titulo: "text-disc-d", barra: "bg-disc-d" },
  I: { caixa: "border-disc-i/45 bg-disc-i/10", titulo: "text-disc-i", barra: "bg-disc-i" },
  S: { caixa: "border-disc-s/45 bg-disc-s/10", titulo: "text-disc-s", barra: "bg-disc-s" },
  C: { caixa: "border-disc-c/45 bg-disc-c/10", titulo: "text-disc-c", barra: "bg-disc-c" },
};

/** Lista com marcadores. */
export function Lista({
  itens,
  i = 2,
  tom = "neutro",
  tamanho = 22,
}: {
  itens: string[];
  i?: number;
  tom?: Tom;
  tamanho?: number;
}) {
  return (
    <ul className="space-y-4">
      {itens.map((t, k) => (
        <Item key={k} i={i + k} className="flex gap-4">
          <span className={"mt-[0.55em] h-2.5 w-2.5 shrink-0 rounded-full " + TOM[tom].barra} />
          <span className="leading-snug text-apr-muted" style={{ fontSize: px(tamanho) }}>
            <Rico t={t} />
          </span>
        </Item>
      ))}
    </ul>
  );
}

/** Caixa com título e parágrafos. */
export function Cartao({
  titulo,
  textos = [],
  tom = "neutro",
  i = 3,
  children,
  className = "",
  tamanho = 19,
}: {
  titulo?: string;
  textos?: string[];
  tom?: Tom;
  i?: number;
  children?: ReactNode;
  className?: string;
  tamanho?: number;
}) {
  return (
    <Item
      i={i}
      className={"rounded-3xl border p-7 backdrop-blur " + TOM[tom].caixa + " " + className}
    >
      {titulo && (
        <div className={"font-display text-[27px] font-semibold " + TOM[tom].titulo}>
          <Rico t={titulo} />
        </div>
      )}
      <div className={titulo ? "mt-3 space-y-3" : "space-y-3"}>
        {textos.map((t, k) => (
          <p key={k} className="leading-relaxed text-apr-muted" style={{ fontSize: px(tamanho) }}>
            <Rico t={t} />
          </p>
        ))}
        {children}
      </div>
    </Item>
  );
}

/** Fala/roteiro: barra lateral, rótulo pequeno e a frase grande. */
export function Fala({
  rotulo,
  texto,
  tom = "neutro",
  i = 3,
  tamanho = 22,
  className = "",
}: {
  rotulo: string;
  texto: string;
  tom?: Tom;
  i?: number;
  tamanho?: number;
  className?: string;
}) {
  return (
    <Item
      i={i}
      className={
        "relative overflow-hidden rounded-2xl border border-apr-line/70 bg-apr-surface/70 py-5 pl-8 pr-7 " +
        className
      }
    >
      <span className={"absolute inset-y-0 left-0 w-1.5 " + TOM[tom].barra} />
      <div
        className={
          "text-[15px] font-semibold uppercase tracking-[0.2em] " +
          (tom === "neutro" ? "text-apr-dim" : TOM[tom].titulo)
        }
      >
        {rotulo}
      </div>
      <p className="mt-2 leading-snug text-apr-text" style={{ fontSize: px(tamanho) }}>
        <Rico t={texto} />
      </p>
    </Item>
  );
}

/** Aviso de "erro fatal". */
export function Erro({ texto, i = 5 }: { texto: string; i?: number }) {
  return (
    <Item
      i={i}
      className="rounded-2xl border border-danger/50 bg-danger/12 px-6 py-4 text-[21px] leading-snug text-apr-muted"
    >
      <b className="mr-1 font-semibold text-danger">⚠ ERRO FATAL:</b>
      <Rico t={texto} />
    </Item>
  );
}

/** Número de destaque com legenda. */
export function Numero({
  valor,
  legenda,
  tom = "neutro",
  i = 2,
  tamanho = 96,
}: {
  valor: string;
  legenda: string;
  tom?: Tom;
  i?: number;
  tamanho?: number;
}) {
  const cor = tom === "neutro" ? "text-apr-text" : TOM[tom].titulo;
  return (
    <Item i={i} className="flex items-end gap-5">
      <span
        className={
          "whitespace-nowrap font-display font-semibold leading-none tracking-tight " + cor
        }
        style={{ fontSize: tamanho }}
      >
        {valor}
      </span>
      <span className="pb-2 text-[24px] leading-snug text-apr-muted">
        <Rico t={legenda} />
      </span>
    </Item>
  );
}

/** Passos numerados (método). */
export function Passos({
  itens,
  colunas = 2,
  i = 2,
}: {
  itens: { titulo: string; texto: string }[];
  colunas?: 2 | 4;
  i?: number;
}) {
  return (
    <div className={"grid gap-5 " + (colunas === 4 ? "grid-cols-4" : "grid-cols-2")}>
      {itens.map((p, k) => (
        <Item
          key={k}
          i={i + k}
          className="relative overflow-hidden rounded-3xl border border-apr-line/80 bg-apr-surface/70 p-7"
        >
          <span className="absolute -right-3 -top-8 font-display text-[130px] font-semibold leading-none text-apr-line/50">
            {k + 1}
          </span>
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-apr-signed font-display text-[24px] font-semibold text-apr-bg">
            {k + 1}
          </span>
          <div className="relative mt-4 font-display text-[30px] font-semibold text-apr-text">
            {p.titulo}
          </div>
          <p className="relative mt-2 text-[21px] leading-snug text-apr-muted">
            <Rico t={p.texto} />
          </p>
        </Item>
      ))}
    </div>
  );
}

/** Tabela no padrão escuro. */
export function Tabela({
  cabecalho,
  linhas,
  i = 2,
  larguras,
  primeiraColuna,
  tamanho = 18,
}: {
  cabecalho: ReactNode[];
  linhas: ReactNode[][];
  i?: number;
  larguras?: string[];
  primeiraColuna?: (k: number) => string;
  tamanho?: number;
}) {
  return (
    <Item i={i} className="overflow-hidden rounded-3xl border border-apr-line/80 bg-apr-surface/70">
      <table className="w-full text-left" style={{ fontSize: px(tamanho) * 0.95 }}>
        <thead>
          <tr className="border-b border-apr-line text-[13px] uppercase tracking-[0.16em] text-apr-dim">
            {cabecalho.map((c, k) => (
              <th key={k} className="px-5 py-3.5 font-medium" style={{ width: larguras?.[k] }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, k) => (
            <motion.tr
              key={k}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + k * 0.06, duration: 0.5, ease: EASE }}
              className="border-b border-apr-line/50 align-top last:border-0"
            >
              {l.map((c, j) => (
                <td
                  key={j}
                  className={
                    "px-5 py-3 leading-snug " +
                    (j === 0
                      ? (primeiraColuna?.(k) ?? "font-semibold text-apr-text")
                      : "text-apr-muted")
                  }
                >
                  {typeof c === "string" ? <Rico t={c} /> : c}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </Item>
  );
}

/** Rodapé do slide (frase-resumo). */
export function Resumo({ t, i = 8 }: { t: string; i?: number }) {
  return (
    <Item i={i} className="text-[22px] text-apr-muted">
      <Rico t={t} />
    </Item>
  );
}

/** Duas colunas. */
export function Duas({
  esquerda,
  direita,
  proporcao = "1fr_1fr",
}: {
  esquerda: ReactNode;
  direita: ReactNode;
  proporcao?: "1fr_1fr" | "1.1fr_0.9fr" | "0.9fr_1.1fr";
}) {
  const cls: Record<string, string> = {
    "1fr_1fr": "grid-cols-2",
    "1.1fr_0.9fr": "grid-cols-[1.1fr_0.9fr]",
    "0.9fr_1.1fr": "grid-cols-[0.9fr_1.1fr]",
  };
  return (
    <div className={"mt-2 grid items-start gap-8 " + cls[proporcao]}>
      <div className="space-y-5">{esquerda}</div>
      <div className="space-y-5">{direita}</div>
    </div>
  );
}

/** Slide de conteúdo padrão. */
export function Conteudo({
  tag,
  kicker,
  titulo,
  corTag,
  children,
  rodape,
}: {
  tag?: string;
  kicker?: string;
  titulo: string;
  corTag?: "apr-glow" | "disc-d" | "disc-i" | "disc-s" | "disc-c";
  children: ReactNode;
  rodape?: string;
}) {
  return (
    <div className="relative flex h-full flex-col">
      <Cabecalho tag={tag} kicker={kicker} titulo={titulo} corTag={corTag} />
      <div className="flex flex-1 flex-col justify-center pb-4">{children}</div>
      {rodape && <Resumo t={rodape} />}
    </div>
  );
}

/* ---------------- slides de abertura ---------------- */

/** Capa de um treinamento. */
export function Capa({
  kicker,
  titulo,
  sub,
  nota,
  enfeite,
}: {
  kicker: string;
  titulo: string;
  sub: string;
  nota?: string;
  enfeite?: ReactNode;
}) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center text-center">
      <Sangria>
        <div className="absolute inset-0 bg-apr-bg/60" />
        <LuzDourada intensidade={0.7} />
      </Sangria>
      <Item>
        <img
          src="/apresentacao/lz7-energia-branco.png"
          alt="LZ7 Energia"
          className="h-[110px] w-auto"
        />
      </Item>
      {enfeite && (
        <Item i={1} className="mt-8">
          {enfeite}
        </Item>
      )}
      <Item
        i={2}
        className="mt-10 text-[20px] font-semibold uppercase tracking-[0.34em] text-apr-gold"
      >
        {kicker}
      </Item>
      <Item i={3}>
        <h1 className="mt-5 max-w-[1400px] font-display text-[96px] font-semibold leading-[1.02] tracking-tight text-apr-text">
          <Rico t={titulo} />
        </h1>
      </Item>
      <Item i={4} className="mt-7 max-w-[1200px] text-[28px] leading-snug text-apr-muted">
        <Rico t={sub} />
      </Item>
      {nota && (
        <Item i={5} className="mt-6 text-[18px] text-apr-dim">
          {nota}
        </Item>
      )}
    </div>
  );
}

/** Abertura de módulo: número gigante vazado + título. */
export function Modulo({
  numero,
  titulo,
  texto,
}: {
  numero: number;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="relative flex h-full items-center">
      <Sangria>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_20%_50%,color-mix(in_oklch,var(--color-apr-signed)_22%,transparent),transparent)]" />
      </Sangria>
      <motion.div
        aria-hidden
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.2, ease: EASE }}
        className="absolute -left-4 top-1/2 -translate-y-1/2 font-display text-[520px] font-semibold leading-none text-transparent [-webkit-text-stroke:2px_color-mix(in_oklch,var(--color-apr-glow)_35%,transparent)]"
      >
        {numero}
      </motion.div>
      <div className="relative ml-[360px] max-w-[1000px]">
        <Item i={0} className="text-[20px] font-semibold uppercase tracking-[0.34em] text-apr-glow">
          Módulo {numero}
        </Item>
        <Item i={1}>
          <h2 className="mt-4 font-display text-[92px] font-semibold leading-[1] tracking-tight text-apr-text">
            <Rico t={titulo} />
          </h2>
        </Item>
        <Item i={2} className="mt-8 text-[28px] leading-snug text-apr-muted">
          <Rico t={texto} />
        </Item>
      </div>
    </div>
  );
}

/** Lista de mantras (leve para a rua). */
export function Mantras({ kicker, itens }: { kicker: string; itens: string[] }) {
  return (
    <div className="relative h-full">
      <Sangria>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_80%_20%,color-mix(in_oklch,var(--color-apr-signed)_20%,transparent),transparent)]" />
      </Sangria>
      <Item i={0} className="flex items-center gap-4">
        <span className="rounded-full border border-apr-gold/50 bg-apr-gold/10 px-4 py-1 text-[14px] font-semibold uppercase tracking-[0.18em] text-apr-gold">
          Leve para a rua
        </span>
        <span className="text-[15px] font-semibold uppercase tracking-[0.22em] text-apr-muted">
          {kicker}
        </span>
      </Item>
      <ol className="mt-10 space-y-5">
        {itens.map((t, k) => (
          <motion.li
            key={k}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + k * 0.18, duration: 0.7, ease: EASE }}
            className="flex items-baseline gap-6"
          >
            <span className="w-14 shrink-0 font-display text-[44px] font-semibold text-apr-line">
              {k + 1}
            </span>
            <span className="font-display text-[38px] font-semibold leading-tight text-apr-text">
              <Rico t={t} />
            </span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

/** Encerramento. */
export function Fim({
  linha1,
  linha2,
  texto,
  enfeite,
}: {
  linha1: string;
  linha2: string;
  texto: string;
  enfeite?: ReactNode;
}) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center text-center">
      <Sangria>
        <div className="absolute inset-0 bg-apr-bg/60" />
        <LuzDourada />
      </Sangria>
      {enfeite && <Item className="mb-8">{enfeite}</Item>}
      <Item i={1}>
        <div className="font-display text-[80px] font-semibold leading-[1.05] tracking-tight text-apr-text">
          <Rico t={linha1} />
        </div>
      </Item>
      <Item i={2}>
        <div className="mt-2 font-display text-[80px] font-semibold leading-[1.05] tracking-tight text-apr-glow">
          <Rico t={linha2} />
        </div>
      </Item>
      <Item i={3} className="mt-8 max-w-[1200px] text-[26px] leading-snug text-apr-muted">
        <Rico t={texto} />
      </Item>
      <Item i={4} className="mt-12">
        <img
          src="/apresentacao/lz7-energia-branco.png"
          alt="LZ7 Energia"
          className="h-[90px] w-auto"
        />
      </Item>
    </div>
  );
}
