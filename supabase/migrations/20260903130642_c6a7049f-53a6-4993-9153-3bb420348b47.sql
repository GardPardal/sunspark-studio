DROP INDEX IF EXISTS public.wa_directory_org_lid_uidx;
DROP INDEX IF EXISTS public.wa_directory_org_phone_uidx;
DELETE FROM public.wa_directory a USING public.wa_directory b
  WHERE a.ctid < b.ctid AND a.org_id = b.org_id AND a.lid IS NOT DISTINCT FROM b.lid;
CREATE UNIQUE INDEX wa_directory_org_lid_uidx ON public.wa_directory (org_id, lid);
CREATE INDEX IF NOT EXISTS wa_directory_org_phone_idx ON public.wa_directory (org_id, phone_e164);