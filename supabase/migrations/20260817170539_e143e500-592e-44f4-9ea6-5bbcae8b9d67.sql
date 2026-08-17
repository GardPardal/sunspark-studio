-- =============== Helpers ===============
CREATE OR REPLACE FUNCTION public.site_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =============== site_pages ===============
CREATE TABLE public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  content text NOT NULL DEFAULT '',
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_pages TO authenticated;
GRANT ALL ON public.site_pages TO service_role;
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_pages public read" ON public.site_pages FOR SELECT USING (published = true);
CREATE POLICY "site_pages manage" ON public.site_pages FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_site_pages_touch BEFORE UPDATE ON public.site_pages FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

-- =============== site_solutions ===============
CREATE TABLE public.site_solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  headline text NOT NULL,
  subheadline text,
  hero_image_url text,
  video_url text,
  intro text,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  testimonials jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_primary text,
  cta_secondary text,
  whatsapp_message text,
  form_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_solutions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_solutions TO authenticated;
GRANT ALL ON public.site_solutions TO service_role;
ALTER TABLE public.site_solutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_solutions public read" ON public.site_solutions FOR SELECT USING (published = true);
CREATE POLICY "site_solutions manage" ON public.site_solutions FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_site_solutions_touch BEFORE UPDATE ON public.site_solutions FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

-- =============== site_projects ===============
CREATE TABLE public.site_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'residencial',
  city text,
  state text,
  power_kwp numeric,
  modules_count integer,
  equipment text,
  summary text,
  description text,
  challenge text,
  solution text,
  result text,
  cover_url text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  video_url text,
  client_name text,
  estimated_savings text,
  project_date date,
  featured boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_projects TO authenticated;
GRANT ALL ON public.site_projects TO service_role;
ALTER TABLE public.site_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_projects public read" ON public.site_projects FOR SELECT USING (published = true);
CREATE POLICY "site_projects manage" ON public.site_projects FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_site_projects_touch BEFORE UPDATE ON public.site_projects FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();
CREATE INDEX idx_site_projects_pub ON public.site_projects (published, category, project_date DESC);

-- =============== blog ===============
CREATE TABLE public.site_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_categories TO authenticated;
GRANT ALL ON public.site_categories TO service_role;
ALTER TABLE public.site_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_categories public read" ON public.site_categories FOR SELECT USING (true);
CREATE POLICY "site_categories manage" ON public.site_categories FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_site_categories_touch BEFORE UPDATE ON public.site_categories FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

CREATE TABLE public.site_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  bio text,
  avatar_url text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_authors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_authors TO authenticated;
GRANT ALL ON public.site_authors TO service_role;
ALTER TABLE public.site_authors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_authors public read" ON public.site_authors FOR SELECT USING (true);
CREATE POLICY "site_authors manage" ON public.site_authors FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_site_authors_touch BEFORE UPDATE ON public.site_authors FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

CREATE TABLE public.site_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_tags TO authenticated;
GRANT ALL ON public.site_tags TO service_role;
ALTER TABLE public.site_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_tags public read" ON public.site_tags FOR SELECT USING (true);
CREATE POLICY "site_tags manage" ON public.site_tags FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());

CREATE TABLE public.site_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  excerpt text,
  content text NOT NULL DEFAULT '',
  cover_url text,
  category_id uuid REFERENCES public.site_categories(id) ON DELETE SET NULL,
  author_id uuid REFERENCES public.site_authors(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'rascunho',
  published_at timestamptz,
  reading_minutes integer,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  views integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_posts_status_chk CHECK (status IN ('rascunho','revisao','agendado','publicado','arquivado'))
);
GRANT SELECT ON public.site_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_posts TO authenticated;
GRANT ALL ON public.site_posts TO service_role;
ALTER TABLE public.site_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_posts public read" ON public.site_posts FOR SELECT
  USING (status = 'publicado' AND (published_at IS NULL OR published_at <= now()));
CREATE POLICY "site_posts manage" ON public.site_posts FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_site_posts_touch BEFORE UPDATE ON public.site_posts FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();
CREATE INDEX idx_site_posts_pub ON public.site_posts (status, published_at DESC);

CREATE TABLE public.site_post_tags (
  post_id uuid NOT NULL REFERENCES public.site_posts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.site_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
GRANT SELECT ON public.site_post_tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_post_tags TO authenticated;
GRANT ALL ON public.site_post_tags TO service_role;
ALTER TABLE public.site_post_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_post_tags public read" ON public.site_post_tags FOR SELECT USING (true);
CREATE POLICY "site_post_tags manage" ON public.site_post_tags FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());

-- =============== jobs ===============
CREATE TABLE public.site_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  department text,
  city text,
  state text,
  work_model text,
  contract_type text,
  schedule text,
  description text,
  responsibilities text,
  requirements text,
  differentials text,
  benefits text,
  ask_salary boolean NOT NULL DEFAULT false,
  ask_cnh boolean NOT NULL DEFAULT false,
  require_resume boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'rascunho',
  published_at timestamptz,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_jobs_status_chk CHECK (status IN ('rascunho','aberta','pausada','encerrada','arquivada'))
);
GRANT SELECT ON public.site_jobs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_jobs TO authenticated;
GRANT ALL ON public.site_jobs TO service_role;
ALTER TABLE public.site_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_jobs public read" ON public.site_jobs FOR SELECT USING (status IN ('aberta','pausada','encerrada'));
CREATE POLICY "site_jobs manage" ON public.site_jobs FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_site_jobs_touch BEFORE UPDATE ON public.site_jobs FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.site_jobs(id) ON DELETE SET NULL,
  job_title text,
  kind text NOT NULL DEFAULT 'vaga',
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  city text,
  state text,
  linkedin text,
  salary_expectation text,
  has_cnh boolean,
  availability text,
  experience text,
  message text,
  interest_area text,
  resume_path text,
  resume_name text,
  status text NOT NULL DEFAULT 'novo',
  internal_notes text,
  origin jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_applications_status_chk CHECK (status IN ('novo','triagem','entrevista','processo','aprovado','reprovado','banco_talentos'))
);
GRANT INSERT ON public.job_applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT ALL ON public.job_applications TO service_role;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_applications public insert" ON public.job_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "job_applications manage" ON public.job_applications FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_job_applications_touch BEFORE UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

