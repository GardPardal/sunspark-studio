/**
 * SEO local programático — cidades atendidas pela LZ7 Energia dentro de um raio
 * de 500 km das nossas bases operacionais. Os dados aqui alimentam as páginas
 * /energia-solar/{cidade}, o hub /energia-solar e o sitemap.
 *
 * Regras:
 * - distância é calculada por Haversine a partir das coordenadas reais;
 * - irradiação é a média regional (Atlas Brasileiro de Energia Solar / Global
 *   Solar Atlas), apresentada como faixa regional e nunca como medição local;
 * - nada de número inventado sobre clientes, obras ou prazos por cidade.
 */

export type Base = {
  slug: string;
  nome: string;
  cidade: string;
  uf: string;
  lat: number;
  lon: number;
};

export type Regiao = {
  id: string;
  nome: string;
  irradiacao: number; // kWh/m²/dia — média regional
  descricao: string;
};

export type Cidade = {
  slug: string;
  nome: string;
  uf: "PR" | "SP" | "SC" | "MS";
  lat: number;
  lon: number;
  regiao: string;
  concessionaria: string;
  destaques: string[]; // vocação econômica local (contexto real e verificável)
  vizinhas: string[]; // slugs de cidades próximas atendidas
};

export const BASES: Base[] = [
  {
    slug: "londrina",
    nome: "LZ7 Energia Londrina",
    cidade: "Londrina",
    uf: "PR",
    lat: -23.31,
    lon: -51.16,
  },
  {
    slug: "ponta-grossa",
    nome: "LZ7 Energia Ponta Grossa",
    cidade: "Ponta Grossa",
    uf: "PR",
    lat: -25.09,
    lon: -50.16,
  },
  {
    slug: "wenceslau-braz",
    nome: "LZ7 Energia Wenceslau Braz",
    cidade: "Wenceslau Braz",
    uf: "PR",
    lat: -23.87,
    lon: -49.8,
  },
];

export const REGIOES: Record<string, Regiao> = {
  norte_pr: {
    id: "norte_pr",
    nome: "Norte do Paraná",
    irradiacao: 5.0,
    descricao:
      "Região de alta insolação e forte presença do agronegócio, com telhados amplos e consumo elevado em irrigação, secadores e câmaras frias.",
  },
  campos_gerais: {
    id: "campos_gerais",
    nome: "Campos Gerais",
    irradiacao: 4.7,
    descricao:
      "Clima mais frio e industrializado, com indústrias de papel, alimentos e logística que operam em horário comercial — perfil ideal para geração no próprio horário de consumo.",
  },
  norte_pioneiro: {
    id: "norte_pioneiro",
    nome: "Norte Pioneiro",
    irradiacao: 4.9,
    descricao:
      "Cidades de porte médio e propriedades rurais familiares, onde a conta de luz pesa muito no custo de produção.",
  },
  centro_pr: {
    id: "centro_pr",
    nome: "Centro e Oeste do Paraná",
    irradiacao: 4.9,
    descricao:
      "Polos de agroindústria e comércio regional, com demanda crescente por geração própria.",
  },
  rmc: {
    id: "rmc",
    nome: "Curitiba e Região Metropolitana",
    irradiacao: 4.5,
    descricao:
      "Mesmo com mais dias nublados, a tarifa alta e a estabilidade do consumo residencial e comercial mantêm o retorno atrativo.",
  },
  sudoeste_sp: {
    id: "sudoeste_sp",
    nome: "Sudoeste Paulista",
    irradiacao: 5.1,
    descricao:
      "Uma das melhores janelas de irradiação da nossa área de atuação, com cana, grãos e agroindústria puxando o consumo.",
  },
  interior_sp: {
    id: "interior_sp",
    nome: "Interior de São Paulo",
    irradiacao: 5.2,
    descricao:
      "Alta irradiação e tarifas elevadas — combinação que costuma acelerar o retorno do investimento.",
  },
  norte_sc: {
    id: "norte_sc",
    nome: "Norte de Santa Catarina",
    irradiacao: 4.6,
    descricao: "Indústria, comércio e turismo com consumo constante ao longo do ano.",
  },
};

