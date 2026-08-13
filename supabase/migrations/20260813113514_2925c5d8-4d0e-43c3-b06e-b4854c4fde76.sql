UPDATE public.site_settings SET value = '', updated_at = now() WHERE key = 'meta_test_event_code';
DELETE FROM public.leads WHERE nome = 'Teste Conversao QA' AND origem = 'quiz-site';