/** Tipos e constantes do portal público — seguro para o bundle do cliente. */

export const SITE_URL = "https://lz7energia.com.br";

export type SolutionSlug =
  | "energia-solar-residencial"
  | "energia-solar-comercial"
  | "energia-solar-industrial"
  | "sistemas-hibridos"
  | "carport-solar";

export const SOLUTION_LINKS = [
  { slug: "energia-solar-residencial", to: "/energia-solar-residencial", label: "Energia Solar Residencial" },
  { slug: "energia-solar-comercial", to: "/energia-solar-comercial", label: "Energia Solar Comercial" },
  { slug: "energia-solar-industrial", to: "/energia-solar-industrial", label: "Energia Solar Industrial" },
  { slug: "sistemas-hibridos", to: "/sistemas-hibridos", label: "Sistemas Híbridos" },
  { slug: "carport-solar", to: "/carport-solar", label: "Carport Solar" },
] as const;

/** Conteúdo padrão exibido enquanto a solução não for personalizada no CMS. */
export const SOLUTION_DEFAULTS: Record<SolutionSlug, {
  name: string;
  headline: string;
  subheadline: string;
  intro: string;
  benefits: string[];
  faqs: Array<{ q: string; a: string }>;
}> = {
  "energia-solar-residencial": {
    name: "Energia Solar Residencial",
    headline: "Energia solar para a sua casa, com até 95% de economia",
    subheadline: "Projeto dimensionado pelo seu consumo, instalação com equipe própria e suporte pós-venda de verdade.",
    intro: "Transformamos o telhado da sua casa em uma usina de energia limpa. Analisamos sua conta de luz, dimensionamos o sistema ideal e cuidamos de todo o processo — projeto, homologação na concessionária e instalação.",
    benefits: [
      "Redução imediata na conta de luz",
      "Retorno do investimento em 3 a 5 anos",
      "25 anos de garantia de performance nos painéis",
      "Valorização do imóvel",
      "Financiamento em até 120 meses",
      "Monitoramento da geração pelo celular",
    ],
    faqs: [
      { q: "Quanto tempo leva a instalação?", a: "Na maioria das residências a instalação é concluída em 1 a 3 dias, após a aprovação do projeto." },
      { q: "Funciona em dias nublados?", a: "Sim. A geração diminui, mas o sistema continua produzindo e o excedente gerado em dias de sol vira crédito na concessionária." },
      { q: "Preciso trocar meu telhado?", a: "Não necessariamente. Avaliamos a estrutura na visita técnica e indicamos qualquer ajuste antes da instalação." },
    ],
  },
  "energia-solar-comercial": {
    name: "Energia Solar Comercial",
    headline: "Corte o custo de energia do seu comércio",
    subheadline: "Previsibilidade de custo e mais margem para o seu negócio, com projeto sob medida.",
    intro: "Energia é um dos maiores custos fixos do comércio. Com um sistema fotovoltaico dimensionado para o seu perfil de consumo, esse custo vira investimento com retorno mensurável.",
    benefits: [
      "Previsibilidade de custo operacional",
      "Redução de até 95% na conta de energia",
      "Depreciação e benefícios contábeis",
      "Imagem sustentável para a marca",
      "Projeto compatível com horário comercial de pico",
      "Manutenção preventiva programada",
    ],
    faqs: [
      { q: "Serve para imóvel alugado?", a: "Sim, com anuência do proprietário. Também existe a opção de sistema removível." },
      { q: "Qual o prazo de retorno?", a: "Em média de 3 a 5 anos, dependendo do consumo e da tarifa da concessionária." },
    ],
  },
  "energia-solar-industrial": {
    name: "Energia Solar Industrial",
    headline: "Alta potência para a sua indústria",
    subheadline: "Projetos de médio e grande porte, com engenharia dedicada e análise tarifária completa.",
    intro: "Atendemos plantas industriais com estudo de demanda, análise de enquadramento tarifário e projetos de alta potência, incluindo estruturas em solo e usinas remotas.",
    benefits: [
      "Redução expressiva no custo de produção",
      "Estudo de demanda e enquadramento tarifário",
      "Projetos em solo, telhado metálico e usina remota",
      "Engenharia e ART dedicadas",
      "Monitoramento com relatórios de performance",
      "Escalabilidade por etapas",
    ],
    faqs: [
      { q: "Atendem consumidores do grupo A?", a: "Sim. Fazemos o estudo tarifário e o dimensionamento considerando demanda contratada e ponta/fora ponta." },
      { q: "É possível usina remota?", a: "Sim, com geração compartilhada ou autoconsumo remoto dentro da mesma concessionária." },
    ],
  },
  "sistemas-hibridos": {
    name: "Sistemas Híbridos",
    headline: "Energia solar com baterias e autonomia real",
    subheadline: "Continue com energia mesmo durante quedas da rede, com armazenamento inteligente.",
    intro: "O sistema híbrido une geração solar e baterias. Você economiza no dia a dia e mantém cargas essenciais funcionando quando falta energia na rede.",
    benefits: [
      "Autonomia durante quedas de energia",
      "Armazenamento do excedente gerado",
      "Proteção para equipamentos sensíveis",
      "Ideal para áreas com rede instável",
      "Gestão inteligente de cargas essenciais",
      "Expansível conforme a necessidade",
    ],
    faqs: [
      { q: "Quanto tempo dura a bateria?", a: "Depende do banco dimensionado e das cargas essenciais. Fazemos esse cálculo na visita técnica." },
      { q: "Posso adicionar baterias depois?", a: "Sim, desde que o inversor já seja híbrido. Projetamos pensando nessa expansão." },
    ],
  },
  "carport-solar": {
    name: "Carport Solar",
    headline: "Estacionamento que gera energia",
    subheadline: "Cobertura para veículos que produz energia e valoriza o seu espaço.",
    intro: "O carport solar transforma a área de estacionamento em geração de energia, oferecendo sombra e proteção aos veículos com design moderno.",
    benefits: [
      "Aproveita a área do estacionamento",
      "Sombra e proteção para os veículos",
      "Visual moderno e sustentável",
      "Compatível com carregador para carro elétrico",
      "Estrutura projetada sob medida",
      "Ideal para comércios e condomínios",
    ],
    faqs: [
      { q: "Serve para condomínio?", a: "Sim. Atendemos áreas comuns de condomínios com medição adequada ao rateio." },
      { q: "Suporta carregador veicular?", a: "Sim, o projeto pode contemplar pontos de recarga para veículos elétricos." },
    ],
  },
};

