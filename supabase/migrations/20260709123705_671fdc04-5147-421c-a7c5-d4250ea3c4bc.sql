
SELECT public.enqueue_email('transactional_emails', jsonb_build_object(
  'to', 'alisonlz7@icloud.com',
  'from', 'LZ7 Painel <notify@lz7energia.com.br>',
  'sender_domain', 'notify.lz7energia.com.br',
  'subject', 'Novo cadastro aguardando aprovação — Carlos Munhoz',
  'html', '<html><body style="font-family:Arial;padding:24px;max-width:600px;margin:auto"><h1 style="color:#0f172a">☀️ LZ7 Energia — Nova solicitação</h1><p>Um novo consultor solicitou acesso ao painel:</p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0"><p><strong>Nome:</strong> Carlos Munhoz</p><p><strong>Email:</strong> carlos.munhoz@lz7energia.com.br</p><p><strong>Unidade:</strong> Wenceslau Braz</p></div><div style="text-align:center;margin:24px 0"><a href="https://www.lz7energia.com.br/aprovar-usuario?token=8734bba1f0114f718fd868a35bd57d3a3e86b06591624bcf94d59ae895d9f644&d=approved" style="background:#16a34a;color:#fff;padding:12px 22px;border-radius:10px;font-weight:700;text-decoration:none;display:inline-block;margin:0 6px">✅ Aprovar</a><a href="https://www.lz7energia.com.br/aprovar-usuario?token=8734bba1f0114f718fd868a35bd57d3a3e86b06591624bcf94d59ae895d9f644&d=rejected" style="background:#dc2626;color:#fff;padding:12px 22px;border-radius:10px;font-weight:700;text-decoration:none;display:inline-block;margin:0 6px">❌ Rejeitar</a></div><p style="color:#64748b;font-size:12px">Painel: <a href="https://www.lz7energia.com.br/admin">lz7energia.com.br/admin</a></p></body></html>',
  'text', 'Novo consultor aguardando aprovação\n\nNome: Carlos Munhoz\nEmail: carlos.munhoz@lz7energia.com.br\nUnidade: Wenceslau Braz\n\nAprovar: https://www.lz7energia.com.br/aprovar-usuario?token=8734bba1f0114f718fd868a35bd57d3a3e86b06591624bcf94d59ae895d9f644&d=approved\nRejeitar: https://www.lz7energia.com.br/aprovar-usuario?token=8734bba1f0114f718fd868a35bd57d3a3e86b06591624bcf94d59ae895d9f644&d=rejected',
  'purpose', 'transactional',
  'label', 'aprovacao-carlos',
  'idempotency_key', 'aprovacao-carlos-' || gen_random_uuid()::text,
  'message_id', gen_random_uuid()::text,
  'unsubscribe_token', (SELECT token FROM public.email_unsubscribe_tokens WHERE email='alisonlz7@icloud.com' LIMIT 1),
  'queued_at', now()
));
