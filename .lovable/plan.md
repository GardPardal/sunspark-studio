# Evolução para Sistema Operacional Comercial Inteligente

## Princípio inegociável
**Não remover. Não substituir. Não simplificar. Apenas expandir.**
Todo CRM, Agenda, Distribuição, Roleta, Ploomes, Meta Ads, Liz, aprovação de usuários, permissões e telas atuais permanecem **exatamente** como estão. Nenhuma migração destrutiva, nenhuma alteração de assinatura de API existente, nenhuma remoção de rota.

## Estratégia geral
Introduzir uma **camada de módulos** paralela ao que já existe. Cada módulo novo vive em `src/modules/<nome>/` (UI, hooks, functions) e recebe uma rota `/_authenticated/mod/<nome>`. O hub atual (`app.tsx`) ganha novos tiles condicionados a permissão — os tiles antigos continuam intactos.

```text
src/modules/
├── crm/           (agrega/embrulha o que já existe — só views novas)
├── marketing/     (novo: usa meta_* + traffic_spend + marketing-hub)
├── ia/            (novo: motor de insights read-only)
├── bi/            (novo: dashboards por perfil)
├── financeiro/    (novo: metas, comissões, ROI)
└── admin/         (novo: health, logs, auditoria)
```

## Escopo desta primeira entrega (Fase 0 — fundação)

Entregar a **fundação** dos módulos novos e um primeiro conjunto de telas funcionais de alto valor, sem tocar em nada do que já roda. Fases seguintes serão entregues sob demanda.

### 1. Shell modular (aditivo)
- Novo componente `ModuleShell` com sidebar de módulos (CRM, Marketing, IA, BI, Financeiro, Admin) — usado só nas rotas `/mod/*`.
- `backend-shell.tsx` e `app.tsx` **não mudam de comportamento**; ganham apenas um tile "Módulos" para admins/coordenadores.

### 2. Módulo Administração — Saúde do Sistema
Rota `/_authenticated/mod/admin/health`.
Server fn `getSystemHealth` (admin only) que agrega, em leitura pura:
- Última sincronização Meta (`meta_sync_state`), Ploomes (`integration_sync_log`), Emails (`email_send_log`).
- Contagem de erros das últimas 24h por provider.
- Últimos 20 registros de `integration_sync_log`.
- Latência simples: `now() - last_run_at`.
Sem escrever nada. Sem alterar tabelas.

### 3. Módulo Marketing — Central
Rota `/_authenticated/mod/marketing`.
- Reaproveita **integralmente** `meta-ads-panel.tsx` e `marketing-hub.tsx` como abas dentro do módulo (import, não cópia).
- Nova aba "Diagnóstico de Campanhas" que roda regras determinísticas sobre `meta_insights_daily` (últimos 14d):
  - Frequência > 3 → alerta saturação.
  - CTR < 0,8% + spend > R$200 → alerta criativo.
  - Queda de ROAS semana vs semana > 30% → alerta performance.
  - Cada alerta traz: o que, por que, impacto (R$), ação sugerida, prioridade.

### 4. Módulo IA — Motor de Insights (read-only)
Rota `/_authenticated/mod/ia`.
Server fn `generateInsights` que:
- Lê CRM (`leads`, `manual_sales`), Meta (`meta_insights_daily`, `meta_campaigns`), Agenda (`agenda_appointments`).
- Monta um bundle estatístico compacto (nunca envia PII bruta — só agregados e amostras anônimas).
- Chama Lovable AI Gateway (`google/gemini-3.6-flash`) com um system prompt que exige o formato:
  `{ o_que, por_que, impacto, acao, prioridade, ganho_estimado }`.
- Nunca escreve em nenhuma tabela de operação. Guarda o resultado só em cache client-side + opcional `liz_aprendizados` (tabela já existente).

### 5. Módulo BI — Dashboards por perfil
Rota `/_authenticated/mod/bi`.
- Reaproveita `bi-dashboard.tsx` como base.
- Adiciona 3 novas visões (aditivas): Executivo, Coordenador, Consultor — cada uma filtra por `has_role` já existente. Sem novas policies, sem novas permissões.

### 6. Módulo Financeiro — Visão inicial
Rota `/_authenticated/mod/financeiro`.
- KPIs derivados de `manual_sales` + `meta_insights_daily` + `traffic_spend`: Receita, CAC, ROAS, LTV estimado (ticket médio × 1), margem placeholder configurável em `site_settings`.
- Sem tabelas novas nesta fase. Metas e comissões entram na Fase 1 com tabelas novas *aditivas*.

## Regras técnicas obrigatórias
- **Zero migração destrutiva.** Só `CREATE TABLE`/`CREATE INDEX` novos, sempre com GRANTs + RLS conforme padrão do projeto.
- **Zero edit em**: `client.ts`, `client.server.ts`, `auth-middleware.ts`, `types.ts`, tabelas existentes (colunas), rotas atuais de CRM/Agenda/Auth/Ploomes/Meta.
- Todo server fn novo usa `requireSupabaseAuth` + checagem `has_role` quando restrito.
- Todo módulo novo é **desacoplado**: pasta própria, imports próprios; se removido, nada quebra.
- IA é **read-only por contrato**: nenhuma função do módulo IA pode ter `INSERT/UPDATE/DELETE` em tabelas operacionais.

## O que fica para próximas fases (não entra agora)
- Google Ads / TikTok / LinkedIn (precisa credenciais).
- Comissões, metas por consultor, fluxo financeiro completo.
- Auditoria/logs estruturados (tabela nova `audit_log`).
- Forecast/ML mais pesado.
- Dashboards SDR dedicados.

## Confirmação necessária
Confirma que posso avançar com a **Fase 0** exatamente como descrita acima (shell modular + Admin/Health + Marketing/Diagnóstico + IA/Insights + BI por perfil + Financeiro básico), tudo aditivo, sem tocar no que já funciona? Se quiser priorizar um subconjunto (ex.: só IA + Marketing), me diga qual.
