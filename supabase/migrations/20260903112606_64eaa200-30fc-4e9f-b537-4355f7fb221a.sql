DROP POLICY IF EXISTS "wa events internal only" ON public.wa_events;
CREATE POLICY "wa events internal only"
ON public.wa_events
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);