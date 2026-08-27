import type { CmsTable, InboxTable } from "./admin.functions";

export type FieldType = "text" | "textarea" | "long" | "number" | "bool" | "date" | "json" | "select";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  hint?: string;
  required?: boolean;
};

export type TableSchema = {
  label: string;
  description: string;
  singular: string;
  /** colunas mostradas na listagem */
  columns: string[];
  fields: Field[];
};

const SEO: Field = {
  key: "seo",
  label: "SEO (JSON)",
  type: "json",
  hint: 'Ex.: {"title":"...","description":"..."}',
};

export const CMS_SCHEMA: Record<CmsTable, TableSchema> = {
  site_solutions: {
    label: "Soluções",
    singular: "solução",
    description: "Páginas de produto: residencial, comercial, industrial, híbrido, carport.",
    columns: ["name", "slug", "ordem", "published"],
    fields: [
      { key: "slug", label: "Slug (URL)", type: "text", required: true, hint: "Ex.: energia-solar-residencial" },
      { key: "name", label: "Nome", type: "text", required: true },
      { key: "headline", label: "Título principal", type: "text" },
      { key: "subheadline", label: "Subtítulo", type: "textarea" },
      { key: "hero_image_url", label: "Imagem de capa (URL)", type: "text" },
      { key: "video_url", label: "Vídeo (URL)", type: "text" },
      { key: "intro", label: "Introdução", type: "long" },
      { key: "benefits", label: "Benefícios (JSON)", type: "json", hint: '[{"title":"...","description":"..."}]' },
      { key: "sections", label: "Seções (JSON)", type: "json", hint: '[{"title":"...","content":"..."}]' },
      { key: "faqs", label: "Perguntas frequentes (JSON)", type: "json", hint: '[{"q":"...","a":"..."}]' },
      { key: "testimonials", label: "Depoimentos (JSON)", type: "json" },
      { key: "cta_primary", label: "Botão principal", type: "text" },
      { key: "cta_secondary", label: "Botão secundário", type: "text" },
      { key: "whatsapp_message", label: "Mensagem do WhatsApp", type: "textarea" },
      { key: "form_config", label: "Configuração do formulário (JSON)", type: "json" },
      SEO,
      { key: "ordem", label: "Ordem", type: "number" },
      { key: "published", label: "Publicado", type: "bool" },
    ],
  },
  site_projects: {
    label: "Projetos",
    singular: "projeto",
    description: "Portfólio de obras executadas.",
    columns: ["title", "city", "power_kwp", "featured", "published"],
    fields: [
      { key: "slug", label: "Slug (URL)", type: "text", required: true },
      { key: "title", label: "Título", type: "text", required: true },
      { key: "category", label: "Categoria", type: "select", options: ["residencial", "comercial", "industrial", "rural", "hibrido", "carport"] },
      { key: "city", label: "Cidade", type: "text" },
      { key: "state", label: "Estado", type: "text" },
      { key: "power_kwp", label: "Potência (kWp)", type: "number" },
      { key: "modules_count", label: "Nº de módulos", type: "number" },
      { key: "equipment", label: "Equipamentos", type: "textarea" },
      { key: "summary", label: "Resumo", type: "textarea" },
      { key: "description", label: "Descrição", type: "long" },
      { key: "challenge", label: "Desafio", type: "long" },
      { key: "solution", label: "Solução", type: "long" },
      { key: "result", label: "Resultado", type: "long" },
      { key: "cover_url", label: "Capa (URL)", type: "text" },
      { key: "gallery", label: "Galeria (JSON)", type: "json", hint: '["https://...","https://..."]' },
      { key: "video_url", label: "Vídeo (URL)", type: "text" },
      { key: "client_name", label: "Cliente", type: "text" },
      { key: "estimated_savings", label: "Economia estimada", type: "text" },
      { key: "project_date", label: "Data do projeto", type: "date" },
      { key: "featured", label: "Destaque", type: "bool" },
      { key: "published", label: "Publicado", type: "bool" },
      SEO,
    ],
  },
  site_posts: {
    label: "Blog",
    singular: "artigo",
    description: "Artigos e conteúdos educativos.",
    columns: ["title", "status", "published_at", "views"],
    fields: [
      { key: "slug", label: "Slug (URL)", type: "text", required: true },
      { key: "title", label: "Título", type: "text", required: true },
      { key: "subtitle", label: "Subtítulo", type: "text" },
      { key: "excerpt", label: "Resumo", type: "textarea" },
      { key: "content", label: "Conteúdo", type: "long" },
      { key: "cover_url", label: "Capa (URL)", type: "text" },
      { key: "status", label: "Situação", type: "select", options: ["rascunho", "publicado", "arquivado"] },
      { key: "published_at", label: "Publicado em", type: "date" },
      { key: "reading_minutes", label: "Minutos de leitura", type: "number" },
      { key: "faqs", label: "Perguntas frequentes (JSON)", type: "json" },
      { key: "cta", label: "Chamada final (JSON)", type: "json" },
      SEO,
    ],
  },
  site_categories: {
    label: "Categorias do blog",
    singular: "categoria",
    description: "Organização dos artigos.",
    columns: ["name", "slug", "ordem"],
    fields: [
      { key: "slug", label: "Slug", type: "text", required: true },
      { key: "name", label: "Nome", type: "text", required: true },
      { key: "description", label: "Descrição", type: "textarea" },
      { key: "ordem", label: "Ordem", type: "number" },
    ],
  },
  site_authors: {
    label: "Autores",
    singular: "autor",
    description: "Assinaturas dos artigos.",
    columns: ["name", "role"],
    fields: [
      { key: "name", label: "Nome", type: "text", required: true },
      { key: "role", label: "Cargo", type: "text" },
      { key: "bio", label: "Bio", type: "textarea" },
      { key: "avatar_url", label: "Foto (URL)", type: "text" },
    ],
  },
  site_jobs: {
    label: "Vagas",
    singular: "vaga",
    description: "Oportunidades exibidas em Trabalhe conosco.",
    columns: ["title", "city", "status"],
    fields: [
      { key: "slug", label: "Slug", type: "text", required: true },
      { key: "title", label: "Título", type: "text", required: true },
      { key: "department", label: "Área", type: "text" },
      { key: "city", label: "Cidade", type: "text" },
      { key: "state", label: "Estado", type: "text" },
      { key: "work_model", label: "Modelo", type: "select", options: ["presencial", "hibrido", "remoto"] },
      { key: "contract_type", label: "Contrato", type: "select", options: ["clt", "pj", "estagio", "temporario"] },
      { key: "schedule", label: "Jornada", type: "text" },
      { key: "description", label: "Descrição", type: "long" },
      { key: "responsibilities", label: "Responsabilidades", type: "long" },
      { key: "requirements", label: "Requisitos", type: "long" },
      { key: "differentials", label: "Diferenciais", type: "long" },
      { key: "benefits", label: "Benefícios", type: "long" },
      { key: "ask_salary", label: "Perguntar pretensão salarial", type: "bool" },
      { key: "ask_cnh", label: "Perguntar CNH", type: "bool" },
      { key: "require_resume", label: "Currículo obrigatório", type: "bool" },
      { key: "status", label: "Situação", type: "select", options: ["aberta", "pausada", "encerrada"] },
      { key: "published_at", label: "Publicada em", type: "date" },
      SEO,
    ],
  },
  site_rh_questions: {
    label: "Perguntas do RH",
    singular: "pergunta",
    description: "Perguntas do formulário de currículo em Trabalhe conosco. Edite, reordene ou desative quando quiser.",
    columns: ["label", "field_type", "scope", "ordem", "active"],
    fields: [
      { key: "label", label: "Pergunta", type: "text", required: true },
      { key: "help", label: "Texto de ajuda", type: "text" },
      {
        key: "field_type",
        label: "Tipo de resposta",
        type: "select",
        options: ["text", "textarea", "select", "number", "date", "bool"],
        hint: "text = linha curta · textarea = texto longo · select = lista de opções",
      },
      {
        key: "options",
        label: "Opções (JSON)",
        type: "json",
        hint: 'Somente para tipo select. Ex.: ["Sim","Não"]',
      },
      { key: "required", label: "Obrigatória", type: "bool" },
      {
        key: "scope",
        label: "Onde aparece",
        type: "select",
        options: ["ambos", "vaga", "talentos"],
      },
      { key: "ordem", label: "Ordem", type: "number" },
      { key: "active", label: "Ativa", type: "bool" },
    ],
  },
  site_units: {
    label: "Unidades",
    singular: "unidade",
    description: "Endereços e contatos das unidades LZ7.",
    columns: ["name", "city", "phone", "published"],
    fields: [
      { key: "slug", label: "Slug", type: "text", required: true },
      { key: "name", label: "Nome", type: "text", required: true },
      { key: "city", label: "Cidade", type: "text" },
      { key: "state", label: "Estado", type: "text" },
      { key: "address", label: "Endereço", type: "textarea" },
      { key: "phone", label: "Telefone", type: "text" },
      { key: "whatsapp", label: "WhatsApp", type: "text" },
      { key: "email", label: "E-mail", type: "text" },
      { key: "hours", label: "Horário", type: "text" },
      { key: "maps_url", label: "Google Maps (URL)", type: "text" },
      { key: "image_url", label: "Imagem (URL)", type: "text" },
      { key: "ordem", label: "Ordem", type: "number" },
      { key: "published", label: "Publicado", type: "bool" },
    ],
  },
  site_timeline: {
    label: "Linha do tempo",
    singular: "marco",
    description: "História da empresa exibida em Sobre.",
    columns: ["year", "title", "ordem", "published"],
    fields: [
      { key: "year", label: "Ano", type: "text", required: true },
      { key: "title", label: "Título", type: "text", required: true },
      { key: "description", label: "Descrição", type: "textarea" },
      { key: "image_url", label: "Imagem (URL)", type: "text" },
      { key: "ordem", label: "Ordem", type: "number" },
      { key: "published", label: "Publicado", type: "bool" },
    ],
  },
  site_stats: {
    label: "Números",
    singular: "número",
    description: "Indicadores exibidos no site (ex.: 1.200 clientes).",
    columns: ["label", "value", "ordem", "published"],
    fields: [
      { key: "label", label: "Rótulo", type: "text", required: true },
      { key: "value", label: "Valor", type: "text", required: true },
      { key: "suffix", label: "Sufixo", type: "text" },
      { key: "ordem", label: "Ordem", type: "number" },
      { key: "published", label: "Publicado", type: "bool" },
    ],
  },
  site_pages: {
    label: "Páginas livres",
    singular: "página",
    description: "Conteúdos institucionais e legais editáveis.",
    columns: ["title", "slug", "published"],
    fields: [
      { key: "slug", label: "Slug", type: "text", required: true },
      { key: "title", label: "Título", type: "text", required: true },
      { key: "subtitle", label: "Subtítulo", type: "text" },
      { key: "content", label: "Conteúdo", type: "long" },
      { key: "published", label: "Publicado", type: "bool" },
      SEO,
    ],
  },
};

export const INBOX_SCHEMA: Record<
  InboxTable,
  { label: string; description: string; columns: string[]; statuses: string[] }
> = {
  job_applications: {
    label: "Candidaturas",
    description: "Currículos recebidos em Trabalhe conosco.",
    columns: ["full_name", "job_title", "city", "phone", "status"],
    statuses: ["novo", "em_analise", "entrevista", "aprovado", "reprovado"],
  },
  partner_requests: {
    label: "Parceiros",
    description: "Solicitações de parceria comercial.",
    columns: ["name", "company", "city", "phone", "status"],
    statuses: ["novo", "em_contato", "aprovado", "recusado"],
  },
  contact_messages: {
    label: "Mensagens",
    description: "Formulário de contato e ouvidoria.",
    columns: ["name", "subject_type", "city", "phone", "status"],
    statuses: ["novo", "em_atendimento", "resolvido"],
  },
  newsletter_subscribers: {
    label: "Newsletter",
    description: "Inscritos na lista de conteúdos.",
    columns: ["email", "name", "status"],
    statuses: ["ativo", "cancelado"],
  },
};
