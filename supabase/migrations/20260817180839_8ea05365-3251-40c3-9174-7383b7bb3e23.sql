-- ============ RADAR EDITORIAL LZ7 (aditivo) ============

CREATE TABLE public.editorial_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  dominio text NOT NULL,
  feed_url text,
  tipo text NOT NULL DEFAULT 'especializado',
  categorias text[] NOT NULL DEFAULT '{}',
  prioridade integer NOT NULL DEFAULT 50,
  autoridade integer NOT NULL DEFAULT 50,
  metodo text NOT NULL DEFAULT 'rss',
  adapter text NOT NULL DEFAULT 'rssAdapter',
  ativo boolean NOT NULL DEFAULT true,
  frequencia_minutos integer NOT NULL DEFAULT 60,
  ultima_verificacao timestamptz,
  ultima_publicacao_encontrada timestamptz,
  status text NOT NULL DEFAULT 'ok',
  erros_consecutivos integer NOT NULL DEFAULT 0,
  ultimo_erro text,
  politica_uso text,
  permite_conteudo_integral boolean NOT NULL DEFAULT false,
  permite_imagem boolean NOT NULL DEFAULT false,
  requer_credito boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editorial_sources_tipo_chk CHECK (tipo IN ('oficial','entidade','especializado','geral')),
  CONSTRAINT editorial_sources_metodo_chk CHECK (metodo IN ('api','rss','sitemap','pagina')),
  CONSTRAINT editorial_sources_status_chk CHECK (status IN ('ok','erro','restrita','pausada'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_sources TO authenticated;
GRANT ALL ON public.editorial_sources TO service_role;
ALTER TABLE public.editorial_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editorial_sources manage" ON public.editorial_sources FOR ALL TO authenticated
  USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_editorial_sources_touch BEFORE UPDATE ON public.editorial_sources
  FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();
CREATE UNIQUE INDEX idx_editorial_sources_dominio ON public.editorial_sources (dominio, coalesce(feed_url,''));

CREATE TABLE public.editorial_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assunto text NOT NULL,
  titulo_interno text,
  resumo_factual text,
  categoria text,
  relevancia integer NOT NULL DEFAULT 0,
  confidence_score integer NOT NULL DEFAULT 0,
  lz7_score integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  quantidade_fontes integer NOT NULL DEFAULT 1,
  fonte_primaria_id uuid REFERENCES public.editorial_sources(id) ON DELETE SET NULL,
  evergreen boolean NOT NULL DEFAULT false,
  breaking_news boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'identificada',
  post_id uuid REFERENCES public.site_posts(id) ON DELETE SET NULL,
  motivo_bloqueio text,
  primeira_detectada_em timestamptz NOT NULL DEFAULT now(),
  ultima_atualizacao timestamptz NOT NULL DEFAULT now(),
  fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editorial_topics_status_chk CHECK (status IN ('identificada','coletando','verificando','gerando','revisao','agendado','publicado','atualizado','ignorado','erro'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_topics TO authenticated;
GRANT ALL ON public.editorial_topics TO service_role;
ALTER TABLE public.editorial_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editorial_topics manage" ON public.editorial_topics FOR ALL TO authenticated
  USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_editorial_topics_touch BEFORE UPDATE ON public.editorial_topics
  FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();
CREATE INDEX idx_editorial_topics_status ON public.editorial_topics (status, score DESC);
CREATE INDEX idx_editorial_topics_fp ON public.editorial_topics (fingerprint);

CREATE TABLE public.editorial_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.editorial_sources(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.editorial_topics(id) ON DELETE SET NULL,
  url text NOT NULL,
  url_hash text NOT NULL,
  titulo text NOT NULL,
  resumo text,
  autor text,
  publicado_em timestamptz,
  idioma text DEFAULT 'pt',
  keywords text[] NOT NULL DEFAULT '{}',
  relevancia integer NOT NULL DEFAULT 0,
  processado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_items TO authenticated;
GRANT ALL ON public.editorial_items TO service_role;
ALTER TABLE public.editorial_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editorial_items manage" ON public.editorial_items FOR ALL TO authenticated
  USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_editorial_items_touch BEFORE UPDATE ON public.editorial_items
  FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();
CREATE UNIQUE INDEX idx_editorial_items_hash ON public.editorial_items (url_hash);
CREATE INDEX idx_editorial_items_topic ON public.editorial_items (topic_id);

CREATE TABLE public.editorial_topic_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.editorial_topics(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.editorial_sources(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.editorial_items(id) ON DELETE SET NULL,
  peso integer NOT NULL DEFAULT 1,
  papel text NOT NULL DEFAULT 'contexto',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_topic_sources TO authenticated;
GRANT ALL ON public.editorial_topic_sources TO service_role;
ALTER TABLE public.editorial_topic_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editorial_topic_sources manage" ON public.editorial_topic_sources FOR ALL TO authenticated
  USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE UNIQUE INDEX idx_ets_unique ON public.editorial_topic_sources (topic_id, coalesce(item_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE public.editorial_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.editorial_topics(id) ON DELETE CASCADE,
  informacao text NOT NULL,
  fonte_nome text,
  fonte_url text,
  confianca integer NOT NULL DEFAULT 50,
  data_fato date,
  confirmado_por integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_facts TO authenticated;
GRANT ALL ON public.editorial_facts TO service_role;
ALTER TABLE public.editorial_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editorial_facts manage" ON public.editorial_facts FOR ALL TO authenticated
  USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE INDEX idx_editorial_facts_topic ON public.editorial_facts (topic_id);

CREATE TABLE public.editorial_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES public.editorial_topics(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'artigo',
  status text NOT NULL DEFAULT 'queued',
  tentativas integer NOT NULL DEFAULT 0,
  max_tentativas integer NOT NULL DEFAULT 3,
  erro text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editorial_jobs_status_chk CHECK (status IN ('queued','fetching','researching','generating','validating','image','seo','publishing','completed','failed','paused'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_jobs TO authenticated;
GRANT ALL ON public.editorial_jobs TO service_role;
ALTER TABLE public.editorial_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editorial_jobs manage" ON public.editorial_jobs FOR ALL TO authenticated
  USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_editorial_jobs_touch BEFORE UPDATE ON public.editorial_jobs
  FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();
CREATE INDEX idx_editorial_jobs_status ON public.editorial_jobs (status, created_at);

CREATE TABLE public.editorial_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.editorial_sources(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.editorial_topics(id) ON DELETE SET NULL,
  acao text NOT NULL,
  resultado text,
  nivel text NOT NULL DEFAULT 'info',
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editorial_logs_nivel_chk CHECK (nivel IN ('info','warn','error'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_logs TO authenticated;
GRANT ALL ON public.editorial_logs TO service_role;
ALTER TABLE public.editorial_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editorial_logs manage" ON public.editorial_logs FOR ALL TO authenticated
  USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE INDEX idx_editorial_logs_created ON public.editorial_logs (created_at DESC);

CREATE TABLE public.editorial_settings (
  id boolean PRIMARY KEY DEFAULT true,
  modo_publicacao text NOT NULL DEFAULT 'semiautomatica',
  pausar_publicacao boolean NOT NULL DEFAULT false,
  pausar_descoberta boolean NOT NULL DEFAULT false,
  max_artigos_dia integer NOT NULL DEFAULT 4,
  min_confidence integer NOT NULL DEFAULT 90,
  min_relevancia integer NOT NULL DEFAULT 75,
  max_similaridade integer NOT NULL DEFAULT 70,
  regras_categoria jsonb NOT NULL DEFAULT '{}'::jsonb,
  modelo_texto text NOT NULL DEFAULT 'google/gemini-3-flash',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editorial_settings_single CHECK (id),
  CONSTRAINT editorial_settings_modo_chk CHECK (modo_publicacao IN ('manual','semiautomatica','automatica'))
);
GRANT SELECT, INSERT, UPDATE ON public.editorial_settings TO authenticated;
GRANT ALL ON public.editorial_settings TO service_role;
ALTER TABLE public.editorial_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editorial_settings manage" ON public.editorial_settings FOR ALL TO authenticated
  USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
INSERT INTO public.editorial_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE public.editorial_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'scan',
  itens_encontrados integer NOT NULL DEFAULT 0,
  pautas_novas integer NOT NULL DEFAULT 0,
  pautas_relevantes integer NOT NULL DEFAULT 0,
  artigos_gerados integer NOT NULL DEFAULT 0,
  artigos_publicados integer NOT NULL DEFAULT 0,
  erros integer NOT NULL DEFAULT 0,
  custo_estimado numeric(10,4) NOT NULL DEFAULT 0,
  duracao_ms integer,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_runs TO authenticated;
GRANT ALL ON public.editorial_runs TO service_role;
ALTER TABLE public.editorial_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editorial_runs manage" ON public.editorial_runs FOR ALL TO authenticated
  USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE INDEX idx_editorial_runs_created ON public.editorial_runs (created_at DESC);

-- ============ COLUNAS ADITIVAS NO BLOG ============
ALTER TABLE public.site_posts
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'artigo',
  ADD COLUMN IF NOT EXISTS topic_id uuid,
  ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_score integer,
  ADD COLUMN IF NOT EXISTS updated_note text,
  ADD COLUMN IF NOT EXISTS breaking_news boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tldr text;

-- ============ SEED: categorias e autor ============
INSERT INTO public.site_categories (slug, name, description, ordem)
SELECT v.slug, v.name, v.descr, v.ordem FROM (VALUES
  ('energia-solar','Energia Solar','Geração fotovoltaica, projetos e tecnologia solar.',1),
  ('conta-de-luz','Conta de Luz','Tarifas, bandeiras, reajustes e economia.',2),
  ('mercado-de-energia','Mercado de Energia','Mercado livre, comercialização e preços.',3),
  ('aneel-regulamentacao','ANEEL & Regulamentação','Normas, resoluções e consultas públicas.',4),
  ('empresas','Empresas','Energia para negócios, indústria e comércio.',5),
  ('agronegocio','Agronegócio','Energia no campo e produção rural.',6),
  ('tecnologia','Tecnologia','Inovações, equipamentos e eficiência.',7),
  ('armazenamento-baterias','Armazenamento & Baterias','Baterias, híbridos e backup.',8),
  ('mobilidade-eletrica','Mobilidade Elétrica','Veículos elétricos e recarga.',9),
  ('sustentabilidade','Sustentabilidade','Transição energética e meio ambiente.',10),
  ('guias','Guias','Conteúdos permanentes que explicam o essencial.',11),
  ('noticias','Notícias','Acontecimentos do setor elétrico.',12)
) AS v(slug,name,descr,ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.site_categories c WHERE c.slug = v.slug);

INSERT INTO public.site_authors (name, role, bio)
SELECT 'Redação LZ7 Energia', 'Equipe editorial', 'Conteúdo produzido pela redação da LZ7 Energia a partir de fontes oficiais, entidades setoriais e veículos especializados, com análise própria.'
WHERE NOT EXISTS (SELECT 1 FROM public.site_authors a WHERE a.name = 'Redação LZ7 Energia');