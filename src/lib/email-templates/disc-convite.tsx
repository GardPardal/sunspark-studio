import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  fullName?: string
  jobTitle?: string
  link?: string
  expiresAt?: string
  minutes?: number
}

const Email = ({
  fullName = 'Olá',
  jobTitle = 'nosso processo seletivo',
  link = 'https://www.lz7energia.com.br',
  expiresAt,
  minutes = 10,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Avaliação comportamental — {jobTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>☀️ LZ7 Energia</Heading>
        <Text style={lead}>
          {fullName}, tudo bem? Você avançou em {jobTitle} e o próximo passo é uma avaliação
          comportamental interna, baseada no modelo DISC.
        </Text>
        <Text style={lead}>
          São cerca de {minutes} minutos, pelo celular mesmo. Não existe resposta certa ou errada — ela é
          complementar e não decide sozinha o resultado do processo.
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
          <a href={link} style={button}>
            Começar avaliação
          </a>
        </Section>
        {expiresAt ? <Text style={muted}>Este link é individual e vale até {expiresAt}.</Text> : null}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Avaliação comportamental — ${d.jobTitle ?? 'LZ7 Energia'}`,
  displayName: 'Convite de avaliação comportamental',
  previewData: { fullName: 'Maria', jobTitle: 'Consultor de vendas', link: 'https://exemplo.com' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const h1 = { fontSize: '20px', color: '#0f172a', margin: '0 0 12px' }
const lead = { fontSize: '15px', color: '#334155', lineHeight: '22px' }
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
