## Auditoria Meta CAPI + Ploomes — Plano de Execução

Escopo grande. Vou executar em **3 sprints sequenciais** (sem voltar pra aprovar cada um), entregando código + evidências reais no final.

### Diagnóstico do que já existe (feito)
- `src/lib/conversions.server.ts` — dispatcher Meta CAPI / TikTok / GA4, usa Graph v19, suporta `test_event_code`.
- `src/lib/ploomes.server.ts::fireConversionsForLead` — chamado pelo webhook e persiste em `public.conversion_events`.
- `src/routes/api/public/ploomes/webhook.ts` — dispara `Lead`/`Purchase` nas etapas `novo/atendimento/venda/faturado`.
- Pixel client: `src/lib/tracking.ts` (`initMetaPixel` + `trackLeadConversion`).
- Config UI: `/marketing-hub` (Pixel ID, Test Event Code, mapeamento por etapa).

### Lacunas confirmadas (o que a auditoria vai corrigir)
1. Só existem eventos `Lead` e `Purchase`. Faltam `CompleteRegistration`, `Schedule`, `ViewContent`, `PageView` server-side; `PageView` só existe no pixel.
2. Payload CAPI está enxuto: sem `client_ip_address`, `external_id`, `zp`, `fn`/`ln`, `content_ids`, `contents`, UTMs em `custom_data`, `page_id`.
3. Sem deduplicação client↔server garantida: `event_id` do server é `${lead.id}-${stage}-${Date.now()}` — Pixel dispara com outro id → **duplica**. Precisa `event_id` estável e o mesmo passado ao Pixel.
4. Sem tela `/mod/meta-debug` — hoje `conversion_events` só é visível via SQL.
5. Sem botão "reenviar" nem "enviar evento de teste".
6. API version desatualizada (v19 → v21).
7. Sem mapeamento explícito por Stage do Ploomes → evento Meta configurável.

### Sprint 1 — Núcleo CAPI robusto
- Reescrever `conversions.server.ts`:
  - Graph API v21, `client_ip_address` (do request), `external_id` (SHA256 do lead.id), `zp`, `fn`/`ln` (split de `nome`), `content_name/category/ids/contents`, UTMs em `custom_data`, `data_processing_options=[]`.
  - `event_id` determinístico: `sha1(lead.id|stage|bucket15min)`.
  - Retornar `fbtrace_id` e `events_received` da resposta Meta.
- Adicionar eventos: `Lead`, `CompleteRegistration`, `Schedule`, `Purchase`, `ViewContent`, `PageView` — parametrizáveis por stage via `site_settings` (`meta_event_{stage}`).
- Novo helper `sendMetaEvent(eventName, lead, {value, testMode})` reutilizável.

### Sprint 2 — Gatilhos e persistência
- Ampliar `fireConversionsForLead` para receber `eventName` explícito, gravar `fbtrace_id` e payload completo em `conversion_events` (migração: colunas `fbtrace_id text`, `request_payload jsonb`, `event_id text`).
- No webhook Ploomes: mapear stage→evento (default: `novo→Lead`, `qualificado/atendimento→CompleteRegistration`, `agendado→Schedule`, `venda/faturado→Purchase`, `perdido→nenhum`) — configurável.
- Server function `retryConversion(eventId)` para reenviar.
- Server function `sendTestEvent(eventName)` gerando lead fictício + `test_event_code`.
- Passar `event_id` do server para o client via `data-event-id` no form (dedup Pixel↔CAPI).

### Sprint 3 — Painel `/mod/meta-debug` + relatório
- Rota `src/routes/_authenticated/mod/meta-debug.tsx`:
  - Tabela em tempo real dos últimos `conversion_events` (evento, lead, status HTTP, `fbtrace_id`, timestamp, erro).
  - Filtros por evento / lead / campanha.
  - Ações: **Reenviar**, **Copiar payload**, **Enviar evento de teste** (dropdown com PageView/ViewContent/Lead/CompleteRegistration/Schedule/Purchase).
  - Card de configuração exibindo de onde vêm `PIXEL_ID` (site_settings), `ACCESS_TOKEN` (secret), `TEST_EVENT_CODE` (site_settings), `API_VERSION` (const).
  - Botão "Rodar auditoria" → executa server fn que checa: secret presente, pixel salvo, webhook Ploomes registrado, último evento < 24h, taxa de erro; devolve tabela ✅/❌/⚠ + nota 0–100 (Pixel 20, CAPI 20, Dedup 15, Match Quality 20, Hashing 10, Performance 10, Confiabilidade 5).
- Modo teste: se `meta_test_event_code` estiver setado, todos os eventos vão com `test_event_code` (visível no Events Manager → Test Events).

### Sprint 4 — Prova
- Executar `sendTestEvent` para os 6 eventos após deploy.
- Ler `conversion_events` e mostrar `fbtrace_id` + `events_received:1` como evidência.
- Entregar relatório final com nota e checklist.

### Não faz parte
- TikTok/GA4 (mantidos como estão).
- Redesign de páginas fora de `/mod/meta-debug`.
- Alterar tabelas fora de `conversion_events`.

Confirma para eu executar os 4 sprints direto?
