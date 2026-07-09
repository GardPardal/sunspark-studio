import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export const Route = createFileRoute('/unsubscribe')({
  head: () => ({
    meta: [
      { title: 'Descadastro de emails — LZ7 Energia' },
      { name: 'robots', content: 'noindex,nofollow' },
      { name: 'description', content: 'Confirme seu descadastro dos emails da LZ7 Energia.' },
    ],
  }),
  component: UnsubscribePage,
})

function UnsubscribePage() {
  const [state, setState] = useState<'loading' | 'valid' | 'already' | 'invalid' | 'done' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const token = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null

  useEffect(() => {
    if (!token) { setState('invalid'); return }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((r) => {
        if (r?.valid) setState('valid')
        else if (r?.reason === 'already_unsubscribed') setState('already')
        else setState('invalid')
      })
      .catch(() => setState('error'))
  }, [token])

  const confirm = async () => {
    if (!token) return
    setBusy(true)
    try {
      const r = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const j = await r.json()
      if (j?.success) setState('done')
      else if (j?.reason === 'already_unsubscribed') setState('already')
      else setState('error')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full p-8 space-y-4 text-center">
        <h1 className="text-xl font-semibold">Descadastro de emails</h1>
        {state === 'loading' && <p className="text-sm text-muted-foreground">Verificando…</p>}
        {state === 'valid' && (
          <>
            <p className="text-sm text-muted-foreground">Confirme para parar de receber emails da LZ7 Energia neste endereço.</p>
            <Button onClick={confirm} disabled={busy} className="w-full">
              {busy ? 'Enviando…' : 'Confirmar descadastro'}
            </Button>
          </>
        )}
        {state === 'done' && <p className="text-sm">Pronto! Você não receberá mais nossos emails.</p>}
        {state === 'already' && <p className="text-sm">Este email já estava descadastrado.</p>}
        {state === 'invalid' && <p className="text-sm text-destructive">Link inválido ou expirado.</p>}
        {state === 'error' && <p className="text-sm text-destructive">Não foi possível concluir. Tente novamente.</p>}
      </Card>
    </div>
  )
}
