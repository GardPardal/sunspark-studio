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
  Button,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  fullName?: string
}

const Email = ({ fullName = 'time LZ7' }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu acesso ao painel LZ7 está liberado ⚡</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Hero */}
        <Section style={hero}>
          <Text style={badge}>⚡ LZ7 ENERGIA · SISTEMA</Text>
          <Heading style={h1}>Seu acesso está liberado</Heading>
          <Text style={heroSub}>
            Olá, {fullName}. Ajustamos a autenticação do painel — agora sua
            conta aprovada entra direto, sem erro de credenciais.
          </Text>
        </Section>

        {/* Card status */}
        <Section style={card}>
          <Text style={cardLabel}>STATUS DA SUA CONTA</Text>
          <Text style={cardValue}>● Ativa e pronta para uso</Text>
          <Hr style={hr} />
          <Text style={cardLabel}>O QUE MUDOU</Text>
          <Text style={cardText}>
            Toda aprovação (por e-mail ou painel) agora confirma o login
            automaticamente. Nada de "credenciais inválidas".
          </Text>
        </Section>

        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href="https://www.lz7energia.com.br/auth" style={btn}>
            Entrar no painel →
          </Button>
        </Section>

        <Text style={muted}>
          Se ainda tiver qualquer dificuldade, use "Esqueci minha senha" na
          tela de login ou responda este e-mail.
        </Text>

        {/* Assinatura tecnológica */}
        <Section style={signature}>
          <Hr style={hrGlow} />
          <Text style={sigName}>Alison Barbosa do Amaral</Text>
          <Text style={sigRole}>Analista de Marketing · LZ7 Energia</Text>
          <Text style={sigTag}>⟶ automação · dados · performance</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: '⚡ Seu acesso ao painel LZ7 foi liberado',
  displayName: 'Comunicado — acesso liberado',
  previewData: { fullName: 'Consultor LZ7' },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}
const container = { maxWidth: '580px', margin: '0 auto', padding: '32px 20px' }
const hero = {
  background:
    'linear-gradient(135deg, #0b1220 0%, #1e293b 55%, #f59e0b 140%)',
  borderRadius: '16px',
  padding: '32px 28px',
  color: '#ffffff',
}
const badge = {
  fontSize: '11px',
  letterSpacing: '.2em',
  color: '#fbbf24',
  margin: '0 0 12px',
  fontWeight: 700,
}
const h1 = {
  fontSize: '26px',
  lineHeight: '32px',
  color: '#ffffff',
  margin: '0 0 12px',
  fontWeight: 800,
}
const heroSub = {
  fontSize: '15px',
  lineHeight: '22px',
  color: '#cbd5e1',
  margin: 0,
}
const card = {
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '22px',
  backgroundColor: '#f8fafc',
  margin: '24px 0',
}
const cardLabel = {
  fontSize: '11px',
  letterSpacing: '.15em',
  color: '#64748b',
  margin: '0 0 6px',
  fontWeight: 700,
}
const cardValue = {
  fontSize: '16px',
  color: '#16a34a',
  margin: '0 0 4px',
  fontWeight: 700,
}
const cardText = { fontSize: '14px', color: '#0f172a', margin: 0, lineHeight: '20px' }
const hr = { borderColor: '#e2e8f0', margin: '16px 0' }
const btn = {
  background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
  color: '#ffffff',
  padding: '14px 28px',
  borderRadius: '12px',
  fontWeight: 800,
  textDecoration: 'none',
  display: 'inline-block',
  fontSize: '15px',
  letterSpacing: '.02em',
}
const muted = { fontSize: '13px', color: '#64748b', lineHeight: '20px' }
const signature = { marginTop: '32px', textAlign: 'center' as const }
const hrGlow = {
  border: 0,
  borderTop: '1px solid #f59e0b',
  margin: '20px auto 16px',
  width: '60%',
}
const sigName = {
  fontSize: '15px',
  color: '#0f172a',
  margin: '0 0 2px',
  fontWeight: 800,
}
const sigRole = { fontSize: '13px', color: '#334155', margin: '0 0 6px' }
const sigTag = {
  fontSize: '11px',
  letterSpacing: '.2em',
  color: '#f59e0b',
  margin: 0,
  fontWeight: 700,
}
