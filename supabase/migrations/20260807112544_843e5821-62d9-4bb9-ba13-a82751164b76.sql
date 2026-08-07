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
    AND (auth.uid() IS NULL OR public.is_org_member(_org_id))
  ORDER BY c.embedding <=> _query_embedding
  LIMIT LEAST(GREATEST(COALESCE(_match_count, 6), 1), 20)
$$;

REVOKE EXECUTE ON FUNCTION public.match_kb_chunks(uuid, vector, integer) FROM anon;