# Solar OS — Simplificação radical de uso (sem remover nada)

## 1. Inventário atual (o que existe hoje)

**Rotas públicas (críticas, não serão tocadas):** `/`, `/quiz`, `/wpp`, `/captura`, `/auth`, `/bi`, `/aprovar-usuario`, `/redefinir-senha`, `/unsubscribe`, `/sitemap.xml`, `/mcp`, e todo `/api/public/*`, `/lovable/email/*`.

**Rotas autenticadas:** `/hoje`, `/crm`, `/leads`, `/agenda`, `/coordenacao`, `/ranking`, `/sdr-leadqualified`, `/marketing-hub`, `/liz-studio`, `/admin`, `/app`, `/baixar-app`, `/inventario`, `/vendas` (portal com login próprio).

**Segunda navegação `/mod/*`:** marketing, ia, bi, financeiro, admin, saude, automacoes, chamados, auditoria, responsaveis, meta-debug, meta-conversions, ploomes-integracao, whatsapp (index/config/conhecimento), design-system, index.

**Navegação atual:** `backend-shell.tsx` com 5 abas fixas (Hoje · Trabalho · Marketing · Inteligência · Gestão) + `module-shell.tsx` com sidebar própria de 15 módulos — é essa duplicidade que dá a sensação de "dois sistemas".

## 2. O que será reorganizado

| Área | Mudança |
|---|---|
| Navegação | Um único mapa de navegação derivado de `user_roles`; `/mod/*` passa a usar o mesmo shell e some da barra principal para quem não é admin/coord |
| `/hoje` | Vira o centro operacional real: resumo do dia + fila "Faça agora" com próxima ação por cliente |
| Clientes | Nova visão única `/clientes` que consolida visualmente CRM + Leads (mesmas tabelas, mesmos stages, nada migrado) |
| Cliente 360 | `/clientes/$id` — cabeçalho + próxima ação + ações rápidas + timeline/agenda/venda/conversas na mesma página |
| Interação | Diálogo curto "O que aconteceu?" que dispara as regras de stage já existentes |
| Coordenação | Painel visual de disponibilidade por unidade, sem mudar roleta/prioridade/congelamento |
| Marketing | Agrupamento em Visão geral / Campanhas / Leads / Conversões / Meta / Integrações; Meta Debug e afins vão para "Diagnóstico" |
| Ranking / Vendas / Financeiro | Só entrada e leitura mais claras; regras intactas |
| Mobile | Tabelas viram cards, botões grandes, WhatsApp/Ligar sempre a um toque |

## 3. Páginas que NÃO serão alteradas

`/quiz` (congelada), `/wpp`, `/captura`, `/`, `/auth`, `/bi` público, `/api/public/*`, `/vendas` (autenticação própria preservada — muda só a forma de chegar até ela), MCP, e-mails, webhooks, crons, triggers, RLS.

## 4. Risco em componentes compartilhados

`/quiz` importa apenas: `@tanstack/react-router`, `react`, `lucide-react`, `@/lib/tracking` e `@/lib/site-settings`. **Nenhum** desses será modificado. `/quiz` não usa `backend-shell`, `module-shell`, DS novo nem middlewares autenticados — o raio de alcance da refatoração (shells autenticados, rotas `_authenticated/*`, novos componentes) não cruza com ela.

Riscos reais mapeados: `src/styles.css` (tokens globais — só adições, nunca alteração de token existente), `__root.tsx` (não será tocado), `src/lib/tracking.ts` e `site-settings` (congelados).

## 5. Proteção do /quiz

- `src/routes/quiz.tsx`, `src/lib/tracking.ts`, `src/lib/site-settings*.ts` tratados como read-only.
- Checagem automatizada em cada fase: `GET /quiz` retorna 200, formulário renderiza, número de WhatsApp e regras de qualificação (≥ R$190, PR/SP) inalterados, parâmetros UTM preservados.
- Nenhuma mudança em build, providers, root ou CSS existente.

## 6. Consolidação Leads + CRM

Uma tela `Clientes` lê as mesmas fontes atuais (tabela `leads` com `stage`, respeitando RLS) e apresenta filtros: Todos · Novos · Em atendimento · Follow-up · Proposta · Negociação · Venda · Faturados · Perdidos · Não atendidos. `/crm` e `/leads` continuam existindo e funcionando como estão (fallback), apenas deixam de ser o caminho principal.

## 7. Menu por papel

- **Consultor:** Hoje · Clientes · Agenda · Resultados
- **SDR:** Hoje · Leads · Qualificação · Agenda
- **Coordenador:** Hoje · Equipe · Clientes · Distribuição · Resultados
- **Marketing:** Hoje · Campanhas · Leads · Meta · Inteligência
- **Admin:** tudo acima + área "Administração" (usuários, unidades, permissões, integrações, Ploomes, Meta, WhatsApp, automações, auditoria, logs, inventário, chamados, ferramentas técnicas)

Rotas antigas permanecem acessíveis por URL direta e pela busca ⌘K.

## 8. Riscos encontrados

1. Duas navegações concorrentes (shell + module-shell) — resolvido por unificação visual, sem apagar `/mod/*`.
2. Três fontes de venda (`manual_sales`, `finance_sales`, Ploomes) — nesta etapa apenas documentar e criar camada de leitura normalizada; **nenhuma** migração.
3. `/vendas` tem sessão própria por cookie — só melhoraremos a entrada; login intacto.
4. `_authenticated/route.tsx` faz redirects por pathname — alterações aqui precisam de teste de login em cada papel.
5. Performance de `/hoje` — a fila usará uma única server function agregada, com cache do React Query.

## 9. Ordem de execução

0. Mapa + checklist de regressão (feito acima)
1. Proteção e verificação inicial de `/quiz` e login
2. Navegação por papel (unificação dos shells)
3. `/hoje` como centro operacional
4. `Clientes` (consolidação visual)
5. Cliente 360
6. Próxima ação + ações rápidas + diálogo "O que aconteceu?"
7. Áreas gerenciais (Coordenação, Marketing, Financeiro, Admin)
8. Mobile
9. Regressão completa

Após cada fase: validar `/quiz`, login, permissões/RLS, entrada de leads, Ploomes, Meta CAPI, WhatsApp, agenda, distribuição, ranking, vendas.

## Notas técnicas

Nenhuma migração destrutiva. Se precisar de banco, apenas aditivo (view/função/coluna nullable). Frontend novo em `src/modules/*` reutilizando as server functions existentes (`crm.functions.ts`, `sdr-leads.functions.ts`, `agenda.functions.ts`, `priority.functions.ts`, `solar-os.functions.ts`), sem `supabaseAdmin` no cliente.
