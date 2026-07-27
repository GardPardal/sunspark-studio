CREATE UNIQUE INDEX IF NOT EXISTS meta_insights_daily_date_ad_id_uk
ON public.meta_insights_daily (date, ad_id);