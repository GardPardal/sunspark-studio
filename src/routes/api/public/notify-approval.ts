import * as React from 'react'
import { render } from '@react-email/render'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { template as aprovacaoSolicitada } from '@/lib/email-templates/aprovacao-solicitada'

/**
 * Rota pública chamada logo após o cadastro público do consultor.
 * Envia um email para todos os admins avisando que há um novo pedido
 * de aprovação, com botões de aprovar/rejeitar via token.
 *
 * Público de propósito: no cadastro o usuário ainda não tem sessão.
 * Não retorna dados sensíveis.
 */
export const Route = createFileRoute('/api/public/notify-approval')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json({ error: 'server_misconfigured' }, { status: 500 })
        }

        let userId: string | undefined
        let email: string | undefined
        try {
          const body = await request.json()
          userId = body.userId
          email = body.email
        } catch {
          return Response.json({ error: 'invalid_body' }, { status: 400 })
        }
        if (!userId && !email) {
          return Response.json({ error: 'userId_or_email_required' }, { status: 400 })
        }

        const admin = createClient(supabaseUrl, supabaseServiceKey)

        // Busca a aprovação pendente
        let q = admin
          .from('account_approvals')
          .select('id,user_id,email,full_name,requested_unit,token,status')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
        if (userId) q = q.eq('user_id', userId)
        else if (email) q = q.eq('email', email)

        const { data: approval, error: apErr } = await q.maybeSingle()
        if (apErr || !approval) {
          return Response.json({ ok: false, reason: 'approval_not_found' }, { status: 404 })
        }

        // Descobre destinatários (admins)
        const { data: adminRoles } = await admin
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin')
        const adminIds = (adminRoles ?? []).map((r: any) => r.user_id)
        let recipients: string[] = []
        if (adminIds.length > 0) {
          const { data: profs } = await admin
            .from('profiles')
            .select('email')
            .in('id', adminIds)
          recipients = (profs ?? [])
            .map((p: any) => p.email)
            .filter((e: string | null): e is string => Boolean(e))
        }
        // Fallback: sempre inclui o email institucional
        if (!recipients.includes('alisonlz7@icloud.com')) recipients.push('alisonlz7@icloud.com')

        // URLs de decisão via token (rota pública já existente)
        const origin = new URL(request.url).origin
        const approveUrl = `${origin}/aprovar-usuario?token=${approval.token}&d=approved`
        const rejectUrl = `${origin}/aprovar-usuario?token=${approval.token}&d=rejected`
        const panelUrl = `${origin}/admin`

        // Renderiza o template uma vez
        const data = {
          fullName: approval.full_name ?? approval.email,
          email: approval.email,
          unit: approval.requested_unit ?? '—',
          approveUrl,
          rejectUrl,
          panelUrl,
        }
        const html = await render(React.createElement(aprovacaoSolicitada.component, data))
        const text = `Novo consultor aguardando aprovação\n\nNome: ${data.fullName}\nEmail: ${data.email}\nUnidade: ${data.unit}\n\nAprovar: ${data.approveUrl}\nRejeitar: ${data.rejectUrl}\nPainel: ${data.panelUrl}`
        const subject =
          typeof aprovacaoSolicitada.subject === 'function'
            ? aprovacaoSolicitada.subject(data) 
            : aprovacaoSolicitada.subject

        // Enfileira um email por destinatário
        const enqueued: string[] = []
        const errors: Array<{ to: string; error: string }> = []
        for (const to of recipients) {
          // Garante um unsubscribe_token para o destinatário
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
            const { data: inserted, error: tokErr } = await admin
              .from('email_unsubscribe_tokens')
              .insert({ email: to, token: newToken })
              .select('token')
              .maybeSingle()
            if (tokErr) {
              errors.push({ to, error: `unsubscribe_token_insert_failed: ${tokErr.message}` })
              continue
            }
            unsubToken = inserted?.token ?? newToken
          }

          const messageId = crypto.randomUUID()
          const payload = {
            to,
            from: `LZ7 Painel <notify@lz7energia.com.br>`,
            sender_domain: 'notify.lz7energia.com.br',
            subject,
            html,
            text,
            purpose: 'transactional',
            label: 'aprovacao-solicitada',
            idempotency_key: `approval-${approval.id}-${to}-${messageId}`,
            message_id: messageId,
            unsubscribe_token: unsubToken,
            queued_at: new Date().toISOString(),
          }
          const { error: enqErr } = await admin.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload,
          })
          if (!enqErr) enqueued.push(to)
          else errors.push({ to, error: enqErr.message })
        }

        return Response.json({ ok: true, enqueued_count: enqueued.length, enqueued, errors })
      },
    },
  },
})
