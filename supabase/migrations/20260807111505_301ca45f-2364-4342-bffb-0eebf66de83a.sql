CREATE POLICY "org members read wa-media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'wa-media'
  AND public.is_org_member(NULLIF(split_part(name, '/', 1), '')::uuid)
);