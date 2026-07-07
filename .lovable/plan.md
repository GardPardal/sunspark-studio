# Plataforma de Inteligência Comercial — Meta Ads + Tracking + BI

Este é um projeto grande. Proponho entregá-lo em **4 fases incrementais**, cada uma utilizável em produção antes da próxima. Assim você já começa a usar sem esperar tudo pronto.

---

## Pré-requisitos (você fornece)

Para funcionar de verdade, sem dado falso, precisamos destas credenciais oficiais da Meta. Eu te guio onde pegar cada uma quando aprovarmos o plano:

1. **Meta App** em `developers.facebook.com` com produtos: Marketing API, Conversions API, Login for Business.
2. **META_APP_ID** e **META_APP_SECRET** (secrets do backend).
3. **META_SYSTEM_USER_TOKEN** (Business Manager → Usuário de Sistema com acesso à conta de anúncios) — evita expiração de 60 dias.
4. **META_AD_ACCOUNT_ID** (ex.: `act_123456789`).
5. **META_PIXEL_ID** e **META_CAPI_ACCESS_TOKEN** (Conversions API).
6. Opcional agora, obrigatório na Fase 3: **GA4 Measurement ID + API Secret**, **Google Ads Developer Token + refresh token**.

Sem estas, nada é sintético — o painel fica vazio até conectar.

---

## Fase 1 — Sincronização Meta Ads (base do BI)

**Objetivo:** puxar tudo da Meta para o banco em background e mostrar no painel.

Novas tabelas (todas com RLS admin/coordenador):
- `meta_ad_accounts` — contas conectadas
- `meta_campaigns` — id, nome, objetivo, status, budget, datas, account_id
- `meta_adsets` — id, campaign_id, segmentação, budget, status
- `meta_ads` — id, adset_id, criativo, status
- `meta_creatives` — id, título, corpo, imagem, vídeo, CTA
- `meta_insights_daily` — linha por (ad_id, dia): spend, impressions, reach, frequency, clicks, ctr, cpc, cpm, actions (leads, conversões), action_values (receita)
- `meta_sync_state` — cursor por entidade + última execução

Server functions (privado, admin):
- `syncMetaEntities()` — GET `/act_.../campaigns`, `/adsets`, `/ads`, `/adcreatives` com paginação
- `syncMetaInsights(days)` — GET `/insights?level=ad&time_increment=1&fields=...` para janela deslizante
- `getMetaOverview({from,to})` — agrega do banco; retorna investimento, CPL, CTR, ROAS, top campanhas etc.

Job `pg_cron` a cada 30 min chama endpoint público `/api/public/hooks/meta-sync` (auth por `apikey` anon) que dispara as syncs de entidades + insights de ontem/hoje.

Novo painel `/admin` → aba **Meta Ads**:
- Cards KPI: Investimento, Impressões, Alcance, Freq., Cliques, CTR, CPC, CPM, Leads, CPL, Conversões, Receita, ROAS, ROI
- Tabela campanhas/conjuntos/anúncios com ordenação por qualquer métrica
- Comparar períodos (hoje vs ontem, semana vs semana, mês vs mês, ano vs ano)
- Gráficos evolução diária/mensal
- Rankings: vencedoras, mais caras, maior conversão
- **Zero chamada à Meta durante render** — só lê do banco

Substitui os campos manuais atuais de `traffic_spend` (mantemos a tabela como fallback para lançamento offline, mas escondemos por padrão).

---

## Fase 2 — Rastreamento completo de leads (site → CRM)

**Objetivo:** cada lead do CRM sabe de onde veio, com jornada.

Novas tabelas:
- `visitor_sessions` — session_id (cookie 1p), fbclid, gclid, utm_source/medium/campaign/content/term, referrer, landing_page, user_agent, device, browser, os, ip_country/state/city (via IP), campaign_id/adset_id/ad_id resolvidos, first_seen_at, last_seen_at
- `visitor_events` — session_id, tipo (pageview, click, form_start, form_submit, whatsapp_click, scroll_depth), path, target, meta jsonb, occurred_at
- `lead_attributions` — lead_id → session_id, campaign_id, adset_id, ad_id, creative_id, first-touch e last-touch

