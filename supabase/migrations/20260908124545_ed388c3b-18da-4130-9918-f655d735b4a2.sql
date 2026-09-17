DELETE FROM public.lead_events WHERE lead_id = '0b1d1ffd-2d48-4486-bfdc-b5566c60da47';
DELETE FROM public.lead_sync_queue WHERE lead_id = '0b1d1ffd-2d48-4486-bfdc-b5566c60da47';
DELETE FROM public.timeline_events WHERE entity_id = '0b1d1ffd-2d48-4486-bfdc-b5566c60da47';
DELETE FROM public.conversion_events WHERE lead_id = '0b1d1ffd-2d48-4486-bfdc-b5566c60da47';
DELETE FROM public.leads WHERE id = '0b1d1ffd-2d48-4486-bfdc-b5566c60da47' AND telefone_e164 = '+5543999990001';