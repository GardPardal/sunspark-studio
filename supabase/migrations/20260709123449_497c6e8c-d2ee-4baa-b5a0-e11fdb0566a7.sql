SELECT public.enqueue_email('transactional_emails', jsonb_build_object(
  'to', 'alisonlz7@icloud.com',
  'from', 'LZ7 Painel <notify@lz7energia.com.br>',
  'sender_domain', 'notify.lz7energia.com.br',
  'subject', 'TESTE EMAIL LZ7',
  'html', '<html><body><h1>TESTE EMAIL LZ7</h1><p>Se você recebeu este email, o sistema está funcionando.</p></body></html>',
  'text', 'TESTE EMAIL LZ7 — Se você recebeu este email, o sistema está funcionando.',
  'purpose', 'transactional',
  'label', 'teste-direto',
  'idempotency_key', 'teste-direto-' || gen_random_uuid()::text,
  'message_id', gen_random_uuid()::text,
  'queued_at', now()
));