Novos campos em `leads`: `session_id`, `campaign_id`, `adset_id`, `ad_id`, `utm_*`, `fbclid`, `gclid`, `landing_page`, `device`, `browser`, `city_geo`, `state_geo`, `country_geo`.

Frontend:
- Script leve `src/lib/tracking.ts` inicializado no `__root.tsx`:
  - gera/lê cookie `lz7_sid`
  - captura UTMs, fbclid, gclid do querystring
  - registra `pageview` a cada navegação
  - hooks `trackClick(target)`, `trackFormStart`, `trackFormSubmit`, `trackWhatsapp`
  - envia batch a cada 5s ou no `beforeunload`
- Endpoints públicos `/api/public/track/session` e `/api/public/track/events` — validação Zod, rate-limit por IP simples, sem PII
- Formulários existentes (lead, contato) passam a chamar `attachSessionToLead(leadId)` no submit

Server function `getLeadJourney(leadId)` retorna sessão(ões), eventos ordenados, campanha atribuída — mostrado num drawer "Jornada" no card do lead.

---

## Fase 3 — Meta CAPI + GA4 + Google Ads (opcional mas recomendado)

- **Meta Conversions API** (server-side): `sendCapiEvent({event, lead})` — dispara `Lead`, `Purchase` com deduplicação via `event_id` compartilhado com Pixel. Recupera match quality mesmo com bloqueio de cookies.
- **Meta Pixel** no site com `advanced matching` (email/telefone hasheados quando o lead informa).
- **GA4**: reflete os mesmos eventos via Measurement Protocol server-side.
- **Google Ads API**: sync de campanhas Google (mesmo padrão da Meta) — só se você usa Google Ads.

---

## Fase 4 — Painel comercial completo

Painel dedicado `/comercial` (admin/coordenador/consultor):
- Leads no período, leads por campanha, leads por vendedor
- Taxa de conversão (lead → venda) — usando `stage='fechado'` no CRM
- Vendas realizadas, faturamento (soma `valor_venda` — novo campo)
- **ROI por campanha** = (Receita atribuída − Spend) / Spend
- ROI por vendedor, custo por venda, ticket médio
- Funil completo (novo → atendimento → proposta → fechado) com % em cada etapa
- Filtros: período, campanha, vendedor, produto_interesse

Todos os cálculos rodam sobre o banco (nada em tempo real na Meta).

---

## Detalhes técnicos

- **API Meta**: `graph.facebook.com/v21.0`. Rate limit tratado com backoff exponencial. Cursor `paging.next` respeitado.
- **Storage de tokens**: `META_SYSTEM_USER_TOKEN` como secret backend, nunca no cliente. Suporte multi-conta virá via tabela `meta_ad_accounts` com token por conta cifrado (futuro).
- **Job**: `pg_cron` + `pg_net` chamando `/api/public/hooks/meta-sync` (padrão documentado). Frequência: entidades a cada 4h, insights a cada 30min.
- **Nada de mock**: se `META_SYSTEM_USER_TOKEN` faltar, os endpoints retornam erro explícito e o painel mostra "conecte a conta Meta". Zero dado sintético.
- **Privacidade**: tracking respeita LGPD — sem PII no `visitor_events`; nomes/emails só quando o lead preenche formulário; hash SHA-256 antes de mandar pra CAPI.
- **Compatível com CRM atual**: mantém `leads`, `traffic_spend` (fallback manual), integração Ploomes já implementada. Só adiciona.

---

## Ordem de execução sugerida

1. **Aprovar plano** → você fornece as credenciais Meta (te oriento).
2. **Fase 1** (~1 turno grande): tabelas + sync + painel Meta.
3. **Fase 2** (~1 turno grande): tracking + jornada + atribuição.
4. **Fase 3** (~1 turno): CAPI + GA4.
5. **Fase 4** (~1 turno): painel comercial.

Quer começar direto pela Fase 1, ou prefere ajustar o escopo antes? Se quiser, posso já iniciar a Fase 1 assim que você aprovar — nesse momento eu te peço as secrets da Meta uma a uma pela caixinha segura.