export const CIDADES: Cidade[] = [
  // ——— Norte do Paraná
  {
    slug: "londrina",
    nome: "Londrina",
    uf: "PR",
    lat: -23.31,
    lon: -51.16,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["segundo maior município do Paraná", "forte setor de serviços, saúde e agro"],
    vizinhas: ["cambe", "rolandia", "arapongas", "ibipora"],
  },
  {
    slug: "cambe",
    nome: "Cambé",
    uf: "PR",
    lat: -23.28,
    lon: -51.28,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["polo industrial e logístico", "loteamentos residenciais em expansão"],
    vizinhas: ["londrina", "rolandia", "ibipora"],
  },
  {
    slug: "rolandia",
    nome: "Rolândia",
    uf: "PR",
    lat: -23.31,
    lon: -51.37,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["indústria de alimentos e metalmecânica"],
    vizinhas: ["cambe", "arapongas", "londrina"],
  },
  {
    slug: "arapongas",
    nome: "Arapongas",
    uf: "PR",
    lat: -23.42,
    lon: -51.42,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["capital nacional do móvel", "galpões industriais com grandes telhados"],
    vizinhas: ["rolandia", "apucarana", "londrina"],
  },
  {
    slug: "apucarana",
    nome: "Apucarana",
    uf: "PR",
    lat: -23.55,
    lon: -51.46,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["polo de bonés e confecção", "indústria têxtil"],
    vizinhas: ["arapongas", "maringa", "londrina"],
  },
  {
    slug: "ibipora",
    nome: "Ibiporã",
    uf: "PR",
    lat: -23.27,
    lon: -51.05,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["agroindústria e cooperativas"],
    vizinhas: ["londrina", "cambe", "jataizinho"],
  },
  {
    slug: "jataizinho",
    nome: "Jataizinho",
    uf: "PR",
    lat: -23.26,
    lon: -50.98,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["propriedades rurais e pequenos comércios"],
    vizinhas: ["ibipora", "cornelio-procopio", "londrina"],
  },
  {
    slug: "maringa",
    nome: "Maringá",
    uf: "PR",
    lat: -23.42,
    lon: -51.94,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["centro econômico do noroeste paranaense", "serviços, saúde e agronegócio"],
    vizinhas: ["sarandi", "marialva", "apucarana"],
  },
  {
    slug: "sarandi",
    nome: "Sarandi",
    uf: "PR",
    lat: -23.44,
    lon: -51.87,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["forte adensamento residencial"],
    vizinhas: ["maringa", "marialva"],
  },
  {
    slug: "marialva",
    nome: "Marialva",
    uf: "PR",
    lat: -23.48,
    lon: -51.79,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["capital da uva fina", "irrigação e estufas"],
    vizinhas: ["maringa", "sarandi", "apucarana"],
  },
  {
    slug: "astorga",
    nome: "Astorga",
    uf: "PR",
    lat: -23.23,
    lon: -51.66,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["cafeicultura e grãos"],
    vizinhas: ["maringa", "londrina"],
  },
  {
    slug: "porecatu",
    nome: "Porecatu",
    uf: "PR",
    lat: -22.75,
    lon: -51.38,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["usinas de cana e agricultura irrigada"],
    vizinhas: ["londrina", "sertanopolis"],
  },
  {
    slug: "sertanopolis",
    nome: "Sertanópolis",
    uf: "PR",
    lat: -23.06,
    lon: -51.04,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["grãos e avicultura"],
    vizinhas: ["londrina", "bela-vista-do-paraiso"],
  },
  {
    slug: "bela-vista-do-paraiso",
    nome: "Bela Vista do Paraíso",
    uf: "PR",
    lat: -22.99,
    lon: -51.19,
    regiao: "norte_pr",
    concessionaria: "Copel",
    destaques: ["produção agrícola familiar"],
    vizinhas: ["londrina", "sertanopolis"],
  },

  // ——— Norte Pioneiro
  {
    slug: "wenceslau-braz",
    nome: "Wenceslau Braz",
    uf: "PR",
    lat: -23.87,
    lon: -49.8,
    regiao: "norte_pioneiro",
    concessionaria: "Copel",
    destaques: ["comércio regional", "propriedades rurais no entorno"],
    vizinhas: ["siqueira-campos", "arapoti", "jacarezinho"],
  },
  {
    slug: "siqueira-campos",
    nome: "Siqueira Campos",
    uf: "PR",
    lat: -23.69,
    lon: -49.83,
    regiao: "norte_pioneiro",
    concessionaria: "Copel",
    destaques: ["polo industrial de calçados e motopeças", "comércio e agropecuária"],
    vizinhas: ["wenceslau-braz", "jacarezinho", "ibaiti"],
  },
  {
    slug: "ibaiti",
    nome: "Ibaiti",
    uf: "PR",
    lat: -23.84,
    lon: -50.18,
    regiao: "norte_pioneiro",
    concessionaria: "Copel",
    destaques: ["Rainha das Colinas", "polo regional de comércio, saúde e café"],
    vizinhas: ["wenceslau-braz", "santo-antonio-da-platina", "siqueira-campos"],
  },
  {
    slug: "jacarezinho",
    nome: "Jacarezinho",
    uf: "PR",
    lat: -23.16,
    lon: -49.97,
    regiao: "norte_pioneiro",
    concessionaria: "Copel",
    destaques: ["polo universitário", "cana-de-açúcar"],
    vizinhas: ["cambara", "santo-antonio-da-platina", "ourinhos"],
  },
  {
    slug: "santo-antonio-da-platina",
    nome: "Santo Antônio da Platina",
    uf: "PR",
    lat: -23.29,
    lon: -50.08,
    regiao: "norte_pioneiro",
    concessionaria: "Copel",
    destaques: ["comércio e serviços do Norte Pioneiro"],
    vizinhas: ["jacarezinho", "wenceslau-braz"],
  },
  {
    slug: "cambara",
    nome: "Cambará",
    uf: "PR",
    lat: -23.05,
    lon: -50.07,
    regiao: "norte_pioneiro",
    concessionaria: "Copel",
    destaques: ["indústria de papel e agro"],
    vizinhas: ["jacarezinho", "ourinhos"],
  },
  {
    slug: "cornelio-procopio",
    nome: "Cornélio Procópio",
    uf: "PR",
    lat: -23.18,
    lon: -50.65,
    regiao: "norte_pioneiro",
    concessionaria: "Copel",
    destaques: ["universidades e agroindústria"],
    vizinhas: ["bandeirantes", "londrina", "jataizinho"],
  },
  {
    slug: "bandeirantes",
    nome: "Bandeirantes",
    uf: "PR",
    lat: -23.11,
    lon: -50.37,
    regiao: "norte_pioneiro",
    concessionaria: "Copel",
    destaques: ["cana e grãos"],
    vizinhas: ["cornelio-procopio", "jacarezinho"],
  },
  {
    slug: "arapoti",
    nome: "Arapoti",
    uf: "PR",
    lat: -24.15,
    lon: -49.83,
    regiao: "norte_pioneiro",
    concessionaria: "Copel",
    destaques: ["florestal, papel e grãos"],
    vizinhas: ["wenceslau-braz", "jaguariaiva"],
  },
  {
    slug: "jaguariaiva",
    nome: "Jaguariaíva",
    uf: "PR",
    lat: -24.25,
    lon: -49.7,
    regiao: "norte_pioneiro",
    concessionaria: "Copel",
    destaques: ["indústria de papel e celulose"],
    vizinhas: ["arapoti", "ponta-grossa"],
  },

  // ——— Campos Gerais
  {
    slug: "ponta-grossa",
    nome: "Ponta Grossa",
    uf: "PR",
    lat: -25.09,
    lon: -50.16,
    regiao: "campos_gerais",
    concessionaria: "Copel",
    destaques: ["maior parque industrial do interior paranaense", "logística e alimentos"],
    vizinhas: ["castro", "carambei", "telemaco-borba"],
  },
  {
    slug: "castro",
    nome: "Castro",
    uf: "PR",
    lat: -24.79,
    lon: -50.01,
    regiao: "campos_gerais",
    concessionaria: "Copel",
    destaques: ["maior bacia leiteira do Paraná", "granjas e resfriadores"],
    vizinhas: ["carambei", "ponta-grossa"],
  },
  {
    slug: "carambei",
    nome: "Carambeí",
    uf: "PR",
    lat: -24.92,
    lon: -50.1,
    regiao: "campos_gerais",
    concessionaria: "Copel",
    destaques: ["cooperativas de leite e aves"],
    vizinhas: ["castro", "ponta-grossa"],
  },
  {
    slug: "telemaco-borba",
    nome: "Telêmaco Borba",
    uf: "PR",
    lat: -24.32,
    lon: -50.61,
    regiao: "campos_gerais",
    concessionaria: "Copel",
    destaques: ["papel, celulose e indústria de base"],
    vizinhas: ["ponta-grossa", "ortigueira"],
  },
  {
    slug: "ortigueira",
    nome: "Ortigueira",
    uf: "PR",
    lat: -24.21,
    lon: -50.94,
    regiao: "campos_gerais",
    concessionaria: "Copel",
    destaques: ["florestal e propriedades rurais"],
    vizinhas: ["telemaco-borba", "ponta-grossa"],
  },
  {
    slug: "irati",
    nome: "Irati",
    uf: "PR",
    lat: -25.47,
    lon: -50.65,
    regiao: "campos_gerais",
    concessionaria: "Copel",
    destaques: ["madeira, erva-mate e comércio"],
    vizinhas: ["ponta-grossa", "prudentopolis"],
  },
  {
    slug: "prudentopolis",
    nome: "Prudentópolis",
    uf: "PR",
    lat: -25.21,
    lon: -50.98,
    regiao: "campos_gerais",
    concessionaria: "Copel",
    destaques: ["turismo de cachoeiras e agricultura"],
    vizinhas: ["irati", "guarapuava"],
  },
  {
    slug: "palmeira",
    nome: "Palmeira",
    uf: "PR",
    lat: -25.43,
    lon: -50.0,
    regiao: "campos_gerais",
    concessionaria: "Copel",
    destaques: ["agropecuária e indústria"],
    vizinhas: ["ponta-grossa", "curitiba"],
  },

  // ——— Centro e Oeste do Paraná
  {
    slug: "guarapuava",
    nome: "Guarapuava",
    uf: "PR",
    lat: -25.39,
    lon: -51.46,
    regiao: "centro_pr",
    concessionaria: "Copel",
    destaques: ["grãos, madeira e comércio regional"],
    vizinhas: ["prudentopolis", "pitanga"],
  },
  {
    slug: "pitanga",
    nome: "Pitanga",
    uf: "PR",
    lat: -24.76,
    lon: -51.76,
    regiao: "centro_pr",
    concessionaria: "Copel",
    destaques: ["agricultura e pecuária"],
    vizinhas: ["guarapuava", "campo-mourao"],
  },
  {
    slug: "campo-mourao",
    nome: "Campo Mourão",
    uf: "PR",
    lat: -24.05,
    lon: -52.38,
    regiao: "centro_pr",
    concessionaria: "Copel",
    destaques: ["cooperativas de grãos e agroindústria"],
    vizinhas: ["pitanga", "maringa"],
  },
  {
    slug: "ivaipora",
    nome: "Ivaiporã",
    uf: "PR",
    lat: -24.25,
    lon: -51.68,
    regiao: "centro_pr",
    concessionaria: "Copel",
    destaques: ["centro de serviços do Vale do Ivaí"],
    vizinhas: ["apucarana", "campo-mourao"],
  },

  // ——— Curitiba e RMC
  {
    slug: "curitiba",
    nome: "Curitiba",
    uf: "PR",
    lat: -25.43,
    lon: -49.27,
    regiao: "rmc",
    concessionaria: "Copel",
    destaques: ["capital do estado", "serviços, tecnologia e indústria"],
    vizinhas: ["sao-jose-dos-pinhais", "araucaria", "colombo"],
  },
  {
    slug: "sao-jose-dos-pinhais",
    nome: "São José dos Pinhais",
    uf: "PR",
    lat: -25.53,
    lon: -49.2,
    regiao: "rmc",
    concessionaria: "Copel",
    destaques: ["polo automotivo e logístico"],
    vizinhas: ["curitiba", "araucaria"],
  },
  {
    slug: "araucaria",
    nome: "Araucária",
    uf: "PR",
    lat: -25.59,
    lon: -49.41,
    regiao: "rmc",
    concessionaria: "Copel",
    destaques: ["refino, química e metalmecânica"],
    vizinhas: ["curitiba", "sao-jose-dos-pinhais"],
  },
  {
    slug: "colombo",
    nome: "Colombo",
    uf: "PR",
    lat: -25.29,
    lon: -49.22,
    regiao: "rmc",
    concessionaria: "Copel",
    destaques: ["indústria moveleira e comércio"],
    vizinhas: ["curitiba", "pinhais"],
  },
  {
    slug: "pinhais",
    nome: "Pinhais",
    uf: "PR",
    lat: -25.44,
    lon: -49.19,
    regiao: "rmc",
    concessionaria: "Copel",
    destaques: ["indústria leve e serviços"],
    vizinhas: ["curitiba", "colombo"],
  },

  // ——— Sudoeste paulista e interior de SP
  {
    slug: "ourinhos",
    nome: "Ourinhos",
    uf: "SP",
    lat: -22.97,
    lon: -49.87,
    regiao: "sudoeste_sp",
    concessionaria: "CPFL Santa Cruz",
    destaques: ["entroncamento ferroviário e agroindústria"],
    vizinhas: ["santa-cruz-do-rio-pardo", "assis", "jacarezinho"],
  },
  {
    slug: "assis",
    nome: "Assis",
    uf: "SP",
    lat: -22.66,
    lon: -50.41,
    regiao: "sudoeste_sp",
    concessionaria: "CPFL Santa Cruz",
    destaques: ["cana, grãos e serviços"],
    vizinhas: ["ourinhos", "candido-mota"],
  },
  {
    slug: "candido-mota",
    nome: "Cândido Mota",
    uf: "SP",
    lat: -22.75,
    lon: -50.39,
    regiao: "sudoeste_sp",
    concessionaria: "CPFL Santa Cruz",
    destaques: ["agricultura irrigada"],
    vizinhas: ["assis", "ourinhos"],
  },
  {
    slug: "santa-cruz-do-rio-pardo",
    nome: "Santa Cruz do Rio Pardo",
    uf: "SP",
    lat: -22.9,
    lon: -49.63,
    regiao: "sudoeste_sp",
    concessionaria: "CPFL Santa Cruz",
    destaques: ["indústria e pecuária"],
    vizinhas: ["ourinhos", "avare"],
  },
  {
    slug: "itarare",
    nome: "Itararé",
    uf: "SP",
    lat: -24.11,
    lon: -49.33,
    regiao: "sudoeste_sp",
    concessionaria: "CPFL Santa Cruz",
    destaques: ["divisa com o Paraná", "agricultura de clima frio"],
    vizinhas: ["itapeva", "jaguariaiva"],
  },
  {
    slug: "itapeva",
    nome: "Itapeva",
    uf: "SP",
    lat: -23.98,
    lon: -48.88,
    regiao: "sudoeste_sp",
    concessionaria: "CPFL Piratininga",
    destaques: ["grãos, florestal e comércio"],
    vizinhas: ["itarare", "capao-bonito"],
  },
  {
    slug: "capao-bonito",
    nome: "Capão Bonito",
    uf: "SP",
    lat: -24.01,
    lon: -48.35,
    regiao: "sudoeste_sp",
    concessionaria: "CPFL Piratininga",
    destaques: ["florestal e agropecuária"],
    vizinhas: ["itapeva", "itapetininga"],
  },
  {
    slug: "itapetininga",
    nome: "Itapetininga",
    uf: "SP",
    lat: -23.59,
    lon: -48.05,
    regiao: "interior_sp",
    concessionaria: "CPFL Piratininga",
    destaques: ["indústria e logística na Castello Branco"],
    vizinhas: ["capao-bonito", "sorocaba", "tatui"],
  },
  {
    slug: "tatui",
    nome: "Tatuí",
    uf: "SP",
    lat: -23.35,
    lon: -47.86,
    regiao: "interior_sp",
    concessionaria: "CPFL Piratininga",
    destaques: ["indústria e serviços"],
    vizinhas: ["itapetininga", "sorocaba"],
  },
  {
    slug: "sorocaba",
    nome: "Sorocaba",
    uf: "SP",
    lat: -23.5,
    lon: -47.46,
    regiao: "interior_sp",
    concessionaria: "CPFL Piratininga",
    destaques: ["grande parque industrial e tecnológico"],
    vizinhas: ["tatui", "itapetininga", "botucatu"],
  },
  {
    slug: "avare",
    nome: "Avaré",
    uf: "SP",
    lat: -23.1,
    lon: -48.92,
    regiao: "interior_sp",
    concessionaria: "CPFL Paulista",
    destaques: ["turismo, comércio e agropecuária"],
    vizinhas: ["santa-cruz-do-rio-pardo", "botucatu"],
  },
  {
    slug: "botucatu",
    nome: "Botucatu",
    uf: "SP",
    lat: -22.89,
    lon: -48.44,
    regiao: "interior_sp",
    concessionaria: "CPFL Paulista",
    destaques: ["universidades, saúde e agro"],
    vizinhas: ["avare", "bauru", "sorocaba"],
  },
  {
    slug: "bauru",
    nome: "Bauru",
    uf: "SP",
    lat: -22.32,
    lon: -49.07,
    regiao: "interior_sp",
    concessionaria: "CPFL Paulista",
    destaques: ["polo regional de serviços e indústria"],
    vizinhas: ["botucatu", "marilia"],
  },
  {
    slug: "marilia",
    nome: "Marília",
    uf: "SP",
    lat: -22.21,
    lon: -49.95,
    regiao: "interior_sp",
    concessionaria: "CPFL Paulista",
    destaques: ["capital nacional do alimento"],
    vizinhas: ["bauru", "assis"],
  },
  {
    slug: "presidente-prudente",
    nome: "Presidente Prudente",
    uf: "SP",
    lat: -22.13,
    lon: -51.39,
    regiao: "interior_sp",
    concessionaria: "Energisa Sul-Sudeste",
    destaques: ["centro regional do oeste paulista"],
    vizinhas: ["marilia", "assis"],
  },

  // ——— Norte de Santa Catarina
  {
    slug: "joinville",
    nome: "Joinville",
    uf: "SC",
    lat: -26.3,
    lon: -48.85,
    regiao: "norte_sc",
    concessionaria: "Celesc",
    destaques: ["maior parque industrial de Santa Catarina"],
    vizinhas: ["jaragua-do-sul", "sao-bento-do-sul"],
  },
  {
    slug: "jaragua-do-sul",
    nome: "Jaraguá do Sul",
    uf: "SC",
    lat: -26.49,
    lon: -49.07,
    regiao: "norte_sc",
    concessionaria: "Celesc",
    destaques: ["metalmecânica e têxtil"],
    vizinhas: ["joinville", "sao-bento-do-sul"],
  },
  {
    slug: "sao-bento-do-sul",
    nome: "São Bento do Sul",
    uf: "SC",
    lat: -26.25,
    lon: -49.38,
    regiao: "norte_sc",
    concessionaria: "Celesc",
    destaques: ["polo moveleiro"],
    vizinhas: ["joinville", "jaragua-do-sul"],
  },
];

