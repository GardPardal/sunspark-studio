CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.kb_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  source_type text NOT NULL DEFAULT 'texto',
  source_ref text,
  content text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  chunk_count integer NOT NULL DEFAULT 0,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_documents TO authenticated;
GRANT ALL ON public.kb_documents TO service_role;
ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage kb docs" ON public.kb_documents
  FOR ALL TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

CREATE TABLE public.kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  token_estimate integer NOT NULL DEFAULT 0,
  embedding vector(1536),
  model_version text NOT NULL DEFAULT 'openai/text-embedding-3-small',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);
GRANT SELECT ON public.kb_chunks TO authenticated;
GRANT ALL ON public.kb_chunks TO service_role;
ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read kb chunks" ON public.kb_chunks
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE INDEX kb_chunks_embedding_idx ON public.kb_chunks
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX kb_chunks_org_idx ON public.kb_chunks(org_id);

CREATE TABLE public.kb_ingest_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'documento',
  status text NOT NULL DEFAULT 'pending',
  total integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  error text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.kb_ingest_jobs TO authenticated;
GRANT ALL ON public.kb_ingest_jobs TO service_role;
ALTER TABLE public.kb_ingest_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read kb jobs" ON public.kb_ingest_jobs
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "org members create kb jobs" ON public.kb_ingest_jobs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id));

CREATE TRIGGER trg_kb_documents_uat BEFORE UPDATE ON public.kb_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_kb_jobs_uat BEFORE UPDATE ON public.kb_ingest_jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  _org_id uuid,
  _query_embedding vector(1536),
  _match_count integer DEFAULT 6
)
RETURNS TABLE(id uuid, document_id uuid, content text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.document_id, c.content,
         1 - (c.embedding <=> _query_embedding) AS similarity
  FROM public.kb_chunks c
  WHERE c.org_id = _org_id
    AND c.embedding IS NOT NULL
    AND public.is_org_member(_org_id)
  ORDER BY c.embedding <=> _query_embedding
  LIMIT LEAST(GREATEST(COALESCE(_match_count, 6), 1), 20)
$$;