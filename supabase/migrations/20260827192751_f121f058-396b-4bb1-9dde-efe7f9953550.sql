CREATE TABLE public.site_rh_questions (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  help text,
  field_type text not null default 'text',
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  scope text not null default 'ambos',
  ordem integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT ON public.site_rh_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_rh_questions TO authenticated;
GRANT ALL ON public.site_rh_questions TO service_role;

ALTER TABLE public.site_rh_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_rh_questions public read" ON public.site_rh_questions
  FOR SELECT TO anon, authenticated USING (active = true);

CREATE POLICY "site_rh_questions manage" ON public.site_rh_questions
  FOR ALL TO authenticated USING (is_admin_or_coord()) WITH CHECK (is_admin_or_coord());

CREATE TRIGGER site_rh_questions_updated_at
  BEFORE UPDATE ON public.site_rh_questions
  FOR EACH ROW EXECUTE FUNCTION public.agenda_touch_updated_at();

ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS answers jsonb not null default '{}'::jsonb;

INSERT INTO public.site_rh_questions (label, help, field_type, options, required, scope, ordem) VALUES
('Qual cargo/área você deseja atuar?', 'Ex.: vendas, instalação, administrativo', 'text', '[]'::jsonb, true, 'talentos', 10),
('Qual sua última experiência profissional?', 'Empresa, cargo e período', 'textarea', '[]'::jsonb, true, 'ambos', 20),
('Qual sua escolaridade?', null, 'select', '["Ensino fundamental","Ensino médio","Técnico","Superior incompleto","Superior completo","Pós-graduação"]'::jsonb, true, 'ambos', 30),
('Você tem experiência com energia solar?', null, 'select', '["Não tenho","Menos de 1 ano","1 a 3 anos","Mais de 3 anos"]'::jsonb, true, 'ambos', 40),
('Possui veículo próprio?', null, 'select', '["Sim, carro","Sim, moto","Não"]'::jsonb, false, 'ambos', 50),
('Qual sua disponibilidade para início?', null, 'select', '["Imediata","15 dias","30 dias","A combinar"]'::jsonb, true, 'ambos', 60),
('Tem disponibilidade para viagens?', null, 'select', '["Sim","Não","A combinar"]'::jsonb, false, 'ambos', 70),
('Por que você quer trabalhar na LZ7 Energia?', null, 'textarea', '[]'::jsonb, false, 'ambos', 80);