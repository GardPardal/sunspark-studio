import React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

type Msg = { role: string; content: string }

interface Props {
  session_id?: string
  user_email?: string | null
  user_name?: string | null
  mode?: string
  page_url?: string | null
  first_at?: string
  updated_at?: string
  message_count?: number
  messages?: Msg[]
}

function fmt(d?: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) } catch { return d }
}

const Email = ({ session_id='—', user_email, user_name, mode='capture', page_url, first_at, updated_at, message_count=0, messages=[] }: Props) => (
  <Html lang="pt-BR"><Head /><Preview>Conversa da LIZ — {user_name || user_email || session_id}</Preview>
    <Body style={main}><Container style={container}>
      <Heading style={h1}>💬 Histórico da conversa com a LIZ</Heading>
      <Section style={card}>
        <Text style={label}>Usuário</Text>
        <Text style={value}>{user_name || '(anônimo)'} {user_email ? `· ${user_email}` : ''}</Text><Hr style={hr}/>
        <Text style={label}>Modo</Text><Text style={value}>{mode === 'internal' ? 'Painel interno' : 'Landing / captura'}</Text><Hr style={hr}/>
        <Text style={label}>Sessão</Text><Text style={value}>{session_id}</Text><Hr style={hr}/>
        <Text style={label}>Início</Text><Text style={value}>{fmt(first_at)}</Text><Hr style={hr}/>
        <Text style={label}>Última mensagem</Text><Text style={value}>{fmt(updated_at)}</Text><Hr style={hr}/>
        <Text style={label}>Total de mensagens</Text><Text style={value}>{message_count}</Text>
        {page_url && (<><Hr style={hr}/><Text style={label}>Página</Text><Text style={value}>{page_url}</Text></>)}
      </Section>
      <Heading style={h2}>Conversa</Heading>
      {messages.map((m, i) => (
        <Section key={i} style={m.role === 'user' ? userBubble : botBubble}>
          <Text style={role}>{m.role === 'user' ? '👤 Usuário' : '🤖 LIZ'}</Text>
          <Text style={msgText}>{m.content}</Text>
        </Section>
      ))}
    </Container></Body></Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `💬 Conversa LIZ — ${d.user_name || d.user_email || d.session_id || 'anônimo'}`,
  displayName: 'LIZ — histórico de conversa',
  to: 'alison.amaral@lz7energia.com.br',
  previewData: {
    session_id: 'demo-123', user_name: 'Maria Silva', mode: 'capture', message_count: 4,
    first_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    messages: [
      { role: 'assistant', content: 'Oi! Sou a LIZ. Qual seu nome?' },
      { role: 'user', content: 'Maria' },
      { role: 'assistant', content: 'Prazer, Maria! Qual sua cidade?' },
      { role: 'user', content: 'Londrina' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '640px', margin: '0 auto' }
const h1 = { fontSize: '22px', margin: '0 0 12px', color: '#0f172a' }
const h2 = { fontSize: '16px', margin: '24px 0 12px', color: '#0f172a' }
const card = { border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', background: '#f8fafc', margin: '16px 0' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#64748b', margin: '4px 0' }
const value = { fontSize: '14px', margin: '0 0 8px', color: '#0f172a' }
const hr = { borderColor: '#e2e8f0', margin: '8px 0' }
const userBubble = { background: '#eff6ff', borderRadius: '10px', padding: '10px 14px', margin: '6px 0' }
const botBubble = { background: '#f1f5f9', borderRadius: '10px', padding: '10px 14px', margin: '6px 0' }
const role = { fontSize: '11px', color: '#64748b', margin: '0 0 4px', fontWeight: 700 as const }
const msgText = { fontSize: '14px', color: '#0f172a', margin: 0, whiteSpace: 'pre-wrap' as const }