/** Distância em km entre dois pontos (Haversine). */
export function distanciaKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Base operacional mais próxima da cidade + distância em km. */
export function baseMaisProxima(c: Cidade): { base: Base; km: number } {
  let melhor = { base: BASES[0]!, km: Number.POSITIVE_INFINITY };
  for (const base of BASES) {
    const km = distanciaKm(c.lat, c.lon, base.lat, base.lon);
    if (km < melhor.km) melhor = { base, km };
  }
  return melhor;
}

export const CIDADES_POR_SLUG: Record<string, Cidade> = Object.fromEntries(
  CIDADES.map((c) => [c.slug, c]),
);

export function getCidade(slug: string): Cidade | undefined {
  return CIDADES_POR_SLUG[slug];
}

export function regiaoDe(c: Cidade): Regiao {
  return REGIOES[c.regiao] ?? REGIOES.norte_pr!;
}

/** Cidades agrupadas por UF, ordenadas por nome (usado no hub). */
export function cidadesPorEstado() {
  const grupos: Record<string, Cidade[]> = {};
  for (const c of [...CIDADES].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))) {
    (grupos[c.uf] ??= []).push(c);
  }
  return grupos;
}

export const UF_NOME: Record<string, string> = {
  PR: "Paraná",
  SP: "São Paulo",
  SC: "Santa Catarina",
  MS: "Mato Grosso do Sul",
};

