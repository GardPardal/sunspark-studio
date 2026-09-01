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
  videoCaption: "Veja como nossos sistemas transformam energia solar em economia para você.",
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
  disclaimer: "Valores estimados. O resultado final depende da análise técnica e do consumo.",
};

export const HOME_FAQS = [
  {
    q: "Quanto eu consigo economizar com energia solar?",
    a: "Com um sistema fotovoltaico dimensionado sob medida pela LZ7 Energia, a redução na conta de luz chega a até 95%. Você passa a pagar apenas a taxa mínima de disponibilidade da concessionária (Copel, CPFL, Enel) e a iluminação pública.",
  },
  {
    q: "Em quanto tempo o investimento em energia solar se paga (Payback)?",
    a: "O retorno médio do investimento (payback) varia de 3 a 5 anos. Como os painéis solares possuem vida útil superior a 25 anos, você desfruta de mais de 20 anos de energia limpa praticamente sem custo.",
  },
  {
    q: "Como funciona o financiamento de energia solar sem entrada?",
    a: "Trabalhamos com as principais instituições financeiras (BV, Santander, Solfácil, Banco do Brasil, Sicredi e Sicoob) com financiamento de até 100% do projeto em até 120 meses e carência de até 90 a 120 dias para pagar a 1ª parcela. A própria economia gerada na conta de luz paga a parcela do financiamento.",
  },
  {
    q: "O que acontece nos dias nublados, chuvosos ou à noite?",
    a: "Durante o dia, mesmo com nuvens, os painéis continuam gerando energia por meio da radiação difusa. O excedente produzido nos dias ensolarados é injetado na rede da concessionária e vira créditos energéticos com validade de até 60 meses, que você utiliza automaticamente à noite ou em dias de menor geração.",
  },
  {
    q: "Quais são as garantias oferecidas pela LZ7 Energia?",
    a: "Oferecemos 25 anos de garantia de eficiência de geração para os módulos solares (Tier 1), 10 a 12 anos de garantia para os inversores e garantia total de instalação com equipe técnica própria e engenharia especializada com ART registrada no CREA.",
  },
  {
    q: "Quem cuida da aprovação e homologação junto à concessionária?",
    a: "A equipe de engenharia da LZ7 cuida de 100% da burocracia: fazemos o projeto elétrico, emissão de ART, protocolo e aprovação de acesso junto à Copel, CPFL ou Enel, vistoria e troca do medidor bidirecional.",
  },
];

export const FOOTER = {
  description: "Transformamos energia solar em economia real para você e para o planeta.",
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
