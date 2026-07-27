
## Contexto do que já existe

Já verifiquei o código e boa parte da encanação está pronta:

- Endpoint público `POST /api/public/ploomes/webhook` recebe payloads e faz upsert de **Contatos**, com secret opcional (`PLOOMES_WEBHOOK_SECRET`) e fallback pra `?secret=` na URL.
- `src/lib/conversions.server.ts` já implementa envio pra **Meta Conversions API**, TikTok e GA4, com hash SHA-256 dos dados PII (email, telefone, cidade), event dedup e `fbp/fbc/user_agent`.
- Esse dispatcher já é chamado em `src/lib/crm.functions.ts` quando um lead muda de stage internamente, e grava histórico em `conversion_events`.
- `PLOOMES_API_KEY` e o painel Meta com `META_AD_ACCOUNT_ID` + `META_SYSTEM_USER_TOKEN` já rodam.

O que **falta** e é o coração do seu pedido: o webhook só entende `Contact`; ele não processa **Deal** (negócio), então mudanças de etapa no Ploomes (proposta, ganho, perdido) não disparam a CAPI. E não existe um Hub que cruze gasto de campanha com lead qualificado / venda.

## Fase 1 — Webhook de Deals do Ploomes → Meta CAPI

Objetivo: quando o SDR/vendedor mexer no Ploomes, o site recebe, atualiza o lead local e dispara o evento certo pro Facebook.

1. Ampliar `POST /api/public/ploomes/webhook` pra detectar o tipo de payload:
   - `Contact.*` — comportamento atual (upsert de lead).
   - `Deal.*` (created, stage_changed, won, lost) — novo fluxo.
   - Payloads com só `{ Id }` chamam `GET /Deals({Id})?$expand=Contact,Stage,Pipeline` na Ploomes API pra buscar o completo.
2. Novo helper `upsertLeadFromPloomesDeal(deal)` em `src/lib/ploomes.server.ts`:
   - Localiza o lead pelo `external_id = deal.ContactId` (ou cria pelo contato do Deal).
   - Atualiza `pipeline_id`, `pipeline_stage_id`, `sale_value` (Amount), `stage` local (mapeamento StageId → `novo|atendimento|venda|perdido`).
   - Se `Won = true` → força stage `venda` e `sale_value = Amount`.
   - Se `Won = false` e status = perdido → stage `perdido`.
3. Após o upsert, chamar `dispatchStageConversions` (o mesmo já usado no CRM) — assim negócio ganho no Ploomes vira `Purchase` na Meta CAPI automaticamente, com valor real do Deal.
4. Registrar cada disparo em `conversion_events` (já existe) e um resumo em `integration_sync_log`.
5. Tela de administração ganha um card "Últimos eventos Ploomes" mostrando os 20 últimos registros de `integration_sync_log` filtrando `provider like 'ploomes%'`.

### Configuração no Ploomes (passo a passo pro usuário)

Vou entregar isso escrito na tela `/admin` numa nova seção "Integração Ploomes":

- URL do webhook: `https://z7energia.lovable.app/api/public/ploomes/webhook?secret=SEU_SECRET`
- Método: `POST` — Content-Type: `application/json`
- Eventos recomendados: Contact.Created, Contact.Updated, Deal.Created, Deal.StageChanged, Deal.Won, Deal.Lost.
- Se o plano do Ploomes não mostra "Webhooks", cria via API: `POST /Webhooks` com os EntityId corretos (a tela lista os IDs).
- Um botão "Testar webhook" que faz POST em si mesmo com payload de exemplo.

## Fase 2 — Hub de Marketing (atribuição por campanha)

Objetivo: em uma única tela ver, por campanha Meta, quanto foi gasto, quantos leads gerou, quantos qualificaram, quantos viraram venda, custo por cada etapa.

1. Nova aba **"Hub"** no CRM (rota `/_authenticated/hub`) com filtros de período (default MTD).
2. Server fn `getMarketingHub` que cruza:
   - `meta_insights_daily` (gasto, impressões, cliques, leads Meta por `campaign_id`).
   - `meta_campaigns` (nome amigável).
   - `leads` agregados por `utm_campaign` (que já é gravado) — quantos qualificados (`stage in atendimento,venda,faturado`), quantos venderam (`stage in venda,faturado`), soma `sale_value`.
   - Matching: normaliza `utm_campaign` do lead × `meta_campaigns.name` (case-insensitive + trim). Campanhas sem match aparecem em "sem atribuição".
3. UI: tabela com colunas Campanha, Gasto, Leads Meta, Leads no CRM, Qualificados, Vendas, Receita, CPL, **CPL qualificado**, **CAC**, **ROAS**. Cards no topo com totais.
4. Ranking por SDR e por Vendedor (usa `assigned_to` e as vendas manuais já cadastradas).
5. Botão "Exportar CSV" da tabela.

Não mexo em nada do BI atual — o Hub fica como uma visão nova, focada em atribuição, sem quebrar os relatórios que você já usa.

## Secrets/config que vou pedir depois do OK

- `PLOOMES_WEBHOOK_SECRET` — gerado por mim (uso `generate_secret`, 32 chars). Você cola na URL do webhook do Ploomes.
- `META_CAPI_ACCESS_TOKEN` — token da CAPI (Business Manager → Conversions API → Gerar token). Só peço quando você quiser ativar o disparo real; sem ele a Fase 1 grava tudo mas não envia pro Facebook.

## Detalhes técnicos

- **Segurança do webhook**: se `PLOOMES_WEBHOOK_SECRET` estiver setado, exigir header `X-Ploomes-Signature` OU `?secret=` na URL. Rejeita 401 caso contrário. Rate limit por IP fica pra depois — Ploomes só chama de IPs próprios.
- **Idempotência**: dedup por `event_id = deal.Id + '-' + deal.LastUpdateDate` no `dispatchStageConversions`, então retries do Ploomes não geram duplicata no Facebook.
- **Falha de rede**: qualquer erro registra em `integration_sync_log(provider='ploomes_webhook', status='error')` e retorna 200 mesmo assim, pra Ploomes não ficar reenfileirando (padrão recomendado pra webhook receiver).
- **Atribuição**: matching por nome normalizado é aproximado; se você padronizar nomes de campanha começando com o mesmo prefixo (ex. `[LDR-ONGRID]`, `[PG-VISITA]`) o match fica quase perfeito. Documento isso na tela do Hub.
- **Sem quebra**: nenhuma alteração em tabelas existentes; apenas leituras cruzadas. Só adiciono índice em `leads(utm_campaign)` pra query do Hub ser rápida.

## Entregas ao fim

- Webhook Ploomes aceitando Contact + Deal, com passo-a-passo na tela `/admin`.
- Deals mudando de etapa dispara Meta CAPI (`Lead`/`Purchase`) automaticamente.
- Nova aba `/hub` no CRM com atribuição campanha → lead → venda, CAC e ROAS reais por campanha.
- Log auditável de tudo em `integration_sync_log` e `conversion_events`.
