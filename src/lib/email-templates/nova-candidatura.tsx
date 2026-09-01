import React from 'react'
import {
  Body,
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
  kind?: string
  jobTitle?: string
  fullName?: string
  email?: string
  phone?: string
  city?: string
  state?: string
  linkedin?: string
  experience?: string
  hasResume?: boolean
  resumeName?: string
  appliedAt?: string
  answers?: Array<{ q: string; a: string }>
  panelUrl?: string
}

const Row = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
      <Hr style={hr} />
    </>
  ) : null

const Email = ({
  kind = 'talentos',
  jobTitle = 'Banco de talentos',
  fullName = '—',
  email = '—',
  phone = '—',
  city,
  state,
  linkedin,
  experience,
  hasResume = false,
  resumeName,
  appliedAt,
  answers = [],
  panelUrl = 'https://www.lz7energia.com.br/mod/rh',
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      Nova candidatura — {fullName} ({jobTitle})
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>☀️ LZ7 Energia — Nova candidatura</Heading>
        <Text style={lead}>
          {kind === 'vaga'
            ? `Candidatura recebida para a vaga: ${jobTitle}.`
            : 'Novo currículo cadastrado no banco de talentos.'}
        </Text>

        <Section style={card}>
          <Row label="Nome" value={fullName} />
          <Row label="Vaga" value={jobTitle} />
          <Row label="Data da inscrição" value={appliedAt} />
          <Row label="E-mail" value={email} />
          <Row label="WhatsApp" value={phone} />
          <Row label="Cidade" value={[city, state].filter(Boolean).join(' - ')} />
          <Row label="LinkedIn" value={linkedin} />
          <Row label="Experiência" value={experience} />
          <Text style={valueStyle}>
            {hasResume
              ? `Currículo anexado${resumeName ? `: ${resumeName}` : ''} — disponível no painel, com acesso autenticado.`
              : 'Sem currículo anexado.'}
          </Text>
        </Section>

        {answers.length ? (
          <Section style={card}>
            <Text style={h2}>Respostas do formulário do RH</Text>
            {answers.map((item) => (
              <div key={item.q}>
                <Text style={labelStyle}>{item.q}</Text>
                <Text style={valueStyle}>{item.a}</Text>
              </div>
            ))}
          </Section>
        ) : null}

        <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
          <a href={panelUrl} style={button}>
            Abrir candidatura e currículo
          </a>
        </Section>

        <Text style={muted}>
          O currículo e as observações internas só abrem para quem tem acesso ao painel de RH.
        </Text>
      </Container>
    </Body>
  </Html>
)


export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Nova candidatura — ${d.fullName ?? 'candidato'} (${d.jobTitle ?? 'Banco de talentos'})`,
  displayName: 'Nova candidatura (RH)',
  previewData: {
    kind: 'vaga',
    jobTitle: 'Consultor de vendas',
    fullName: 'Fulano de Tal',
    email: 'fulano@exemplo.com',
    phone: '(43) 99999-9999',
    city: 'Londrina',
    state: 'PR',
    experience: '3 anos em vendas externas.',
    hasResume: true,
    resumeName: 'curriculo.pdf',
    appliedAt: '01/09/2026 09:00',
    answers: [{ q: 'Qual sua escolaridade?', a: 'Superior completo' }],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const h1 = { fontSize: '20px', color: '#0f172a', margin: '0 0 12px' }
const h2 = { fontSize: '14px', color: '#0f172a', margin: '0 0 12px', fontWeight: 700 }
const lead = { fontSize: '15px', color: '#334155', lineHeight: '22px' }
const card = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '20px',
  backgroundColor: '#f8fafc',
  margin: '20px 0',
}
const labelStyle = {
  fontSize: '12px',
  color: '#64748b',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '.05em',
}
const valueStyle = { fontSize: '15px', color: '#0f172a', margin: '0 0 8px', fontWeight: 600 }
const hr = { borderColor: '#e2e8f0', margin: '10px 0' }
const link = { color: '#f59e0b' }
const muted = { fontSize: '12px', color: '#64748b', marginTop: '20px' }
const button = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  padding: '14px 28px',
  borderRadius: '10px',
  fontSize: '15px',
  fontWeight: 700,
  textDecoration: 'none',
  display: 'inline-block',
}
