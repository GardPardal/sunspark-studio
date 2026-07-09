import * as React from 'react'
import { render } from '@react-email/render'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { template as aprovacaoSolicitada } from '@/lib/email-templates/aprovacao-solicitada'

/**
 * Rota de teste manual para disparar o template de aprovação.
 *
 * Uso:
 *   GET  /api/public/test-approval-email?to=alisonlz7@icloud.com
 *   POST /api/public/test-approval-email  { "to": "alisonlz7@icloud.com" }
 *
 * Enfileira 1 email de exemplo (dados fake) e retorna o status.
 * Não depende de nenhum registro em account_approvals.
 */
export const Route = createFileRoute('/api/public/test-approval-email')({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
})

async function handle(request: Request) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  const url = new URL(request.url)
  let to = url.searchParams.get('to') ?? undefined
  if (!to && request.method === 'POST') {
    try {
      const body = await request.json()
      to = body?.to
    } catch {}
  }
  if (!to) to = 'alisonlz7@icloud.com'

  const origin = url.origin
  const data = {
    fullName: 'TESTE — Consultor Fictício',
    email: 'teste@example.com',
    unit: 'wenceslau_braz',
    approveUrl: `${origin}/aprovar-usuario?token=TESTE&d=approved`,
    rejectUrl: `${origin}/aprovar-usuario?token=TESTE&d=rejected`,
    panelUrl: `${origin}/admin`,
  }
  const html = await render(React.createElement(aprovacaoSolicitada.component, data))
  const text = `TESTE — Novo consultor aguardando aprovação\n\nNome: ${data.fullName}\nEmail: ${data.email}\nUnidade: ${data.unit}\n\nAprovar: ${data.approveUrl}\nRejeitar: ${data.rejectUrl}\nPainel: ${data.panelUrl}`
  const subject = `[TESTE] ${
    typeof aprovacaoSolicitada.subject === 'function'
      ? aprovacaoSolicitada.subject(data)
      : aprovacaoSolicitada.subject
  }`

  const admin = createClient(supabaseUrl, supabaseServiceKey)

  // Garante unsubscribe_token
  let unsubToken: string | null = null
  const { data: existing } = await admin
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', to)
    .maybeSingle()
  if (existing?.token) {
    unsubToken = existing.token
  } else {
    const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const { data: inserted } = await admin
      .from('email_unsubscribe_tokens')
      .insert({ email: to, token: newToken })
      .select('token')
      .maybeSingle()
    unsubToken = inserted?.token ?? newToken
  }

  const messageId = crypto.randomUUID()
  const payload = {
    to,
    from: 'LZ7 Painel <notify@lz7energia.com.br>',
    sender_domain: 'notify.lz7energia.com.br',
    subject,
    html,
    text,
    purpose: 'transactional',
    label: 'aprovacao-solicitada-teste',
    idempotency_key: `test-approval-${messageId}`,
    message_id: messageId,
    unsubscribe_token: unsubToken,
    queued_at: new Date().toISOString(),
  }

  const { data: enq, error } = await admin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload,
  })
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true, to, message_id: messageId, msg_id: enq })
}