-- =============== partners ===============
CREATE TABLE public.partner_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  cnpj text,
  city text,
  state text,
  phone text NOT NULL,
  email text,
  website text,
  partnership_type text,
  proposal text,
  status text NOT NULL DEFAULT 'novo',
  internal_notes text,
  origin jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_requests_status_chk CHECK (status IN ('novo','em_analise','contato_realizado','reuniao_agendada','aprovado','recusado'))
);
GRANT INSERT ON public.partner_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_requests TO authenticated;
GRANT ALL ON public.partner_requests TO service_role;
ALTER TABLE public.partner_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partner_requests public insert" ON public.partner_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "partner_requests manage" ON public.partner_requests FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_partner_requests_touch BEFORE UPDATE ON public.partner_requests FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

-- =============== contact ===============
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL DEFAULT 'outro',
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  city text,
  message text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  routed_to text,
  status text NOT NULL DEFAULT 'novo',
  internal_notes text,
  origin jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_messages_status_chk CHECK (status IN ('novo','em_atendimento','resolvido','arquivado'))
);
GRANT INSERT ON public.contact_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact_messages public insert" ON public.contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "contact_messages manage" ON public.contact_messages FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_contact_messages_touch BEFORE UPDATE ON public.contact_messages FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

-- =============== newsletter ===============
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text NOT NULL UNIQUE,
  consent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ativo',
  origin jsonb NOT NULL DEFAULT '{}'::jsonb,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_status_chk CHECK (status IN ('ativo','cancelado'))
);
GRANT INSERT ON public.newsletter_subscribers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "newsletter public insert" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "newsletter manage" ON public.newsletter_subscribers FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_newsletter_touch BEFORE UPDATE ON public.newsletter_subscribers FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

-- =============== units / about ===============
CREATE TABLE public.site_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  city text NOT NULL,
  state text,
  address text,
  phone text,
  whatsapp text,
  email text,
  hours text,
  maps_url text,
  image_url text,
  ordem integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_units TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_units TO authenticated;
GRANT ALL ON public.site_units TO service_role;
ALTER TABLE public.site_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_units public read" ON public.site_units FOR SELECT USING (published = true);
CREATE POLICY "site_units manage" ON public.site_units FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_site_units_touch BEFORE UPDATE ON public.site_units FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

CREATE TABLE public.site_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year text NOT NULL,
  title text NOT NULL,
  description text,
  image_url text,
  ordem integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_timeline TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_timeline TO authenticated;
GRANT ALL ON public.site_timeline TO service_role;
ALTER TABLE public.site_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_timeline public read" ON public.site_timeline FOR SELECT USING (published = true);
CREATE POLICY "site_timeline manage" ON public.site_timeline FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_site_timeline_touch BEFORE UPDATE ON public.site_timeline FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

CREATE TABLE public.site_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  suffix text,
  ordem integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_stats TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_stats TO authenticated;
GRANT ALL ON public.site_stats TO service_role;
ALTER TABLE public.site_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_stats public read" ON public.site_stats FOR SELECT USING (published = true);
CREATE POLICY "site_stats manage" ON public.site_stats FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
CREATE TRIGGER trg_site_stats_touch BEFORE UPDATE ON public.site_stats FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

-- =============== seeds mínimos (estrutura, não dados fictícios) ===============
INSERT INTO public.site_solutions (slug, name, headline, subheadline, ordem) VALUES
  ('energia-solar-residencial','Energia Solar Residencial','Energia solar para sua casa','Reduza sua conta de luz e valorize seu imóvel com energia limpa.',1),
  ('energia-solar-comercial','Energia Solar Comercial','Transforme a conta de energia da sua empresa em economia','Previsibilidade de custo e retorno para lojas, escritórios e serviços.',2),
  ('energia-solar-industrial','Energia Solar Industrial','Energia solar para grandes consumidores','Projetos de alta potência com estudo técnico e engenharia dedicada.',3),
  ('sistemas-hibridos','Sistemas Híbridos','Energia solar com armazenamento','Geração própria com baterias e backup para reduzir a dependência da rede.',4),
  ('carport-solar','Carport Solar','Estacionamento que gera energia','Cobertura para veículos que protege, valoriza e produz energia limpa.',5);

INSERT INTO public.site_categories (slug, name, ordem) VALUES
  ('energia-solar','Energia Solar',1),
  ('economia','Economia',2),
  ('mercado-de-energia','Mercado de Energia',3),
  ('tecnologia','Tecnologia',4),
  ('mobilidade-eletrica','Mobilidade Elétrica',5),
  ('dicas','Dicas',6);

INSERT INTO public.site_pages (slug, title, subtitle, content, published) VALUES
  ('politica-de-privacidade','Política de Privacidade','Como tratamos seus dados pessoais','', false),
  ('termos-de-uso','Termos de Uso','Condições de uso do site LZ7 Energia','', false);