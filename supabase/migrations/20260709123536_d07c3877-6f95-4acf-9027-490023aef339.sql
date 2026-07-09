
INSERT INTO public.email_unsubscribe_tokens (email, token)
VALUES ('alisonlz7@icloud.com', replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''))
ON CONFLICT (email) DO NOTHING;

SELECT public.enqueue_email('transactional_emails', jsonb_build_object(
  'to', 'alisonlz7@icloud.com',
  'from', 'LZ7 Painel <notify@lz7energia.com.br>',
  'sender_domain', 'notify.lz7energia.com.br',
  'subject', 'TESTE EMAIL LZ7',
  'html', '<html><body><h1>TESTE EMAIL LZ7</h1><p>Se você recebeu este email, o sistema está funcionando.</p></body></html>',
  'text', 'TESTE EMAIL LZ7 — Se você recebeu este email, o sistema está funcionando.',
  'purpose', 'transactional',
  'label', 'teste-direto-v2',
  'idempotency_key', 'teste-v2-' || gen_random_uuid()::text,
  'message_id', gen_random_uuid()::text,
  'unsubscribe_token', (SELECT token FROM public.email_unsubscribe_tokens WHERE email='alisonlz7@icloud.com' LIMIT 1),
  'queued_at', now()
));
