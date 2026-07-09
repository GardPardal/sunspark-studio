import type { ComponentType } from 'react'
import { template as aprovacaoSolicitada } from './aprovacao-solicitada'
import { template as novoLeadConsultor } from './novo-lead-consultor'
import { template as agendaCompromisso } from './agenda-compromisso'
import { template as agendaLembrete } from './agenda-lembrete'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'aprovacao-solicitada': aprovacaoSolicitada,
  'novo-lead-consultor': novoLeadConsultor,
  'agenda-compromisso': agendaCompromisso,
  'agenda-lembrete': agendaLembrete,
}