/**
 * Estimativa transparente de geração/economia para a cidade, a partir da
 * irradiação regional. É estimativa, nunca proposta.
 */
export function estimativa(c: Cidade, contaMensal = 600) {
  const r = regiaoDe(c);
  const tarifa = 1.05; // R$/kWh médio na área de atuação
  const consumoKwh = Math.round(contaMensal / tarifa);
  const geracaoPorKwp = Math.round(r.irradiacao * 30 * 0.78); // kWh/mês por kWp
  const kwp = Math.max(1, Math.round((consumoKwh / geracaoPorKwp) * 10) / 10);
  const economiaMes = Math.round(contaMensal * 0.95);
  return { tarifa, consumoKwh, geracaoPorKwp, kwp, economiaMes, economiaAno: economiaMes * 12 };
}

/* ------------------------------------------------------------------ *
 * PRIORIZAÇÃO DE INDEXAÇÃO
 *
 * O Google engaveta páginas locais muito parecidas entre si ("Descoberta —
 * atualmente não indexada"). Por isso concentramos força em um grupo pequeno
 * de cidades com conteúdo próprio e escrito à mão. As demais continuam no ar
 * e linkadas (útil para o visitante), mas saem do sitemap e recebem
 * `noindex, follow` até que as prioritárias estejam indexadas.
 * ------------------------------------------------------------------ */

export const CIDADES_PRIORITARIAS = [
  "londrina",
  "wenceslau-braz",
  "ponta-grossa",
  "arapoti",
  "siqueira-campos",
  "ibaiti",
  "santo-antonio-da-platina",
  "castro",
  "jaguariaiva",
  "cornelio-procopio",
  "maringa",
  "apucarana",
  "arapongas",
  "cambe",
  "jacarezinho",
  "ourinhos",
  "assis",
  "itarare",
  "curitiba",
] as const;

const PRIORITARIAS_SET = new Set<string>(CIDADES_PRIORITARIAS);

export function isPrioritaria(slug: string): boolean {
  return PRIORITARIAS_SET.has(slug);
}

/** Cidades prioritárias, na ordem definida acima (usado em blocos de links internos). */
export function cidadesPrioritarias(): Cidade[] {
  return CIDADES_PRIORITARIAS.map((s) => CIDADES_POR_SLUG[s]).filter(Boolean) as Cidade[];
}

/**
 * Conteúdo editorial único por cidade prioritária. Nada de número inventado:
 * só geografia, bairros, vocação econômica e o modo como a LZ7 opera ali.
 */
export type PerfilLocal = {
  intro: string[];
  bairros: string[];
  bairrosLabel: string;
  consumo: string;
  logistica: string;
  faq: { q: string; a: string }[];
};