export const INSTITUTIONAL_LINKS = [
  { to: "/sobre", label: "Sobre nós" },
  { to: "/projetos", label: "Nossos projetos" },
  { to: "/seja-um-parceiro", label: "Seja um parceiro" },
  { to: "/trabalhe-conosco", label: "Trabalhe conosco" },
  { to: "/blog", label: "Blog" },
] as const;

export const LEGAL_LINKS = [
  { to: "/politica-de-privacidade", label: "Política de Privacidade" },
  { to: "/termos-de-uso", label: "Termos de Uso" },
] as const;

export const PROJECT_CATEGORIES = [
  { value: "residencial", label: "Residencial" },
  { value: "comercial", label: "Comercial" },
  { value: "industrial", label: "Industrial" },
  { value: "rural", label: "Rural" },
  { value: "carport", label: "Carport" },
  { value: "hibrido", label: "Híbrido" },
] as const;

export const PARTNERSHIP_TYPES = [
  "Indicação",
  "Representação",
  "Fornecedor",
  "Parceiro comercial",
  "Imobiliária",
  "Construtora",
  "Arquiteto",
  "Engenheiro",
  "Outro",
];

export const CONTACT_SUBJECTS = [
  { value: "orcamento", label: "Quero um orçamento", routed_to: "comercial" },
  { value: "cliente", label: "Já sou cliente", routed_to: "suporte" },
  { value: "assistencia", label: "Assistência / suporte", routed_to: "suporte" },
  { value: "financeiro", label: "Financeiro", routed_to: "financeiro" },
  { value: "carreiras", label: "Trabalhe conosco", routed_to: "rh" },
  { value: "parceria", label: "Parcerias", routed_to: "parcerias" },
  { value: "fornecedor", label: "Fornecedor", routed_to: "suprimentos" },
  { value: "outro", label: "Outro", routed_to: "comercial" },
] as const;

export const BILL_RANGES = [
  "até R$ 200",
  "R$ 200 a R$ 400",
  "R$ 400 a R$ 700",
  "R$ 700 a R$ 1.000",
  "acima de R$ 1.000",
];

export const APPLICATION_STATUSES = [
  { value: "novo", label: "Novo" },
  { value: "triagem", label: "Triagem" },
  { value: "entrevista", label: "Entrevista" },
  { value: "processo", label: "Processo seletivo" },
  { value: "aprovado", label: "Aprovado" },
  { value: "reprovado", label: "Reprovado" },
  { value: "banco_talentos", label: "Banco de talentos" },
] as const;

export const PARTNER_STATUSES = [
  { value: "novo", label: "Novo" },
  { value: "em_analise", label: "Em análise" },
  { value: "contato_realizado", label: "Contato realizado" },
  { value: "reuniao_agendada", label: "Reunião agendada" },
  { value: "aprovado", label: "Aprovado" },
  { value: "recusado", label: "Recusado" },
] as const;

export const POST_STATUSES = [
  { value: "rascunho", label: "Rascunho" },
  { value: "revisao", label: "Revisão" },
  { value: "agendado", label: "Agendado" },
  { value: "publicado", label: "Publicado" },
  { value: "arquivado", label: "Arquivado" },
] as const;

export const JOB_STATUSES = [
  { value: "rascunho", label: "Rascunho" },
  { value: "aberta", label: "Aberta" },
  { value: "pausada", label: "Pausada" },
  { value: "encerrada", label: "Encerrada" },
  { value: "arquivada", label: "Arquivada" },
] as const;

export type Origin = Record<string, string | undefined>;

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 90);
}

export function readingMinutes(content: string) {
  const words = content.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

export function formatDatePtBr(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}
