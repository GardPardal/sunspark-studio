import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  fullName?: string
  email?: string
  unit?: string
  approveUrl?: string
  rejectUrl?: string
  panelUrl?: string
}

const Email = ({
  fullName = 'Novo consultor',
  email = '—',
  unit = '—',
  approveUrl = '#',
  rejectUrl = '#',
  panelUrl = 'https://www.lz7energia.com.br/admin',
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Novo consultor aguardando aprovação — {fullName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>☀️ LZ7 Energia — Painel Administrativo</Heading>
        <Text style={lead}>
          Um novo consultor solicitou acesso ao painel e está aguardando sua
          aprovação.
        </Text>

        <Section style={card}>
          <Text style={label}>Nome</Text>
          <Text style={value}>{fullName}</Text>
          <Hr style={hr} />
          <Text style={label}>E-mail</Text>
          <Text style={value}>{email}</Text>
          <Hr style={hr} />
          <Text style={label}>Unidade solicitada</Text>
          <Text style={value}>{unit}</Text>
        </Section>

        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={approveUrl} style={btnApprove}>
            ✅ Aprovar acesso
          </Button>
          <Button href={rejectUrl} style={btnReject}>
            ❌ Rejeitar
          </Button>
        </Section>

        <Text style={muted}>
          Você também pode gerenciar aprovações direto no painel:{' '}
          <a href={panelUrl} style={{ color: '#f59e0b' }}>
            {panelUrl}
          </a>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Novo cadastro aguardando aprovação — ${d.fullName ?? 'consultor'}`,
  displayName: 'Solicitação de aprovação (admin)',
  previewData: {
    fullName: 'Fulano de Tal',
    email: 'fulano@exemplo.com',
    unit: 'londrina',
    approveUrl: 'https://www.lz7energia.com.br/aprovar-usuario?token=abc',
    rejectUrl: 'https://www.lz7energia.com.br/aprovar-usuario?token=abc',
    panelUrl: 'https://www.lz7energia.com.br/admin',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const h1 = { fontSize: '20px', color: '#0f172a', margin: '0 0 12px' }
const lead = { fontSize: '15px', color: '#334155', lineHeight: '22px' }
const card = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '20px',
  backgroundColor: '#f8fafc',
  margin: '20px 0',
}
const label = { fontSize: '12px', color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '.05em' }
const value = { fontSize: '15px', color: '#0f172a', margin: '0 0 8px', fontWeight: 600 }
const hr = { borderColor: '#e2e8f0', margin: '10px 0' }
const btnApprove = {
  backgroundColor: '#16a34a',
  color: '#ffffff',
  padding: '12px 22px',
  borderRadius: '10px',
  fontWeight: 700,
  textDecoration: 'none',
  display: 'inline-block',
  margin: '0 6px',
}
const btnReject = {
  backgroundColor: '#dc2626',
  color: '#ffffff',
  padding: '12px 22px',
  borderRadius: '10px',
  fontWeight: 700,
  textDecoration: 'none',
  display: 'inline-block',
  margin: '0 6px',
}
const muted = { fontSize: '12px', color: '#64748b', marginTop: '20px' }
