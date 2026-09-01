/** Utilitários puros do Radar Editorial (client-safe). */

export const EDITORIAL_CATEGORIES = [
  { slug: "energia-solar", name: "Energia Solar" },
  { slug: "conta-de-luz", name: "Conta de Luz" },
  { slug: "mercado-de-energia", name: "Mercado de Energia" },
  { slug: "aneel-regulamentacao", name: "ANEEL & Regulamentação" },
  { slug: "empresas", name: "Empresas" },
  { slug: "agronegocio", name: "Agronegócio" },
  { slug: "tecnologia", name: "Tecnologia" },
  { slug: "armazenamento-baterias", name: "Armazenamento & Baterias" },
  { slug: "mobilidade-eletrica", name: "Mobilidade Elétrica" },
  { slug: "sustentabilidade", name: "Sustentabilidade" },
  { slug: "guias", name: "Guias" },
  { slug: "noticias", name: "Notícias" },
] as const;

export const TOPIC_STATUS_LABEL: Record<string, string> = {
  identificada: "Pauta identificada",
  coletando: "Coletando fontes",
  verificando: "Verificando",
  gerando: "Gerando artigo",
  revisao: "Aguardando revisão",
  agendado: "Agendado",
  publicado: "Publicado",
  atualizado: "Atualizado",
  ignorado: "Ignorado",
  erro: "Erro",
};

/** Palavras-chave de alta prioridade para a LZ7 (80–100). */
const HIGH = [
  "energia solar",
  "fotovoltaic",
  "geração distribuída",
  "geracao distribuida",
  "conta de luz",
  "tarifa",
  "bandeira tarifária",
  "bandeira tarifaria",
  "aneel",
  "financiamento solar",
  "armazenamento",
  "bateria",
  "sistema híbrido",
  "sistema hibrido",
  "mercado livre",
  "painel solar",
  "placa solar",
  "módulo fotovoltaico",
  "inversor",
  "net metering",
  "autoconsumo",
  "microgeração",
  "minigeração",
  "microgeracao",
  "minigeracao",
];

/** Média prioridade (50–79). */
const MEDIUM = [
  "transmissão",
  "transmissao",
  "usina",
  "leilão",
  "leilao",
  "política energética",
  "politica energetica",
  "eólica",
  "eolica",
  "hidrelétrica",
  "hidreletrica",
  "epe",
  "ons",
  "ccee",
  "mme",
  "distribuidora",
  "setor elétrico",
  "setor eletrico",
  "energia renovável",
  "energia renovavel",
  "transição energética",
  "transicao energetica",
  "carro elétrico",
  "carro eletrico",
  "veículo elétrico",
  "veiculo eletrico",
  "agro",
  "agronegócio",
  "agronegocio",
  "eficiência energética",
  "eficiencia energetica",
  "apagão",
  "apagao",
];

const NEGATIVE = ["futebol", "celebridade", "novela", "loteria", "horóscopo", "horoscopo"];

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Score de relevância LZ7 (0–100) — heurístico e barato, sem IA. */
export function lz7Relevance(title: string, summary = ""): { score: number; matched: string[] } {
  const text = normalizeText(`${title} ${summary}`);
  const matched: string[] = [];
  let score = 0;
  for (const kw of HIGH) {
    if (text.includes(normalizeText(kw))) {
      matched.push(kw);
      score += 30;
    }
  }
  for (const kw of MEDIUM) {
    if (text.includes(normalizeText(kw))) {
      matched.push(kw);
      score += 14;
    }
  }
  for (const kw of NEGATIVE) if (text.includes(normalizeText(kw))) score -= 40;
  if (/energia|eletric|elétric/.test(text) && score > 0) score += 6;
  return { score: Math.max(0, Math.min(100, score)), matched: [...new Set(matched)].slice(0, 8) };
}

/** Categoria sugerida a partir do texto. */
export function guessCategory(title: string, summary = ""): string {
  const t = normalizeText(`${title} ${summary}`);
  if (/bateria|armazenamento|bess|hibrido/.test(t)) return "armazenamento-baterias";
  if (/tarifa|bandeira|conta de luz|reajuste|fatura/.test(t)) return "conta-de-luz";
  if (/aneel|resolucao|consulta publica|regulament|decreto|lei /.test(t))
    return "aneel-regulamentacao";
  if (/mercado livre|ccee|comercializacao|preco de energia|pld/.test(t))
    return "mercado-de-energia";
  if (/veiculo eletrico|carro eletrico|recarga|mobilidade/.test(t)) return "mobilidade-eletrica";
  if (/agro|rural|produtor|fazenda|irrigacao/.test(t)) return "agronegocio";
  if (/empresa|industria|comercio|corporativ/.test(t)) return "empresas";
  if (/solar|fotovoltaic|painel|placa|geracao distribuida/.test(t)) return "energia-solar";
  if (/tecnologia|inovacao|inversor|eficiencia/.test(t)) return "tecnologia";
  if (/sustentab|transicao energetica|carbono|clima/.test(t)) return "sustentabilidade";
  return "noticias";
}

/** Confiança (0–100) a partir dos tipos de fonte que confirmam a pauta. */
export function confidenceFromSources(tipos: string[]): number {
  const oficial = tipos.filter((t) => t === "oficial").length;
  const entidade = tipos.filter((t) => t === "entidade").length;
  const jornal = tipos.filter((t) => t === "especializado" || t === "geral").length;
  if (oficial >= 1 && entidade + jornal >= 1) return 96;
  if (oficial >= 1) return 90;
  if (entidade >= 1 && jornal >= 1) return 85;
  if (jornal >= 2) return 82;
  if (entidade >= 1) return 74;
  if (jornal === 1) return 66;
  return 40;
}

export function slugify(input: string): string {
  return normalizeText(input)
    .replace(/[^a-z0-9\s-]/g, "")
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w))
    .slice(0, 9)
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const STOP = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "a",
  "o",
  "as",
  "os",
  "e",
  "em",
  "para",
  "com",
  "por",
  "no",
  "na",
  "nos",
  "nas",
  "um",
  "uma",
  "que",
  "ao",
  "aos",
  "se",
  "sobre",
]);

/** Assinatura curta usada para agrupar pautas iguais. */
export function fingerprint(title: string): string {
  const words = normalizeText(title)
    .replace(/[^a-z0-9\s]/g, "")
    .split(" ")
    .filter((w) => w.length > 3 && !STOP.has(w))
    .sort();
  return [...new Set(words)].slice(0, 8).join("-");
}

/** Similaridade de Jaccard entre dois textos por tokens. */
export function similarity(a: string, b: string): number {
  const ta = new Set(
    normalizeText(a)
      .replace(/[^a-z0-9\s]/g, "")
      .split(" ")
      .filter((w) => w.length > 3),
  );
  const tb = new Set(
    normalizeText(b)
      .replace(/[^a-z0-9\s]/g, "")
      .split(" ")
      .filter((w) => w.length > 3),
  );
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return Math.round((inter / new Set([...ta, ...tb]).size) * 100);
}

export function readingMinutes(text: string): number {
  const words = text
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
