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
  { slug: "londrina", nome: "LZ7 Energia Londrina", cidade: "Londrina", uf: "PR", lat: -23.31, lon: -51.16 },
  { slug: "ponta-grossa", nome: "LZ7 Energia Ponta Grossa", cidade: "Ponta Grossa", uf: "PR", lat: -25.09, lon: -50.16 },
  { slug: "wenceslau-braz", nome: "LZ7 Energia Wenceslau Braz", cidade: "Wenceslau Braz", uf: "PR", lat: -23.87, lon: -49.8 },
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
    descricao: "Polos de agroindústria e comércio regional, com demanda crescente por geração própria.",
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
    descricao: "Alta irradiação e tarifas elevadas — combinação que costuma acelerar o retorno do investimento.",
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
  { slug: "londrina", nome: "Londrina", uf: "PR", lat: -23.31, lon: -51.16, regiao: "norte_pr", concessionaria: "Copel", destaques: ["segundo maior município do Paraná", "forte setor de serviços, saúde e agro"], vizinhas: ["cambe", "rolandia", "arapongas", "ibipora"] },
  { slug: "cambe", nome: "Cambé", uf: "PR", lat: -23.28, lon: -51.28, regiao: "norte_pr", concessionaria: "Copel", destaques: ["polo industrial e logístico", "loteamentos residenciais em expansão"], vizinhas: ["londrina", "rolandia", "ibipora"] },
  { slug: "rolandia", nome: "Rolândia", uf: "PR", lat: -23.31, lon: -51.37, regiao: "norte_pr", concessionaria: "Copel", destaques: ["indústria de alimentos e metalmecânica"], vizinhas: ["cambe", "arapongas", "londrina"] },
  { slug: "arapongas", nome: "Arapongas", uf: "PR", lat: -23.42, lon: -51.42, regiao: "norte_pr", concessionaria: "Copel", destaques: ["capital nacional do móvel", "galpões industriais com grandes telhados"], vizinhas: ["rolandia", "apucarana", "londrina"] },
  { slug: "apucarana", nome: "Apucarana", uf: "PR", lat: -23.55, lon: -51.46, regiao: "norte_pr", concessionaria: "Copel", destaques: ["polo de bonés e confecção", "indústria têxtil"], vizinhas: ["arapongas", "maringa", "londrina"] },
  { slug: "ibipora", nome: "Ibiporã", uf: "PR", lat: -23.27, lon: -51.05, regiao: "norte_pr", concessionaria: "Copel", destaques: ["agroindústria e cooperativas"], vizinhas: ["londrina", "cambe", "jataizinho"] },
  { slug: "jataizinho", nome: "Jataizinho", uf: "PR", lat: -23.26, lon: -50.98, regiao: "norte_pr", concessionaria: "Copel", destaques: ["propriedades rurais e pequenos comércios"], vizinhas: ["ibipora", "cornelio-procopio", "londrina"] },
  { slug: "maringa", nome: "Maringá", uf: "PR", lat: -23.42, lon: -51.94, regiao: "norte_pr", concessionaria: "Copel", destaques: ["centro econômico do noroeste paranaense", "serviços, saúde e agronegócio"], vizinhas: ["sarandi", "marialva", "apucarana"] },
  { slug: "sarandi", nome: "Sarandi", uf: "PR", lat: -23.44, lon: -51.87, regiao: "norte_pr", concessionaria: "Copel", destaques: ["forte adensamento residencial"], vizinhas: ["maringa", "marialva"] },
  { slug: "marialva", nome: "Marialva", uf: "PR", lat: -23.48, lon: -51.79, regiao: "norte_pr", concessionaria: "Copel", destaques: ["capital da uva fina", "irrigação e estufas"], vizinhas: ["maringa", "sarandi", "apucarana"] },
  { slug: "astorga", nome: "Astorga", uf: "PR", lat: -23.23, lon: -51.66, regiao: "norte_pr", concessionaria: "Copel", destaques: ["cafeicultura e grãos"], vizinhas: ["maringa", "londrina"] },
  { slug: "porecatu", nome: "Porecatu", uf: "PR", lat: -22.75, lon: -51.38, regiao: "norte_pr", concessionaria: "Copel", destaques: ["usinas de cana e agricultura irrigada"], vizinhas: ["londrina", "sertanopolis"] },
  { slug: "sertanopolis", nome: "Sertanópolis", uf: "PR", lat: -23.06, lon: -51.04, regiao: "norte_pr", concessionaria: "Copel", destaques: ["grãos e avicultura"], vizinhas: ["londrina", "bela-vista-do-paraiso"] },
  { slug: "bela-vista-do-paraiso", nome: "Bela Vista do Paraíso", uf: "PR", lat: -22.99, lon: -51.19, regiao: "norte_pr", concessionaria: "Copel", destaques: ["produção agrícola familiar"], vizinhas: ["londrina", "sertanopolis"] },

  // ——— Norte Pioneiro
  { slug: "wenceslau-braz", nome: "Wenceslau Braz", uf: "PR", lat: -23.87, lon: -49.8, regiao: "norte_pioneiro", concessionaria: "Copel", destaques: ["comércio regional", "propriedades rurais no entorno"], vizinhas: ["siqueira-campos", "arapoti", "jacarezinho"] },
  { slug: "siqueira-campos", nome: "Siqueira Campos", uf: "PR", lat: -23.69, lon: -49.83, regiao: "norte_pioneiro", concessionaria: "Copel", destaques: ["agricultura familiar e comércio local"], vizinhas: ["wenceslau-braz", "jacarezinho"] },
  { slug: "jacarezinho", nome: "Jacarezinho", uf: "PR", lat: -23.16, lon: -49.97, regiao: "norte_pioneiro", concessionaria: "Copel", destaques: ["polo universitário", "cana-de-açúcar"], vizinhas: ["cambara", "santo-antonio-da-platina", "ourinhos"] },
  { slug: "santo-antonio-da-platina", nome: "Santo Antônio da Platina", uf: "PR", lat: -23.29, lon: -50.08, regiao: "norte_pioneiro", concessionaria: "Copel", destaques: ["comércio e serviços do Norte Pioneiro"], vizinhas: ["jacarezinho", "wenceslau-braz"] },
  { slug: "cambara", nome: "Cambará", uf: "PR", lat: -23.05, lon: -50.07, regiao: "norte_pioneiro", concessionaria: "Copel", destaques: ["indústria de papel e agro"], vizinhas: ["jacarezinho", "ourinhos"] },
  { slug: "cornelio-procopio", nome: "Cornélio Procópio", uf: "PR", lat: -23.18, lon: -50.65, regiao: "norte_pioneiro", concessionaria: "Copel", destaques: ["universidades e agroindústria"], vizinhas: ["bandeirantes", "londrina", "jataizinho"] },
  { slug: "bandeirantes", nome: "Bandeirantes", uf: "PR", lat: -23.11, lon: -50.37, regiao: "norte_pioneiro", concessionaria: "Copel", destaques: ["cana e grãos"], vizinhas: ["cornelio-procopio", "jacarezinho"] },
  { slug: "arapoti", nome: "Arapoti", uf: "PR", lat: -24.15, lon: -49.83, regiao: "norte_pioneiro", concessionaria: "Copel", destaques: ["florestal, papel e grãos"], vizinhas: ["wenceslau-braz", "jaguariaiva"] },
  { slug: "jaguariaiva", nome: "Jaguariaíva", uf: "PR", lat: -24.25, lon: -49.7, regiao: "norte_pioneiro", concessionaria: "Copel", destaques: ["indústria de papel e celulose"], vizinhas: ["arapoti", "ponta-grossa"] },

  // ——— Campos Gerais
  { slug: "ponta-grossa", nome: "Ponta Grossa", uf: "PR", lat: -25.09, lon: -50.16, regiao: "campos_gerais", concessionaria: "Copel", destaques: ["maior parque industrial do interior paranaense", "logística e alimentos"], vizinhas: ["castro", "carambei", "telemaco-borba"] },
  { slug: "castro", nome: "Castro", uf: "PR", lat: -24.79, lon: -50.01, regiao: "campos_gerais", concessionaria: "Copel", destaques: ["maior bacia leiteira do Paraná", "granjas e resfriadores"], vizinhas: ["carambei", "ponta-grossa"] },
  { slug: "carambei", nome: "Carambeí", uf: "PR", lat: -24.92, lon: -50.1, regiao: "campos_gerais", concessionaria: "Copel", destaques: ["cooperativas de leite e aves"], vizinhas: ["castro", "ponta-grossa"] },
  { slug: "telemaco-borba", nome: "Telêmaco Borba", uf: "PR", lat: -24.32, lon: -50.61, regiao: "campos_gerais", concessionaria: "Copel", destaques: ["papel, celulose e indústria de base"], vizinhas: ["ponta-grossa", "ortigueira"] },
  { slug: "ortigueira", nome: "Ortigueira", uf: "PR", lat: -24.21, lon: -50.94, regiao: "campos_gerais", concessionaria: "Copel", destaques: ["florestal e propriedades rurais"], vizinhas: ["telemaco-borba", "ponta-grossa"] },
  { slug: "irati", nome: "Irati", uf: "PR", lat: -25.47, lon: -50.65, regiao: "campos_gerais", concessionaria: "Copel", destaques: ["madeira, erva-mate e comércio"], vizinhas: ["ponta-grossa", "prudentopolis"] },
  { slug: "prudentopolis", nome: "Prudentópolis", uf: "PR", lat: -25.21, lon: -50.98, regiao: "campos_gerais", concessionaria: "Copel", destaques: ["turismo de cachoeiras e agricultura"], vizinhas: ["irati", "guarapuava"] },
  { slug: "palmeira", nome: "Palmeira", uf: "PR", lat: -25.43, lon: -50.0, regiao: "campos_gerais", concessionaria: "Copel", destaques: ["agropecuária e indústria"], vizinhas: ["ponta-grossa", "curitiba"] },

  // ——— Centro e Oeste do Paraná
  { slug: "guarapuava", nome: "Guarapuava", uf: "PR", lat: -25.39, lon: -51.46, regiao: "centro_pr", concessionaria: "Copel", destaques: ["grãos, madeira e comércio regional"], vizinhas: ["prudentopolis", "pitanga"] },
  { slug: "pitanga", nome: "Pitanga", uf: "PR", lat: -24.76, lon: -51.76, regiao: "centro_pr", concessionaria: "Copel", destaques: ["agricultura e pecuária"], vizinhas: ["guarapuava", "campo-mourao"] },
  { slug: "campo-mourao", nome: "Campo Mourão", uf: "PR", lat: -24.05, lon: -52.38, regiao: "centro_pr", concessionaria: "Copel", destaques: ["cooperativas de grãos e agroindústria"], vizinhas: ["pitanga", "maringa"] },
  { slug: "ivaipora", nome: "Ivaiporã", uf: "PR", lat: -24.25, lon: -51.68, regiao: "centro_pr", concessionaria: "Copel", destaques: ["centro de serviços do Vale do Ivaí"], vizinhas: ["apucarana", "campo-mourao"] },

  // ——— Curitiba e RMC
  { slug: "curitiba", nome: "Curitiba", uf: "PR", lat: -25.43, lon: -49.27, regiao: "rmc", concessionaria: "Copel", destaques: ["capital do estado", "serviços, tecnologia e indústria"], vizinhas: ["sao-jose-dos-pinhais", "araucaria", "colombo"] },
  { slug: "sao-jose-dos-pinhais", nome: "São José dos Pinhais", uf: "PR", lat: -25.53, lon: -49.2, regiao: "rmc", concessionaria: "Copel", destaques: ["polo automotivo e logístico"], vizinhas: ["curitiba", "araucaria"] },
  { slug: "araucaria", nome: "Araucária", uf: "PR", lat: -25.59, lon: -49.41, regiao: "rmc", concessionaria: "Copel", destaques: ["refino, química e metalmecânica"], vizinhas: ["curitiba", "sao-jose-dos-pinhais"] },
  { slug: "colombo", nome: "Colombo", uf: "PR", lat: -25.29, lon: -49.22, regiao: "rmc", concessionaria: "Copel", destaques: ["indústria moveleira e comércio"], vizinhas: ["curitiba", "pinhais"] },
  { slug: "pinhais", nome: "Pinhais", uf: "PR", lat: -25.44, lon: -49.19, regiao: "rmc", concessionaria: "Copel", destaques: ["indústria leve e serviços"], vizinhas: ["curitiba", "colombo"] },

  // ——— Sudoeste paulista e interior de SP
  { slug: "ourinhos", nome: "Ourinhos", uf: "SP", lat: -22.97, lon: -49.87, regiao: "sudoeste_sp", concessionaria: "CPFL Santa Cruz", destaques: ["entroncamento ferroviário e agroindústria"], vizinhas: ["santa-cruz-do-rio-pardo", "assis", "jacarezinho"] },
  { slug: "assis", nome: "Assis", uf: "SP", lat: -22.66, lon: -50.41, regiao: "sudoeste_sp", concessionaria: "CPFL Santa Cruz", destaques: ["cana, grãos e serviços"], vizinhas: ["ourinhos", "candido-mota"] },
  { slug: "candido-mota", nome: "Cândido Mota", uf: "SP", lat: -22.75, lon: -50.39, regiao: "sudoeste_sp", concessionaria: "CPFL Santa Cruz", destaques: ["agricultura irrigada"], vizinhas: ["assis", "ourinhos"] },
  { slug: "santa-cruz-do-rio-pardo", nome: "Santa Cruz do Rio Pardo", uf: "SP", lat: -22.9, lon: -49.63, regiao: "sudoeste_sp", concessionaria: "CPFL Santa Cruz", destaques: ["indústria e pecuária"], vizinhas: ["ourinhos", "avare"] },
  { slug: "itarare", nome: "Itararé", uf: "SP", lat: -24.11, lon: -49.33, regiao: "sudoeste_sp", concessionaria: "CPFL Santa Cruz", destaques: ["divisa com o Paraná", "agricultura de clima frio"], vizinhas: ["itapeva", "jaguariaiva"] },
  { slug: "itapeva", nome: "Itapeva", uf: "SP", lat: -23.98, lon: -48.88, regiao: "sudoeste_sp", concessionaria: "CPFL Piratininga", destaques: ["grãos, florestal e comércio"], vizinhas: ["itarare", "capao-bonito"] },
  { slug: "capao-bonito", nome: "Capão Bonito", uf: "SP", lat: -24.01, lon: -48.35, regiao: "sudoeste_sp", concessionaria: "CPFL Piratininga", destaques: ["florestal e agropecuária"], vizinhas: ["itapeva", "itapetininga"] },
  { slug: "itapetininga", nome: "Itapetininga", uf: "SP", lat: -23.59, lon: -48.05, regiao: "interior_sp", concessionaria: "CPFL Piratininga", destaques: ["indústria e logística na Castello Branco"], vizinhas: ["capao-bonito", "sorocaba", "tatui"] },
  { slug: "tatui", nome: "Tatuí", uf: "SP", lat: -23.35, lon: -47.86, regiao: "interior_sp", concessionaria: "CPFL Piratininga", destaques: ["indústria e serviços"], vizinhas: ["itapetininga", "sorocaba"] },
  { slug: "sorocaba", nome: "Sorocaba", uf: "SP", lat: -23.5, lon: -47.46, regiao: "interior_sp", concessionaria: "CPFL Piratininga", destaques: ["grande parque industrial e tecnológico"], vizinhas: ["tatui", "itapetininga", "botucatu"] },
  { slug: "avare", nome: "Avaré", uf: "SP", lat: -23.1, lon: -48.92, regiao: "interior_sp", concessionaria: "CPFL Paulista", destaques: ["turismo, comércio e agropecuária"], vizinhas: ["santa-cruz-do-rio-pardo", "botucatu"] },
  { slug: "botucatu", nome: "Botucatu", uf: "SP", lat: -22.89, lon: -48.44, regiao: "interior_sp", concessionaria: "CPFL Paulista", destaques: ["universidades, saúde e agro"], vizinhas: ["avare", "bauru", "sorocaba"] },
  { slug: "bauru", nome: "Bauru", uf: "SP", lat: -22.32, lon: -49.07, regiao: "interior_sp", concessionaria: "CPFL Paulista", destaques: ["polo regional de serviços e indústria"], vizinhas: ["botucatu", "marilia"] },
  { slug: "marilia", nome: "Marília", uf: "SP", lat: -22.21, lon: -49.95, regiao: "interior_sp", concessionaria: "CPFL Paulista", destaques: ["capital nacional do alimento"], vizinhas: ["bauru", "assis"] },
  { slug: "presidente-prudente", nome: "Presidente Prudente", uf: "SP", lat: -22.13, lon: -51.39, regiao: "interior_sp", concessionaria: "Energisa Sul-Sudeste", destaques: ["centro regional do oeste paulista"], vizinhas: ["marilia", "assis"] },

  // ——— Norte de Santa Catarina
  { slug: "joinville", nome: "Joinville", uf: "SC", lat: -26.3, lon: -48.85, regiao: "norte_sc", concessionaria: "Celesc", destaques: ["maior parque industrial de Santa Catarina"], vizinhas: ["jaragua-do-sul", "sao-bento-do-sul"] },
  { slug: "jaragua-do-sul", nome: "Jaraguá do Sul", uf: "SC", lat: -26.49, lon: -49.07, regiao: "norte_sc", concessionaria: "Celesc", destaques: ["metalmecânica e têxtil"], vizinhas: ["joinville", "sao-bento-do-sul"] },
  { slug: "sao-bento-do-sul", nome: "São Bento do Sul", uf: "SC", lat: -26.25, lon: -49.38, regiao: "norte_sc", concessionaria: "Celesc", destaques: ["polo moveleiro"], vizinhas: ["joinville", "jaragua-do-sul"] },
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
