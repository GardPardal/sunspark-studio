import React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  consultor?: string
  title?: string
  tipo?: string
  starts_at?: string
  ends_at?: string
  notes?: string
  lead_nome?: string
  cta_url?: string
}

function fmt(d?: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) } catch { return d }
}

const Email = ({ consultor='consultor', title='Compromisso', tipo='ligacao', starts_at, ends_at, notes, lead_nome, cta_url='https://z7energia.lovable.app/agenda' }: Props) => (
  <Html lang="pt-BR"><Head /><Preview>Novo compromisso na sua agenda LZ7</Preview>
    <Body style={main}><Container style={container}>
      <Heading style={h1}>📅 Novo compromisso na sua agenda</Heading>
      <Text style={lead}>Olá {consultor}, um compromisso foi agendado para você.</Text>
      <Section style={card}>
        <Text style={label}>Título</Text><Text style={value}>{title}</Text><Hr style={hr}/>
        <Text style={label}>Tipo</Text><Text style={value}>{tipo}</Text><Hr style={hr}/>
        <Text style={label}>Início</Text><Text style={valueBold}>{fmt(starts_at)}</Text><Hr style={hr}/>
        <Text style={label}>Fim</Text><Text style={value}>{fmt(ends_at)}</Text>
        {lead_nome && (<><Hr style={hr}/><Text style={label}>Lead</Text><Text style={value}>{lead_nome}</Text></>)}
        {notes && (<><Hr style={hr}/><Text style={label}>Observações</Text><Text style={value}>{notes}</Text></>)}
      </Section>
      <Section style={{textAlign:'center',margin:'24px 0'}}><Button href={cta_url} style={btn}>Ver na agenda</Button></Section>
    </Container></Body></Html>
)
export const template = { component: Email, subject: '📅 Novo compromisso na sua agenda', displayName: 'Agenda — compromisso criado', previewData: { consultor:'João', title:'Visita técnica — Maria', tipo:'visita_tecnica', starts_at:new Date().toISOString(), ends_at:new Date(Date.now()+3600000).toISOString(), lead_nome:'Maria Silva' } } satisfies TemplateEntry

const main = { backgroundColor:'#ffffff', fontFamily:'Arial, sans-serif' }
const container = { padding:'24px', maxWidth:'560px', margin:'0 auto' }
const h1 = { fontSize:'22px', margin:'0 0 12px', color:'#0f172a' }
const lead = { fontSize:'14px', color:'#334155' }
const card = { border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px 20px', background:'#f8fafc', margin:'16px 0' }
const label = { fontSize:'11px', textTransform:'uppercase' as const, letterSpacing:'0.05em', color:'#64748b', margin:'4px 0' }
const value = { fontSize:'15px', margin:'0 0 8px', color:'#0f172a' }
const valueBold = { fontSize:'15px', fontWeight:700 as const, margin:'0 0 8px', color:'#0f172a' }
const hr = { borderColor:'#e2e8f0', margin:'8px 0' }
const btn = { background:'#0f172a', color:'#ffffff', padding:'12px 22px', borderRadius:'10px', fontWeight:700 as const, textDecoration:'none', fontSize:'15px' }
