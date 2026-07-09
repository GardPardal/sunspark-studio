import React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  consultor?: string
  lead_nome?: string
  lead_telefone?: string
  lead_cidade?: string
  lead_estado?: string
  lead_valor_conta?: string
  deadline?: string
  cta_url?: string
}

function formatBR(d?: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
  } catch { return d }
}

const Email = ({
  consultor = 'consultor',
  lead_nome = '—',
  lead_telefone = '—',
  lead_cidade = '—',
  lead_estado = '',
  lead_valor_conta = '—',
  deadline,
  cta_url = 'https://z7energia.lovable.app/crm',
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Novo lead LZ7 para {consultor} — 2h úteis pra confirmar</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🔥 Novo lead LZ7 na sua fila</Heading>
        <Text style={lead}>Olá {consultor}, um novo lead foi atribuído a você. Confirme o atendimento em até <strong>2 horas úteis</strong>, senão ele volta para a fila.</Text>

        <Section style={card}>
          <Text style={label}>Nome</Text><Text style={value}>{lead_nome}</Text>
          <Hr style={hr} />
          <Text style={label}>Telefone</Text><Text style={value}>{lead_telefone}</Text>
          <Hr style={hr} />
          <Text style={label}>Cidade</Text><Text style={value}>{lead_cidade}{lead_estado ? `/${lead_estado}` : ''}</Text>
          <Hr style={hr} />
          <Text style={label}>Conta de luz média</Text><Text style={value}>{lead_valor_conta}</Text>
          <Hr style={hr} />
          <Text style={label}>Prazo de confirmação</Text><Text style={valueBold}>{formatBR(deadline)}</Text>
        </Section>

        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={cta_url} style={btn}>Abrir lead no CRM</Button>
        </Section>

        <Text style={foot}>LZ7 Energia — este email foi disparado automaticamente pela roleta SDR.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: '🔥 Novo lead LZ7 — você tem 2h úteis pra confirmar',
  displayName: 'Novo lead para consultor',
  previewData: { consultor: 'João', lead_nome: 'Maria Silva', lead_telefone: '43 99999-0000', lead_cidade: 'Londrina', lead_estado: 'PR', lead_valor_conta: 'R$ 850', deadline: new Date(Date.now()+7200000).toISOString(), cta_url: '#' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', margin: '0 0 12px', color: '#0f172a' }
const lead = { fontSize: '14px', lineHeight: '22px', color: '#334155' }
const card = { border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', background: '#f8fafc', margin: '16px 0' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#64748b', margin: '4px 0' }
const value = { fontSize: '15px', margin: '0 0 8px', color: '#0f172a' }
const valueBold = { fontSize: '15px', fontWeight: 700 as const, margin: '0 0 8px', color: '#b91c1c' }
const hr = { borderColor: '#e2e8f0', margin: '8px 0' }
const btn = { background: '#f59e0b', color: '#0f172a', padding: '12px 22px', borderRadius: '10px', fontWeight: 700 as const, textDecoration: 'none', fontSize: '15px' }
const foot = { fontSize: '11px', color: '#94a3b8', textAlign: 'center' as const, marginTop: '16px' }