export const PERFIL_LOCAL: Record<string, PerfilLocal> = {
  londrina: {
    intro: [
      "Londrina é a cidade onde fica uma das nossas três bases — o escritório na Avenida Higienópolis, no Higienópolis, é ponto de saída das equipes que atendem toda a região metropolitana. Isso muda o jogo no pós-venda: visita técnica, ajuste de inversor ou troca de peça em garantia não dependem de deslocar time de outro estado.",
      "O parque imobiliário londrinense é bem variado, e o projeto muda conforme o telhado. Sobrados de Gleba Palhano e Aurora costumam ter laje ou telha de concreto, exigindo estrutura e fixação específicas. Casas de Cinco Conjuntos, Igapó e Jardim Bandeirantes normalmente têm telha cerâmica, onde a instalação é mais rápida. Já os galpões da zona norte e o comércio da Avenida Higienópolis pedem análise de padrão trifásico e demanda contratada.",
    ],
    bairros: [
      "Centro",
      "Gleba Palhano",
      "Higienópolis",
      "Aurora",
      "Igapó",
      "Cinco Conjuntos",
      "Jardim Bandeirantes",
      "Shangri-lá",
      "Heimtal",
      "Cambezinho",
    ],
    bairrosLabel: "Bairros e regiões que atendemos em Londrina",
    consumo:
      "Londrina concentra clínicas, escritórios, hotéis e comércio com consumo forte em horário comercial — perfil em que a energia gerada é usada na hora, sem depender de crédito. Nas residências, o gatilho costuma ser o ar-condicionado no verão e o chuveiro no inverno.",
    logistica:
      "Equipe própria saindo do escritório de Londrina, com atendimento no mesmo dia para vistorias e chamados urgentes dentro do município.",
    faq: [
      {
        q: "A LZ7 tem loja física em Londrina?",
        a: "Sim. Ficamos na Av. Higienópolis, 1600, Sala 5, Higienópolis, Londrina - PR. Você pode agendar uma visita, levar sua conta de luz e conversar pessoalmente com um engenheiro — telefone (43) 99976-0685.",
      },
      {
        q: "Quanto tempo leva a homologação da Copel em Londrina?",
        a: "Depois de protocolado o projeto, a Copel tem prazos regulados para parecer de acesso e vistoria. Em Londrina, por ser área urbana consolidada e com atendimento regional, o processo costuma correr sem exigência de obra na rede. Nós acompanhamos cada etapa até a troca do medidor.",
      },
    ],
  },
  "ponta-grossa": {
    intro: [
      "Ponta Grossa é nossa base nos Campos Gerais — ficamos na Avenida Visconde de Taunay, no Contorno. É de lá que saem as equipes que cobrem Castro, Carambeí, Palmeira, Telêmaco Borba e Jaguariaíva.",
      "O clima da cidade engana muita gente: como Ponta Grossa tem mais dias nublados e frios que o norte do estado, é comum ouvir que 'aqui solar não vale a pena'. Na prática, o painel produz mais em temperatura amena do que em calor extremo, e o dimensionamento já considera a média anual da região. O que muda é o tamanho do sistema, não a viabilidade.",
    ],
    bairros: [
      "Centro",
      "Uvaranas",
      "Órfãs",
      "Jardim Carvalho",
      "Oficinas",
      "Contorno",
      "Nova Rússia",
      "Colônia Dona Luiza",
      "Chapada",
      "Boa Vista",
    ],
    bairrosLabel: "Bairros e regiões que atendemos em Ponta Grossa",
    consumo:
      "A cidade tem o maior parque industrial do interior paranaense: alimentos, papel, embalagens e logística. Indústria e centro de distribuição consomem em turno diurno e têm telhado de galpão sobrando — a combinação mais rentável para geração própria. No residencial, o inverno rigoroso puxa o chuveiro e o aquecimento.",
    logistica:
      "Base própria em Ponta Grossa, com equipes de instalação e assistência técnica dedicadas aos Campos Gerais.",
    faq: [
      {
        q: "Onde fica a LZ7 em Ponta Grossa?",
        a: "Av. Visconde de Taunay, 1249, Contorno, Ponta Grossa - PR. Atendimento pelo (42) 99831-6027, com agendamento de visita técnica no imóvel.",
      },
      {
        q: "Geada e frio danificam os painéis em Ponta Grossa?",
        a: "Não. Os módulos são testados para carga de neve e granizo e trabalham bem em temperatura baixa — o frio inclusive melhora a eficiência elétrica das células. O cuidado maior é com a estrutura de fixação, dimensionada aqui para o vento típico dos Campos Gerais.",
      },
    ],
  },
  "wenceslau-braz": {
    intro: [
      "Wenceslau Braz é onde a LZ7 nasceu. Nossa sede fica na Rua Augusto Paschoal da Silva, 1182, e é a base que atende todo o Norte Pioneiro — Siqueira Campos, Santo Antônio da Platina, Arapoti, Jacarezinho e o entorno rural.",
      "Aqui boa parte dos projetos é rural ou de comércio de rua, não condomínio. Isso muda o roteiro: padrão de entrada muitas vezes é monofásico ou bifásico antigo, a rede é longa e a queda de tensão precisa entrar na conta. Fazemos a leitura do padrão junto com a Copel antes de fechar o projeto, para o cliente não ser surpreendido com exigência de adequação depois.",
    ],
    bairros: [
      "Centro",
      "Vila Nova",
      "Jardim Bandeirantes",
      "Vila Aparecida",
      "zona rural do município",
    ],
    bairrosLabel: "Regiões que atendemos em Wenceslau Braz",
    consumo:
      "Propriedades rurais com irrigação, ordenha, resfriador de leite e secador; comércio de rua e prestadores de serviço no centro. São consumos diurnos, que casam quase perfeitamente com a curva de geração solar.",
    logistica:
      "Sede da LZ7 Energia. Estoque, equipe técnica e suporte no mesmo município — o menor tempo de resposta de toda a nossa área de atuação.",
    faq: [
      {
        q: "Qual o endereço da LZ7 em Wenceslau Braz?",
        a: "Rua Augusto Paschoal da Silva, 1182, Wenceslau Braz - PR, CEP 84950-000. Telefone (43) 99907-4583.",
      },
      {
        q: "Vocês fazem projeto para propriedade rural na região?",
        a: "Sim, é boa parte do que fazemos aqui. Avaliamos o padrão de entrada, a distância do transformador, a estrutura do barracão e a sazonalidade do consumo (safra, irrigação, ordenha) antes de dimensionar o sistema.",
      },
    ],
  },
  maringa: {
    intro: [
      "Maringá é atendida pela equipe que sai da base de Londrina. É uma cidade planejada, com muita construção nova e padrão elevado de acabamento — e isso aparece no projeto: o cliente maringaense costuma cobrar instalação limpa, cabeamento escondido e módulo alinhado, não só o número da economia.",
      "A verticalização também cria uma demanda específica: geração compartilhada e sistemas em área comum de condomínio, para abater a conta de elevador, bomba e iluminação. Nesses casos o estudo passa por análise de titularidade da unidade consumidora junto à Copel.",
    ],
    bairros: [
      "Zona 7",
      "Zona Nova",
      "Jardim Alvorada",
      "Novo Centro",
      "Parque das Grevíleas",
      "Vila Esperança",
      "Jardim Diamante",
      "Conjunto Requião",
    ],
    bairrosLabel: "Bairros que atendemos em Maringá",
    consumo:
      "Serviços, saúde, franquias e agronegócio administrativo. Muito consumo comercial diurno e residencial de alto padrão com ar-condicionado, piscina aquecida e carro elétrico.",
    logistica:
      "Atendimento pela equipe da base de Londrina, com visita técnica agendada e obra executada por time próprio.",
    faq: [
      {
        q: "Dá para instalar energia solar em apartamento em Maringá?",
        a: "Na unidade individual, raramente — não há telhado próprio. O caminho é o sistema na área comum do condomínio, que abate a taxa condominial, ou a geração compartilhada, em que o sistema fica em outro imóvel e os créditos são rateados entre unidades consumidoras do mesmo titular ou consórcio.",
      },
    ],
  },
  apucarana: {
    intro: [
      "Apucarana é a Capital Nacional do Boné, e o perfil industrial da cidade define os projetos que fazemos ali: confecção, bordado e estamparia rodam máquinas o dia inteiro, com consumo alto e constante em horário comercial.",
      "Outro detalhe local é o relevo. Apucarana é uma das cidades mais altas do Paraná, com telhados em cotas bem diferentes e sombreamento cruzado entre construções vizinhas. Fazemos análise de sombra antes da proposta para evitar a perda silenciosa de geração no fim da tarde.",
    ],
    bairros: [
      "Centro",
      "Jardim Ponta Grossa",
      "Núcleo Habitacional João Paulo II",
      "Vila Nova",
      "Jardim Colonial",
      "Vila Regina",
      "Jardim Interlagos",
    ],
    bairrosLabel: "Bairros que atendemos em Apucarana",
    consumo:
      "Confecção, indústria têxtil leve, comércio e serviços. Máquina ligada em horário comercial é o cenário em que a energia solar rende mais, porque quase tudo o que se gera é consumido na hora.",
    logistica:
      "Equipe da base de Londrina, com deslocamento curto e assistência técnica na mesma rota de Arapongas e Rolândia.",
    faq: [
      {
        q: "Energia solar serve para uma fábrica de confecção em Apucarana?",
        a: "Sim, e costuma ser o melhor caso. O consumo é diurno e previsível, o telhado do barracão é amplo, e a economia entra direto no custo por peça produzida. O dimensionamento usa a demanda contratada e o histórico de 12 meses, não uma média genérica.",
      },
    ],
  },
  arapongas: {
    intro: [
      "Arapongas é a Capital Nacional do Móvel, e isso significa dezenas de barracões com cobertura metálica de área generosa — o cenário mais favorável que existe para geração solar, porque cabe potência sem brigar por espaço.",
      "O ponto de atenção nesses telhados é estrutural: telha trapezoidal antiga, terça com vão longo e cobertura já carregada de exaustores. Nossa visita técnica avalia a estrutura antes do projeto e, quando necessário, indicamos reforço ou distribuição diferente dos módulos.",
    ],
    bairros: [
      "Centro",
      "Jardim Petrópolis",
      "Vila Industrial",
      "Jardim Bandeirantes",
      "Conjunto Flamingos",
      "Jardim Panorama",
    ],
    bairrosLabel: "Bairros e distritos industriais que atendemos em Arapongas",
    consumo:
      "Indústria moveleira, marcenarias, serralherias e logística. Motor elétrico e sistema de exaustão puxando carga o dia inteiro, com pico no meio da manhã e no meio da tarde.",
    logistica: "Atendida pela equipe da base de Londrina, na mesma rota de Rolândia e Apucarana.",
    faq: [
      {
        q: "Meu barracão em Arapongas aguenta o peso dos painéis?",
        a: "Na maioria dos casos sim — um sistema moderno acrescenta cerca de 12 a 15 kg por metro quadrado. Mesmo assim, avaliamos terças, vão e estado da cobertura na visita técnica, e não fechamos projeto em estrutura comprometida sem indicar o reforço necessário.",
      },
    ],
  },
  cambe: {
    intro: [
      "Cambé cresceu colada em Londrina e virou destino de quem quer casa térrea com quintal a poucos minutos do centro londrinense. É por isso que a maior parte dos projetos aqui é residencial, em telhado cerâmico, com sistema entre 4 e 8 kWp.",
      "A cidade também tem um eixo industrial e logístico na BR-369, com galpões que operam em turno diurno. São dois perfis bem distintos e dimensionamentos completamente diferentes — o que não muda é a equipe: a mesma que atende Londrina.",
    ],
    bairros: [
      "Centro",
      "Jardim Ana Rosa",
      "Jardim Silvino",
      "Parque Residencial Alvorada",
      "Jardim Nova Cambé",
      "Jardim Bandeirantes",
    ],
    bairrosLabel: "Bairros que atendemos em Cambé",
    consumo:
      "Residências de família com pico à noite (chuveiro, ar-condicionado, forno) e indústria/logística na BR-369 com consumo diurno.",
    logistica:
      "Deslocamento curto a partir do escritório de Londrina — instalação e assistência normalmente no mesmo dia do agendamento.",
    faq: [
      {
        q: "Se eu gasto energia à noite em Cambé, a solar compensa?",
        a: "Compensa. O que sobra durante o dia vira crédito na Copel e abate o consumo noturno na fatura seguinte, com validade de 60 meses. O sistema é dimensionado pelo seu consumo total do mês, não pelo horário em que você usa.",
      },
    ],
  },
  jacarezinho: {
    intro: [
      "Jacarezinho é atendida pela base de Wenceslau Braz e concentra um perfil misto: universidade, comércio de rua, serviços públicos e um cinturão de cana e agropecuária no entorno.",
      "É comum encontrarmos na cidade imóveis antigos com padrão de entrada desatualizado. Antes de qualquer proposta verificamos disjuntor, ramal e aterramento — sistema homologado exige padrão em conformidade, e é melhor descobrir isso no orçamento do que na vistoria da Copel.",
    ],
    bairros: [
      "Centro",
      "Vila Setti",
      "Jardim Panorama",
      "Vila São Pedro",
      "Aparecidinha",
      "zona rural do município",
    ],
    bairrosLabel: "Regiões que atendemos em Jacarezinho",
    consumo:
      "Comércio, clínicas, escolas e propriedades rurais. Consumo predominantemente diurno, com sazonalidade forte no agro durante a safra.",
    logistica:
      "Equipe da base de Wenceslau Braz, que cobre todo o Norte Pioneiro com assistência técnica presencial.",
    faq: [
      {
        q: "Preciso trocar o padrão de entrada para instalar solar em Jacarezinho?",
        a: "Depende do estado do padrão atual. Se o disjuntor, o ramal e o aterramento estiverem dentro da norma da Copel, não. Quando há necessidade de adequação, informamos o custo no orçamento, antes da assinatura — nunca depois.",
      },
    ],
  },
  ourinhos: {
    intro: [
      "Ourinhos é a nossa porta de entrada no sudoeste paulista e tem uma diferença importante em relação às cidades paranaenses: a distribuidora é a CPFL Santa Cruz, com processo de homologação, formulários e prazos próprios. Nossa equipe já opera nesse fluxo — o cliente não precisa aprender nada disso.",
      "A cidade é entroncamento rodoferroviário e concentra transportadoras, agroindústria e comércio regional. Também é uma das regiões com melhor irradiação da nossa área de atuação, o que costuma reduzir o tamanho do sistema necessário para a mesma economia.",
    ],
    bairros: [
      "Centro",
      "Vila Odilon",
      "Jardim Paulista",
      "Vila Perino",
      "Jardim Matilde",
      "Vila Sandano",
    ],
    bairrosLabel: "Bairros que atendemos em Ourinhos",
    consumo:
      "Transporte e logística, agroindústria, comércio e serviços — carga concentrada no horário comercial e boa área de cobertura disponível.",
    logistica:
      "Atendida a partir das bases de Wenceslau Braz e Londrina, com equipe própria e sem subcontratação.",
    faq: [
      {
        q: "Quem faz a homologação na CPFL Santa Cruz em Ourinhos?",
        a: "Nós. Projeto elétrico, ART, protocolo no portal da CPFL Santa Cruz, resposta a eventuais exigências, acompanhamento da vistoria e troca do medidor bidirecional fazem parte do serviço.",
      },
    ],
  },
  curitiba: {
    intro: [
      "Curitiba é o caso em que mais precisamos desfazer mito. A capital tem mais dias nublados que o norte do estado, e a conclusão apressada é que solar não compensa aqui. Compensa: a tarifa da Copel é a mesma do restante do estado, o consumo urbano é estável o ano inteiro e o sistema é dimensionado pela média anual de irradiação, já descontando os meses fechados.",
      "O que realmente pesa em Curitiba é o telhado. Casa em terreno estreito, sobrado geminado, telhado com muitas águas e sombreamento de prédio vizinho exigem estudo de sombra sério e, às vezes, microinversor ou otimizador por módulo em vez de string única. É a diferença entre um sistema que entrega o previsto e um que decepciona no relatório de geração.",
    ],
    bairros: [
      "Batel",
      "Água Verde",
      "Portão",
      "Santa Felicidade",
      "Cabral",
      "Boa Vista",
      "Bacacheri",
      "Pinheirinho",
      "Campo Comprido",
      "Uberaba",
    ],
    bairrosLabel: "Bairros que atendemos em Curitiba",
    consumo:
      "Residências com aquecimento elétrico no inverno, clínicas, escritórios, restaurantes e pequenas indústrias. Consumo constante o ano todo, sem a sazonalidade agrícola do interior.",
    logistica: "Atendimento a partir da base de Ponta Grossa, que fica na rota direta pela BR-376.",
    faq: [
      {
        q: "Vale a pena energia solar em Curitiba, mesmo com tanto dia nublado?",
        a: "Vale. A irradiação média da região metropolitana é menor que a do norte do Paraná, mas continua acima da média da Alemanha, um dos países com mais energia solar instalada do mundo. O projeto simplesmente prevê alguns módulos a mais para chegar à mesma economia.",
      },
      {
        q: "Sombra de prédio vizinho inviabiliza o sistema?",
        a: "Nem sempre. Fazemos estudo de sombreamento e, quando há sombra parcial em parte do dia, usamos microinversores ou otimizadores para que um módulo sombreado não derrube a produção dos demais.",
      },
    ],
  },
  arapoti: {
    intro: [
      "Arapoti é um dos maiores polos do agronegócio e da bacia leiteira do Paraná, sede da Cooperativa Capal e referência em produção tecnificada de leite, suinocultura, avicultura e grãos (soja, milho e trigo).",
      "Nas propriedades rurais de Arapoti, o consumo de energia é pesado e ininterrupto: resfriadores de leite a granel, sistemas de ordenha mecânica, ventiladores em galpões de confinamento (Compost Barn / Free Stall) e bombas de água rodam quase 24h por dia. A usina solar fotovoltaica se tornou o investimento mais rentável do produtor rural em Arapoti, transformando a conta de luz da Copel em margem limpa no leite e na safra.",
      "Outro ponto forte na cidade são os galpões de armazenagem e comércio na área urbana e ao longo da PR-092, onde telhados de estrutura metálica ampla comportam sistemas de alta potência com instalação ágil.",
    ],
    bairros: [
      "Centro",
      "Jardim Ceres",
      "Vila Romana",
      "Alphaville",
      "Linha Capal",
      "Distrito de Calógeras",
      "Colônia Holandesa",
      "zona rural do município",
    ],
    bairrosLabel: "Bairros, colônias e distritos atendidos em Arapoti",
    consumo:
      "Propriedades leiteiras, granjas, secadores e armazenagem da Capal, além de comércio e residências urbanas. O consumo no campo é fortemente diurno com picos durante a ordenha da manhã e da tarde, casando com a geração máxima dos painéis.",
    logistica:
      "Atendimento direto e prioritário pelas bases de Wenceslau Braz e Ponta Grossa. Técnicos próprios e engenharia na região com assistência presencial rápida.",
    faq: [
      {
        q: "Como a energia solar ajuda produtores de leite em Arapoti?",
        a: "A refrigeração do leite e a ordenha mecânica representam uma das maiores despesas da atividade leiteira. Com a usina solar da LZ7, o produtor zera até 95% do custo da energia elétrica na fatura rural da Copel, pagando o financiamento com a própria economia mensal.",
      },
      {
        q: "Posso instalar no barracão da fazenda e abater a conta da casa na cidade em Arapoti?",
        a: "Sim! Por meio do autoconsumo remoto na Copel, uma usina solar instalada no telhado do barracão na zona rural pode abater a conta de luz da sua residência ou comércio na cidade de Arapoti, desde que estejam sob o mesmo CPF ou CNPJ.",
      },
      {
        q: "A estrutura dos barracões rurais suporta os painéis solares?",
        a: "Nossos engenheiros realizam vistoria técnica presencial em Arapoti para checar terças, tesouras e coberturas (telha de zinco, fibrocimento ou aluzinco), garantindo fixação com estanqueidade total e sem sobrecarga estrutural.",
      },
    ],
  },
  "siqueira-campos": {
    intro: [
      "Siqueira Campos é um dos maiores motores industriais e comerciais do Norte Pioneiro, polo fabril de renome nacional em motopeças, confecções e calçados (sede de marcas líderes como Pro Tork), além de forte polo agropecuário e de turismo religioso no Santuário Bom Jesus da Cana Verde.",
      "A indústria e o comércio de Siqueira Campos operam em ritmo acelerado em horário comercial, com maquinário, prensas, costura industrial, compressores e climatização consumindo eletricidade no momento de pico de radiação solar. Isso gera o melhor retorno possível de payback, pois a energia é consumida instantaneamente no próprio imóvel.",
      "Para residências de famílias em bairros como Jardim Alvorada e Boa Vista, a energia solar elimina o susto das contas de verão provocadas pelo ar-condicionado.",
    ],
    bairros: [
      "Centro",
      "Jardim Alvorada",
      "Residencial Boa Vista",
      "Vila Operária",
      "Vila Nascente",
      "Distrito de Aleixo",
      "zona rural e polos industriais",
    ],
    bairrosLabel: "Bairros e polos que atendemos em Siqueira Campos",
    consumo:
      "Indústrias de calçados e autopeças, comércio de rua, supermercados, turismo religioso e residências. Consumo concentrado em dias úteis com alto fator de carga diurno.",
    logistica:
      "Distância de apenas 15 minutos da nossa base central de Wenceslau Braz. Instalação com equipe própria e suporte técnico presencial imediato.",
    faq: [
      {
        q: "Qual a vantagem de instalar energia solar em fábricas e confecções em Siqueira Campos?",
        a: "O consumo industrial acontece exatamente quando o sol está brilhando. Isso reduz a demanda de ponta e fora de ponta na Copel e melhora a margem de lucro por produto fabricado, com retorno do investimento de 3 a 4 anos.",
      },
      {
        q: "A proximidade da base LZ7 em Wenceslau Braz ajuda no suporte?",
        a: "Totalmente. Siqueira Campos é cidade vizinha da nossa sede: nossa equipe técnica de instalação e assistência está a minutos de distância para vistorias, manutenções preventivas e homologações da Copel.",
      },
    ],
  },
  ibaiti: {
    intro: [
      "Conhecida como a 'Rainha das Colinas', Ibaiti é o principal polo comercial, de serviços, saúde e bancário de toda a microrregião central do Norte Pioneiro, com forte tradição na pecuária, cafeicultura e agricultura de grãos.",
      "Por conta da sua topografia em colinas e relevo característico, o dimensionamento solar em Ibaiti exige estudo topográfico minucioso e cálculo de inclinação/orientação magnética para telhados e terrenos, garantindo captação máxima de radiação e zero perda por sombreamento de morros vizinhos.",
      "Supermercados, clínicas, padarias, farmácias e residências em Ibaiti encontram na energia solar a proteção definitiva contra os constantes reajustes da Copel.",
    ],
    bairros: [
      "Centro",
      "Serra Dourada",
      "Jardim Pérola",
      "Vila Santo Antônio",
      "Cohab",
      "Distrito de Vassoural",
      "Distrito de Campinhos",
      "zona rural",
    ],
    bairrosLabel: "Bairros e distritos atendidos em Ibaiti",
    consumo:
      "Comércio varejista, centros de diagnóstico, postos de combustível, propriedades cafeeiras e residências. Uso elevado de refrigeração e ar-condicionado no centro urbano.",
    logistica:
      "Atendida pela equipe própria da base de Wenceslau Braz pela BR-153, com equipe de engenharia dedicada ao atendimento presencial.",
    faq: [
      {
        q: "O relevo montanhoso de Ibaiti prejudica a geração de energia solar?",
        a: "Não, desde que o projeto seja feito com engenharia especializada. Nossa equipe analisa a inclinação e a orientação solar (azimute) do seu telhado em Ibaiti na visita técnica para posicionar os painéis no melhor ângulo de rendimento.",
      },
      {
        q: "Posso instalar usina solar em chácara ou sítio na zona rural de Ibaiti?",
        a: "Sim. Projetamos tanto usinas em telhado de barracão quanto usinas instaladas em solo com estruturas galvanizadas de alta durabilidade para sítios, granjas e propriedades de gado/café.",
      },
    ],
  },
  "santo-antonio-da-platina": {
    intro: [
      "Santo Antônio da Platina é a capital comercial e de serviços do Norte Pioneiro, abrigando centros médicos de referência regional, hospitais, faculdades, concessionárias de veículos e um comércio de rua pulsante.",
      "Com alta irradiação solar característica do vale do Rio das Cinzas e temperaturas elevadas no verão, o gasto com ar-condicionado, câmaras de congelamento e iluminação comercial em Santo Antônio da Platina é expressivo. A energia solar LZ7 neutraliza esse custo fixo.",
      "Atendemos desde sobrados em bairros residenciais consolidados como Jardim Bela Vista e Jardim Platina até complexos de saúde e barracões industriais ao longo da BR-153 e PR-092.",
    ],
    bairros: [
      "Centro",
      "Jardim Bela Vista",
      "Jardim Platina",
      "Vila Santa Terezinha",
      "Conjunto Colorado",
      "Aparecídio de Paula",
      "Vila São José",
      "zona rural",
    ],
    bairrosLabel: "Bairros e regiões atendidas em Santo Antônio da Platina",
    consumo:
      "Hospitais, clínicas odontológicas e médicas, atacarejos, agronegócio e residências de médio/alto padrão com consumo diurno contínuo.",
    logistica:
      "Equipe própria da base de Wenceslau Braz, com deslocamento diário e fácil acesso via PR-092 e BR-153.",
    faq: [
      {
        q: "Quanto uma clínica ou comércio em Santo Antônio da Platina economiza com solar?",
        a: "Uma empresa que gasta R$ 3.000 a R$ 8.000 por mês na Copel consegue reduzir a conta para a taxa básica, gerando uma economia de mais de R$ 35.000 a R$ 90.000 por ano direto no fluxo de caixa.",
      },
      {
        q: "A Copel em Santo Antônio da Platina homologa o projeto rápido?",
        a: "A equipe de engenharia da LZ7 protocola todos os projetos eletronicamente no sistema da Copel com ART do CREA-PR, acompanhando as vistorias até a instalação do relógio bidirecional.",
      },
    ],
  },
  castro: {
    intro: [
      "Castro ostenta com orgulho o título de Capital Nacional do Leite e coração da Cooperativa Castrolanda, sendo um dos polos agrícolas mais ricos, tecnificados e produtivos de toda a América Latina.",
      "O produtor de Castro é altamente exigente com tecnologia e eficiência: robôs de ordenha, resfriadores contínuos, sistemas de ventilação túnel em granjas e silos exigem confiabilidade absoluta. Os projetos solares da LZ7 em Castro utilizam módulos de ultra eficiência Tier 1 e inversores industriais com monitoramento em tempo real pelo celular.",
      "Na área urbana e em colônias como Castrolanda, atendemos residências de alto padrão e comércios locais que buscam independência energética e valorização patrimonial.",
    ],
    bairros: [
      "Centro",
      "Colônia Castrolanda",
      "Jardim Alvorada",
      "Vila Rio Branco",
      "Jardim Primavera",
      "Distrito de Socavão",
      "Distrito de Abapã",
      "zona rural do município",
    ],
    bairrosLabel: "Bairros, colônias e distritos atendidos em Castro",
    consumo:
      "Grandes produtores de leite da Castrolanda, granjas de aves e suínos, silos de grãos, indústrias de laticínios e residências. Demanda elétrica contínua 365 dias por ano.",
    logistica:
      "Atendida diretamente pela base de Ponta Grossa (apenas 35 km pela PR-151), garantindo resposta rápida e equipe própria.",
    faq: [
      {
        q: "Como a usina solar da LZ7 suporta a alta demanda dos robôs de ordenha em Castro?",
        a: "Dimensionamos sistemas trifásicos de alta performance que garantem estabilidade de tensão e geram energia limpa para toda a bateria de ordenha robotizada e resfriadores de leite, com opções de integração com gerador e sistemas híbridos.",
      },
      {
        q: "A LZ7 faz projetos solares em solo para propriedades rurais em Castro?",
        a: "Sim. Em propriedades onde o telhado não é suficiente ou possui orientação desfavorável, montamos usinas de solo com estruturas em aço zincado a fogo e cercamento técnico de segurança.",
      },
    ],
  },
  jaguariaiva: {
    intro: [
      "Jaguariaíva é um dos grandes polos florestais, de papel, celulose e madeira dos Campos Gerais, além de possuir um comércio em franca expansão e turismo ecológico mundialmente famoso no Parque Estadual do Cerrado e Cânion do Rio Jaguariaíva.",
      "A cidade possui telhados amplos em serrarias, madeireiras, oficinas e galpões de transporte, ideais para sistemas fotovoltaicos de médio e grande porte que abatem tarifas comerciais e industriais.",
      "No residencial, bairros como Cidade Alta e Primavera encontram na energia solar a saída perfeita para aquecimento de chuveiros e ar-condicionado.",
    ],
    bairros: [
      "Centro",
      "Cidade Alta",
      "Vila Kennedy",
      "Jardim Primavera",
      "Vila Minas Gerais",
      "Distrito Samambaia",
      "zona rural e polos industriais",
    ],
    bairrosLabel: "Bairros e regiões atendidas em Jaguariaíva",
    consumo:
      "Indústrias madeireiras, serrarias, papel, comércio e propriedades rurais. Carga constante em turno diurno e residencial urbano.",
    logistica:
      "Atendimento compartilhado pelas bases de Wenceslau Braz e Ponta Grossa pela PR-151.",
    faq: [
      {
        q: "Os painéis solares resistem às tempestades e ventos em Jaguariaíva?",
        a: "Sim. Todos os módulos solares e perfis de fixação de alumínio e aço inox utilizados pela LZ7 são certificados pelo Inmetro e testados contra ventos fortes e granizo de até 80 km/h.",
      },
    ],
  },
  "cornelio-procopio": {
    intro: [
      "Cornélio Procópio é o principal polo educacional e universitário do Norte do Paraná, abrigando campi da UTFPR e UENP, além de um comércio vibrante e grande polo de produção de grãos e cooperativas.",
      "A região de Cornélio Procópio tem uma das mais altas taxas de irradiação solar de todo o Paraná (média de 5.0 kWh/m²/dia), garantindo uma taxa de geração excepcional por placa instalada e payback acelerado em residências de estudantes, clínicas, hotéis e restaurantes.",
    ],
    bairros: [
      "Centro",
      "Jardim Panorama",
      "Vila Independência",
      "Vila Nova",
      "Conjunto Vitor Dantas",
      "Jardim Progresso",
      "zona rural",
    ],
    bairrosLabel: "Bairros que atendemos em Cornélio Procópio",
    consumo:
      "Comércio, clínicas, repúblicas e residências com ar-condicionado no clima quente do Norte, além de empresas de serviços e agronegócio.",
    logistica: "Atendimento pelas equipes das bases de Londrina e Wenceslau Braz pela BR-369.",
    faq: [
      {
        q: "Por que o retorno de energia solar em Cornélio Procópio é tão rápido?",
        a: "A irradiação solar em Cornélio Procópio é uma das maiores do estado. Cada quilowatt instalado gera mais quilowatts-hora por ano, acelerando a quitação do sistema para menos de 3 anos e meio.",
      },
    ],
  },
  itarare: {
    intro: [
      "Itararé é cidade histórica na divisa de São Paulo com o Paraná, importante polo agrícola de bataticultura, grãos e reflorestamento, além de centro comercial fronteiriço.",
      "A concessionária local em Itararé é a CPFL Santa Cruz / Elektro. Nossa equipe de engenharia cuida de todo o trâmite junto à distribuidora paulista, aplicando as normas de acesso e homologação sem qualquer complicação para o cliente.",
    ],
    bairros: [
      "Centro",
      "Vila Novo Horizonte",
      "Jardim Paulisteano",
      "Vila Tonico Adolfo",
      "Distrito de Pedra Branca",
      "zona rural",
    ],
    bairrosLabel: "Bairros e regiões atendidas em Itararé",
    consumo: "Agricultura irrigada, bataticultura, lavadores de batata, comércio e residências.",
    logistica:
      "Atendimento direto a partir da base de Wenceslau Braz (fronteira vizinha) com equipe própria.",
    faq: [
      {
        q: "Como funciona a homologação solar na CPFL Santa Cruz em Itararé?",
        a: "A LZ7 elabora o projeto técnico, emite ART e protocola tudo no portal de projetos da CPFL, acompanhando a vistoria e troca do medidor.",
      },
    ],
  },
  assis: {
    intro: [
      "Assis é polo universitário, médico e comercial do Vale do Paranapanema, com clima quente e alta incidência solar durante o ano inteiro.",
      "O uso contínuo de ar-condicionado em residências, consultórios, faculdades e empresas faz com que a conta de luz pese no orçamento mensal. A energia solar é a solução definitiva com payback rápido.",
    ],
    bairros: [
      "Centro",
      "Vila Xavier",
      "Jardim Paraná",
      "Vila Ribeiro",
      "Jardim Europa",
      "Vila Operária",
      "zona rural",
    ],
    bairrosLabel: "Bairros que atendemos em Assis",
    consumo:
      "Comércio diurno, clínicas, escritórios, usinas sucroalcooleiras e residências familiares com alto consumo de refrigeração.",
    logistica: "Atendida pelas bases de Londrina e Wenceslau Braz com visita técnica presencial.",
    faq: [
      {
        q: "Vale a pena energia solar em Assis - SP?",
        a: "Muito! O Vale do Paranapanema possui uma das mais altas médias de insolação do estado de SP (5.1 kWh/m²/dia), resultando em geração abundante todos os meses.",
      },
    ],
  },
};

export function perfilDe(c: Cidade): PerfilLocal | undefined {
  return PERFIL_LOCAL[c.slug];
}
