# Plano — Sistema Operacional Comercial (Fase 0: Auditoria e Fundação)

## Princípio inegociável
Nada é removido. Toda evolução é aditiva. Rotas, tabelas, funções e permissões existentes permanecem 100% funcionais. Onde houver duplicidade, a versão antiga fica viva como "legado" enquanto a nova é validada.

---

## Etapa 1 — Auditoria automatizada (entregue como relatório interno)

Gerar em `/_authenticated/mod/auditoria` (novo, aditivo) um relatório vivo que mapeia:

1. **Inventário de rotas** — varredura de `src/routes/**` classificando cada rota por: perfil que acessa, objetivo do usuário, módulo atual, status (ativa / órfã / duplicada).
2. **Inventário de server functions** — todas as `*.functions.ts` com: chamadores, tabelas tocadas, permissão exigida.
3. **Inventário de tabelas e políticas RLS** — cruzamento com `supabase-tables` já em contexto.
4. **Inventário de componentes** — detecção de componentes com nomes/props similares (candidatos a unificação na biblioteca).
5. **Fluxos por perfil** — Admin, Diretor, Coordenador, SDR, Consultor: sequência real de telas usadas hoje.
6. **Gargalos e redundâncias** — telas que só redirecionam, botões sem handler, rotas sem link de entrada, menus repetidos.
7. **Saúde técnica** — erros recentes (`console`, edge logs, `integration_sync_log`, `email_send_log`), consultas lentas, integrações com falha.

Saída: JSON persistido + visualização. Base para todas as decisões seguintes.

## Etapa 2 — Fundação da nova navegação (aditiva, sem apagar a antiga)

Criar shell paralelo `SOShell` com 4 áreas — **Operação, Marketing, Inteligência, Gestão** — cada item apenas *aponta* para as rotas já existentes (nenhuma rota é movida ou renomeada nesta fase). Menu antigo continua acessível via toggle "Ver navegação clássica".

Mapa inicial (todos os destinos já existem no projeto):

- **Operação**: Hoje, Minha Agenda, Leads, Pipeline, Distribuição/Roleta, Liberação de contas, Visitas, Consultores, SDR, Equipe.
- **Marketing**: Meta Ads (painel real-time), Criativos, Campanhas, Marketing Hub, CAPI, Landing editável.
- **Inteligência**: Insights IA, BI por perfil, Diagnóstico de campanhas, Forecast, Liz IA do time, LIZ Studio.
- **Gestão**: Financeiro (KPIs), Usuários, Permissões, Integrações, Saúde do Sistema, Logs, Auditoria, Configurações, APIs/MCP.

## Etapa 3 — Home = Centro de Operações por perfil

Nova Home `src/routes/_authenticated/hoje.tsx` (a antiga `/app` continua intocada). Uma pergunta só: *"O que preciso fazer agora?"*.

Cartões inteligentes gerados por uma nova server fn `getPriorityCards({ userId, role })` que consulta em tempo real:

- Leads aguardando distribuição (por unidade quando aplicável).
- Consultores sem agenda hoje / amanhã.
- Campanhas com ROAS caindo (usa `diagnostico.functions.ts` existente).
- Propostas/atendimentos vencendo (usa `atendimento_deadline`).
- Integrações com erro (usa `integration_sync_log` + `meta_sync_state`).
- Contas pendentes de aprovação.
- Leads parados no pipeline > X dias.

Cada card tem UM botão "Resolver agora" que navega direto para a tela de resolução com filtros pré-aplicados via search params.

Perfis com Home dedicada: Admin, Coordenador, Consultor, SDR. Diretor herda de Admin com filtros de leitura.

## Etapa 4 — Motor de Autodiagnóstico (aditivo)

Nova tabela `system_diagnostics` (severidade, origem, mensagem, sugestão, status, criado_em) + server fn de coleta acionada:

- Ao iniciar sessão (varredura leve).
- Via cron `pg_cron` a cada 15 min (varredura completa: integrações, filas de e-mail, jobs, RLS órfãos).
- Sob demanda no painel Saúde.

Cada finding vira card em **Gestão → Saúde do Sistema** com ação "Corrigir" quando existir remediação segura (ex.: reprocessar e-mail travado, reenfileirar sync Meta).

## Etapa 5 — Biblioteca de componentes unificada

Criar `src/components/ui-kit/` reexportando/consolidando os padrões atuais (Card, StatCard, DataTable, Filter, EmptyState, ActionCard, PriorityCard). Componentes antigos continuam funcionando; novas telas usam a lib. Migração é oportunística, nunca forçada.

## Etapa 6 — Busca global + comandos rápidos

Adicionar `⌘K` global (aditivo, não substitui nada): busca em leads, clientes, campanhas, rotas, ações. Ativo em toda a shell nova.

## Etapa 7 — Ciclo contínuo

Ao final de cada etapa: rodar a auditoria da Etapa 1 novamente, comparar delta, registrar em `system_diagnostics` o que melhorou e o que ainda pende. Nada é dado como pronto sem esse ciclo.

---

## Detalhes técnicos

- **Sem breaking changes**: novas rotas ficam em `/_authenticated/hoje`, `/_authenticated/mod/auditoria`, `/_authenticated/mod/saude` (a última já existe — apenas evolui). Shell novo é opt-in via feature flag em `site_settings` (chave `so_shell_enabled`) — default OFF até validação por perfil.
- **Server functions novas**: `src/modules/audit/*.functions.ts`, `src/modules/hoje/priority.functions.ts`, `src/modules/health/diagnostics.functions.ts`. Todas com `.middleware([requireSupabaseAuth])`.
- **Migrações**: apenas `CREATE TABLE IF NOT EXISTS system_diagnostics` + GRANTs + RLS (`is_admin_or_coord`). Nenhuma alteração destrutiva.
- **Perfis**: reusa `has_role` e `current_user_roles` existentes. Nenhuma permissão nova, nenhuma removida.
- **Feature flag**: usuário admin ativa o novo shell para si primeiro; validado por perfil antes de virar default global.

## Entregável desta primeira rodada (se aprovado)

1. Etapa 1 completa (auditoria rodando + relatório navegável).
2. Etapa 2 esqueleto (SOShell + mapa de 4 áreas, atrás da flag).
3. Etapa 3 Home do Admin e do Consultor (SDR e Coordenador na rodada seguinte).
4. Etapa 4 tabela + coletor mínimo (integrações + filas de e-mail).

Etapas 5–7 entram em rodadas subsequentes, cada uma precedida de nova auditoria comparativa.

## Fora de escopo desta rodada

- Renomear/mover rotas existentes.
- Alterar regras de negócio de roleta, aprovação, cadastro, CAPI.
- Redesign visual global (só componentes novos usam o ui-kit; telas antigas ficam como estão).
- Mobile/PWA (mantém como está).
