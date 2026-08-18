// Conteúdo editável da HOME pública da LZ7 Energia.
// Alterar aqui muda o site — nenhuma outra rota depende deste arquivo.

export const NAV_LINKS = [
  { id: "inicio", label: "Início" },
  { id: "solucoes", label: "Soluções" },
  { id: "como-funciona", label: "Como funciona" },
  { id: "vantagens", label: "Vantagens" },
  { id: "sobre", label: "Sobre nós" },
  { id: "projetos", label: "Projetos" },
] as const;

export const HERO = {
  eyebrow: "Energia solar inteligente",
  titleStart: "Economize até ",
  titleHighlight: "95%",
  titleEnd: " na sua conta de luz",
  subtitle:
    "Soluções completas em energia solar com tecnologia, qualidade e segurança que só a LZ7 oferece.",
  perks: [
    "Projeto 100% personalizado",
    "Equipamentos de alta performance",
    "Instalação rápida e segura",
    "Suporte pós-venda completo",
  ],
};

export const TRUST = {
  rating: "5,0",
  ratingLabel: "avaliação média no Google",
  metrics: [
    { value: "+40 MWp", label: "de energia instalada" },
    { value: "+1200", label: "clientes satisfeitos" },
  ],
};

export const BENEFITS = [
  { icon: "leaf", value: "Até 95%", label: "de economia" },
  { icon: "trend", value: "Retorno do investimento", label: "em 3 a 5 anos" },
  { icon: "shield", value: "25 anos", label: "de garantia nos painéis" },
  { icon: "coins", value: "Valorização", label: "do seu imóvel" },
] as const;

export const STEPS = [
  {
    n: "1",
    icon: "clipboard",
    title: "Solicite seu orçamento",
    text: "Preencha o formulário ou fale com um de nossos especialistas.",
  },
  {
    n: "2",
    icon: "pencil",
    title: "Projeto personalizado",
    text: "Analisamos seu consumo e criamos o projeto ideal para você.",
  },
  {
    n: "3",
    icon: "wrench",
    title: "Instalação rápida",
    text: "Nossa equipe instala tudo com segurança e qualidade garantida.",
  },
  {
    n: "4",
    icon: "zap",
    title: "Comece a economizar",
    text: "Seu sistema começa a gerar energia e você economiza todo mês.",
  },
] as const;

export const INSTITUTIONAL = {
  titleStart: "Energia limpa,",
  titleHighlight: "economia real.",
  text: "A LZ7 Energia é referência em energia solar no Paraná, oferecendo soluções completas para residências, comércios e indústrias.",
  items: [
    "Empresa 100% paranaense",
    "Equipe própria especializada",
    "Tecnologia de ponta",
    "Atendimento humanizado",
  ],
  cta: "Conheça nossa história",
  videoCaption:
    "Veja como nossos sistemas transformam energia solar em economia para você.",
};

export const BRANDS = [
  "Canadian Solar",
  "Jinko Solar",
  "Intelbras",
  "WEG",
  "Solis",
  "PHB Solar",
  "Sungrow",
];

export const PROPERTY_TYPES = [
  { value: "residencial", label: "Residencial", factor: 1 },
  { value: "comercial", label: "Comercial", factor: 1.05 },
  { value: "rural", label: "Rural", factor: 1.08 },
  { value: "industrial", label: "Industrial", factor: 1.12 },
] as const;

export const CITIES = [
  "Londrina - PR",
  "Maringá - PR",
  "Ponta Grossa - PR",
  "Curitiba - PR",
  "Cornélio Procópio - PR",
  "Apucarana - PR",
  "Wenceslau Braz - PR",
  "Jacarezinho - PR",
  "Ourinhos - SP",
  "Assis - SP",
  "Itararé - SP",
  "Outra cidade",
];

/** Parâmetros do simulador — estimativa configurável, não é proposta. */
export const SIMULATOR = {
  tarifaKwh: 1.05, // R$/kWh médio na região
  economiaPercentual: 0.95,
  geracaoMensalPorKwp: 115, // kWh/mês por kWp instalado
  custoPorKwp: 4200, // R$ por kWp instalado
  disclaimer:
    "Valores estimados. O resultado final depende da análise técnica e do consumo.",
};

export const FOOTER = {
  description:
    "Transformamos energia solar em economia real para você e para o planeta.",
  columns: [
    {
      title: "Soluções",
      links: [
        "Energia Solar Residencial",
        "Energia Solar Comercial",
        "Energia Solar Industrial",
        "Sistemas Híbridos",
        "Carport Solar",
      ],
    },
    {
      title: "Institucional",
      links: ["Sobre nós", "Nossos projetos", "Seja um parceiro", "Trabalhe conosco", "Blog"],
    },
  ],
};
