/**
 * Disputa das casas (campanha mensal de vendas).
 * Fonte: planilha "CAMPANHAS 092026 - CASAS" (metas e realizado por vendedor, fechada pela
 * gestão). Não vem do Ploomes: as metas existem só na planilha. Um mês sem planilha
 * cadastrada aqui não mostra os slides das casas.
 */

export type MembroCasa = {
  nome: string;
  prospMeta: number | null;
  prosp: number | null;
  vendasMeta: number | null;
  vendas: number | null;
  fatMeta: number | null;
  fat: number | null;
};

export type Casa = {
  id: "valaris" | "nordran" | "aureon";
  nome: string;
  /** Unidade da casa (WB = Wenceslau Braz, LD = Londrina, PG = Ponta Grossa). */
  unidade: string;
  brasao: string;
  /** Cor da casa na planilha (classe de token). */
  cor: "valaris" | "nordran" | "aureon";
  membros: MembroCasa[];
  total: {
    prospMeta: number;
    prosp: number;
    vendasMeta: number;
    vendas: number;
    fatMeta: number;
    fat: number;
  };
};

export type Campanha = {
  fonte: string;
  /** Critérios de conquista do trono. */
  criterios: { minProsp: number; minFat: number; texto: string[] };
  rampagem: string[];
  casas: Casa[];
};

const m = (
  nome: string,
  prospMeta: number | null,
  prosp: number | null,
  vendasMeta: number | null,
  vendas: number | null,
  fatMeta: number | null,
  fat: number | null,
): MembroCasa => ({ nome, prospMeta, prosp, vendasMeta, vendas, fatMeta, fat });

export const CAMPANHAS: Record<string, Campanha> = {
  "2026-09": {
    fonte: "Planilha CAMPANHAS 09/2026 · Casas",
    criterios: {
      minProsp: 71,
      minFat: 71,
      texto: [
        "O maior número de vendas",
        "Mínimo de 71% da meta de prospecção",
        "Mínimo de 71% da meta de faturamento",
      ],
    },
    rampagem: [
      "1º mês: 12 prospecções por dia útil",
      "2º mês: 10 por dia útil",
      "3º mês: 8 por dia útil",
      "21 dias úteis",
    ],
    casas: [
      {
        id: "valaris",
        nome: "Casa Valaris",
        unidade: "Wenceslau Braz",
        brasao: "/apresentacao/casa-valaris.png",
        cor: "valaris",
        membros: [
          m("Beatriz", 168, 18, 13, 4, 200000, 633645.75),
          m("Taciano", 96, 90, 3, 1, 45000, 10694.15),
          m("Eduarda", 168, 134, 10, 4, 150000, 47205.6),
          m("Ana Vitória", 252, 89, 3, 0, 45000, 0),
          m("Pâmela Martins", null, null, null, null, null, 90000),
        ],
        total: {
          prospMeta: 684,
          prosp: 331,
          vendasMeta: 29,
          vendas: 9,
          fatMeta: 395000,
          fat: 781545.5,
        },
      },
      {
        id: "nordran",
        nome: "Casa Nordran",
        unidade: "Londrina",
        brasao: "/apresentacao/casa-nordran.png",
        cor: "nordran",
        membros: [
          m("Maycom", 168, 52, 10, 9, 150000, 109268.34),
          m("Guilherme", 168, 83, 10, 8, 150000, 85698),
          m("Mycaela", 168, 67, 10, 3, 150000, 31998),
          m("Victor Hugo", 168, 68, 10, 3, 150000, 34325),
          m("Ademir", null, null, null, null, null, 14537.31),
        ],
        total: {
          prospMeta: 672,
          prosp: 270,
          vendasMeta: 40,
          vendas: 23,
          fatMeta: 600000,
          fat: 275826.65,
        },
      },
      {
        id: "aureon",
        nome: "Casa Aureon",
        unidade: "Ponta Grossa",
        brasao: "/apresentacao/casa-aureon.png",
        cor: "aureon",
        membros: [
          m("Kamili", 168, 242, 10, 3, 150000, 52913.59),
          m("Rodrigo", 252, 242, 3, 0, 45000, 0),
          m("Ademir", 252, 55, 3, 0, 45000, 0),
          m("Thiago", null, null, null, null, null, 24565.58),
        ],
        total: {
          prospMeta: 672,
          prosp: 539,
          vendasMeta: 16,
          vendas: 3,
          fatMeta: 240000,
          fat: 77479.17,
        },
      },
    ],
  },
};

export const pctMeta = (v: number, meta: number) => (meta > 0 ? (v / meta) * 100 : 0);

/**
 * Quem conquista o trono: entre as casas com pelo menos o mínimo de prospecção e de
 * faturamento, a de maior número de vendas. Nenhuma qualificada → trono vazio.
 */
export function vencedora(c: Campanha): Casa | null {
  const aptas = c.casas.filter(
    (k) =>
      pctMeta(k.total.prosp, k.total.prospMeta) >= c.criterios.minProsp &&
      pctMeta(k.total.fat, k.total.fatMeta) >= c.criterios.minFat,
  );
  return aptas.sort((a, b) => b.total.vendas - a.total.vendas)[0] ?? null;
}
