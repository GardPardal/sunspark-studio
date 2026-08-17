CREATE POLICY "resumes admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND public.is_admin_or_coord());
CREATE POLICY "resumes admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND public.is_admin_or_coord());
CREATE POLICY "resumes admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND public.is_admin_or_coord())
  WITH CHECK (bucket_id = 'resumes' AND public.is_admin_or_coord());
CREATE POLICY "resumes admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND public.is_admin_or_coord());