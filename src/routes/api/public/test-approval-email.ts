import * as React from 'react'
import { render } from '@react-email/render'
import { EmailAPIError, sendLovableEmail } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { template as aprovacaoSolicitada } from '@/lib/email-templates/aprovacao-solicitada'

/**
 * Rota de teste manual para disparar o template de aprovação.
 *
 * Uso:
 *   GET  /api/public/test-approval-email?to=alisonlz7@icloud.com
 *   POST /api/public/test-approval-email  { "to": "alisonlz7@icloud.com" }
 *
 * Envia 1 email de exemplo (dados fake) e retorna o status.
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
  const apiKey = process.env['LOVABLE_API_KEY']
  if (!apiKey) {
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
  const element = React.createElement(aprovacaoSolicitada.component, data)
  const html = await render(element)
  const text = `TESTE — Novo consultor aguardando aprovação\n\nNome: ${data.fullName}\nEmail: ${data.email}\nUnidade: ${data.unit}\n\nAprovar: ${data.approveUrl}\nRejeitar: ${data.rejectUrl}\nPainel: ${data.panelUrl}`
  const subject = `[TESTE] ${
    typeof aprovacaoSolicitada.subject === 'function'
      ? aprovacaoSolicitada.subject(data)
      : aprovacaoSolicitada.subject
  }`

  const messageId = crypto.randomUUID()

  try {
    await sendLovableEmail(
      {
        to,
        from: 'LZ7 Painel <notify@lz7energia.com.br>',
        sender_domain: 'notify.lz7energia.com.br',
        subject,
        html,
        text,
        purpose: 'transactional',
        label: 'aprovacao-solicitada-teste',
        idempotency_key: `test-approval-${messageId}`,
      },
      { apiKey, sendUrl: process.env['LOVABLE_SEND_URL'] },
    )
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      return Response.json({ ok: false, to, reason: 'recipient_suppressed' })
    }
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'send_failed' },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, to, message_id: messageId })
}
