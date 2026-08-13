DELETE FROM public.conversion_events WHERE lead_id IN (SELECT id FROM public.leads WHERE nome = 'QA Prod Mode');
DELETE FROM public.leads WHERE nome = 'QA Prod Mode';