import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/ensure-approved-login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json({ ok: false }, { status: 500 })
        }

        let email = ''
        try {
          const body = await request.json()
          email = String(body.email ?? '').trim().toLowerCase()
        } catch {
          return Response.json({ ok: true })
        }
        if (!email || email.length > 254 || !email.includes('@')) {
          return Response.json({ ok: true })
        }

        const admin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })

        let page = 1
        let user: { id: string; email?: string | null } | undefined
        while (!user) {
          const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
          if (error) return Response.json({ ok: true })
          user = (data.users ?? []).find((item) => item.email?.toLowerCase() === email)
          if (user || !data.users || data.users.length < 1000) break
          page += 1
        }
        if (!user) return Response.json({ ok: true })

        const [{ data: profile }, { data: approval }] = await Promise.all([
          admin.from('profiles').select('status').eq('id', user.id).maybeSingle(),
          admin
            .from('account_approvals')
            .select('status')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        const isApproved = profile?.status === 'active' || approval?.status === 'approved'
        if (isApproved) {
          await admin.auth.admin.updateUserById(user.id, { email_confirm: true })
        }

        return Response.json({ ok: true })
      },
    },
  },
})