# Manual técnico — Módulo WhatsApp do Solar OS (LZ7)

Documento de engenharia. Descreve **exatamente** como o módulo funciona hoje: arquivos,
contratos, tabelas, fluxo de tempo real, envio, identidade, mídias, reparo e limites reais.
Se algo mudar no código, este arquivo deve ser atualizado junto.

---

## 1. Visão geral da arquitetura

```text
 WhatsApp (celular da operação)
        │
        ▼
   Z-API (instância + token + client-token)
        │  webhooks HTTP POST
        ▼
 /api/public/whatsapp/zapi          ← rota TanStack (server route, sem auth de sessão)
        │
        ├─ normalizeZapiWebhook()   wa-normalize.server.ts   (interpreta o payload)
        ├─ wa_events (registro bruto idempotente)
        ├─ applyDeliveryStatus()    wa-store.server.ts       (status de entrega)
        └─ persistNormalizedMessage()  wa-store.server.ts
                 ├─ resolveWaContact()    wa-identity.server.ts
                 ├─ ensureConversationFor()
                 └─ INSERT wa_messages + UPDATE wa_conversations
                          │
                          ▼
              Supabase Realtime (publicação postgres_changes)
                          │
                          ▼
   /mod/whatsapp (React) → invalida React Query → UI atualiza em ~1,5 s
```

Envio segue o caminho inverso:

```text
UI → createServerFn sendWaManualMessage / sendWaMediaMessage
   → INSERT wa_messages status="sending"
   → zapi.server.ts (send-text / send-image / send-document / send-audio / send-video)
   → UPDATE status="sent" + provider_message_id
   → webhook posterior atualiza delivered / read / played / failed
```

Princípio inegociável do módulo: **nunca inventar dados**. Se o WhatsApp não entrega o
conteúdo, a linha fica sem corpo e a UI diz que está indisponível — não se preenche com
texto sintético.

---

## 2. Arquivos e responsabilidades

| Arquivo | Papel |
|---|---|
| `src/routes/api/public/whatsapp/zapi.ts` | Webhook oficial da Z-API. Autentica, registra evento bruto, decide status × mensagem, persiste. |
| `src/routes/api/public/whatsapp/webhook.ts` | Webhook legado (Meta Cloud API). Mantido como fallback, fora do fluxo principal. |
| `src/routes/api/public/whatsapp/manutencao.ts` | Rotina protegida de reparo/sincronização (agenda, identidades, reingestão, recálculo). |
| `src/lib/zapi.server.ts` | Transporte. Monta URL/headers e expõe `send-*`, `/status`, `/qr-code/image`, `/chats`, `/contacts`, `/profile-picture`. |
| `src/lib/wa-normalize.server.ts` | Cérebro de interpretação: tipo, texto, mídia, status, identidade, nomes, prévias. |
| `src/lib/wa-store.server.ts` | Persistência única e idempotente das mensagens e do estado de entrega. |
| `src/lib/wa-identity.server.ts` | Nome, telefone, `@lid` e foto reais. Sincroniza `wa_directory` com a agenda da instância. |
| `src/lib/wa-inbox.functions.ts` | Server functions da UI (listar, abrir, enviar, marcar lida, assumir, saúde, canais, reparo). |
| `src/lib/wa-repair.server.ts` | Reprocessamento de `wa_events`, limpeza de placeholders, merge de contatos LID, recálculo de conversas. |
| `src/lib/wa-media.server.ts` | Download da mídia do provedor, gravação no Storage privado, transcrição de áudio. |
| `src/lib/wa-context.server.ts` | Monta o contexto de conversa (últimos turnos + resumo) para a Liz. |
| `src/lib/wa-knowledge.server.ts` | Alimenta a base de conhecimento da Liz com conversas. |
| `src/lib/wa-orchestrator.server.ts` | Decide resposta automática e faz `sendAndLog`. **Desligado hoje.** |
| `src/lib/wa-ingest.server.ts` | Camada Meta legada + `defaultOrgId()` (usado também pelo fluxo Z-API). |
| `src/routes/_authenticated/mod/whatsapp/index.tsx` | Inbox atual. |
| `.../whatsapp/legado.tsx` | Inbox antiga, mantida como fallback. |
| `.../whatsapp/config.tsx`, `conhecimento.tsx` | Canais/instância e base de conhecimento. |

---

## 3. Credenciais e configuração

Variáveis de ambiente do servidor (lidas **dentro** do handler, nunca em escopo de módulo):

- `ZAPI_INSTANCE_ID`
- `ZAPI_TOKEN`
- `ZAPI_CLIENT_TOKEN`

`getZApiConfig()` lança erro se faltar qualquer uma. Nenhum número ou chave fica fixo no código.

URL base montada por `zApiUrl(endpoint)`:

```
https://api.z-api.io/instances/{ZAPI_INSTANCE_ID}/token/{ZAPI_TOKEN}{endpoint}
```

Header obrigatório em toda chamada: `Client-Token: {ZAPI_CLIENT_TOKEN}` (`zApiHeaders()`).

### Webhooks a configurar no painel da Z-API

Todos apontam para a URL **publicada** (produção):

```
https://lz7energia.com.br/api/public/whatsapp/zapi?token={ZAPI_CLIENT_TOKEN}
```

- Ao receber (`ReceivedCallback`)
- Ao enviar (`SentCallback`) — captura respostas dadas pelo celular
- Status da mensagem (`MessageStatusCallback` / `DeliveryCallback`)

> Importante: o webhook chega na **versão publicada**. Correções feitas no preview só
> valem em produção depois de publicar.

---

## 4. Segurança do webhook

`POST /api/public/whatsapp/zapi`:

1. Lê o token de `Client-Token`, `x-zapi-token` **ou** `?token=`.
2. Compara com `ZAPI_CLIENT_TOKEN`. Diferente ou ausente → **403** e nada é gravado.
3. Corpo acima de 1 MB → **413**.
4. Sem organização resolvida → **503**.
5. `GET` responde `200 "Z-API Webhook LZ7 ativo"` (health-check).

O prefixo `/api/public/*` ignora a autenticação de sessão do site publicado — por isso a
validação de segredo dentro do handler é a única barreira e não pode ser removida.

---

## 5. Idempotência: `wa_events`

Antes de qualquer processamento o callback é registrado cru. A chave é determinística:

| Caso | `provider_event_id` |
|---|---|
| Status | `status:{ids...}:{status}` |
| Mensagem | `message:{messageId}:new` ou `:edit` |
| Sem id | `zapi:{SHA-256 do corpo bruto}` |

O `upsert` usa `onConflict: provider_event_id, ignoreDuplicates: true`. Se o `select`
retornar vazio, o evento já existia → responde `200 duplicate event ignored` sem duplicar
mensagem. Ao final, `process_status` vira `processed` ou `failed` com o motivo em `error`.

Esse registro bruto é o que permite **reprocessar o histórico** depois de corrigir um bug
(ver seção 12), sem depender da Z-API.

---

## 6. Normalização do payload (`wa-normalize.server.ts`)

### 6.1 Status × mensagem

O erro clássico da versão antiga era tratar `status: "RECEIVED"` como evento de status e
descartar a mensagem. Hoje a decisão é pelo **tipo do callback**:

```ts
if (/statuscallback|deliverycallback/i.test(payload.type)) → kind: "status"
if (/presence|connected|disconnected|chatpresence|history/i.test(type)) → kind: "ignore"
caso contrário → kind: "message"
```

### 6.2 Escala de estados

```ts
sending 0 → sent 1 → delivered 2 → read 3 → played 4 ;  failed = 5
```

`shouldApplyStatus(atual, novo)` só aplica se o novo for **maior**. `failed` nunca
sobrescreve `read`/`played`. Isso torna callbacks fora de ordem inofensivos.

`mapZapiStatus()` aceita as formas textuais e numéricas: `PENDING|SENDING|0`, `SENT|1`,
`RECEIVED|DELIVERED|2`, `READ|READ_BY_ME|READ-SELF|3`, `PLAYED|4`, `FAILED|ERROR|DELETED`.

### 6.3 Tempo

`toIsoMoment()` aceita epoch em segundos ou milissegundos (`momment`, `moment`,
`timestamp`) e ISO string. Sem valor válido → agora.

### 6.4 Identificadores

`splitIdentifier(valor)` separa telefone de `@lid`:

- termina em `@lid` → é LID, telefone `null`
- só dígitos entre 8 e 15 → telefone
- qualquer outra coisa → ambos `null`

Nunca se converte dígitos de LID em telefone. Esse era o bug que criava "números" falsos.

### 6.5 Conteúdo (`shapeZapiContent`)

Ordem de detecção e resultado (`msgType` / `text` / `media` / `describe` / `supported`):

| Nó do payload | msgType | Texto | Mídia |
|---|---|---|---|
| `text.message` | `text` | mensagem | — |
| `image` | `image` | `caption` | `imageUrl`, mime, — |
| `audio` (inclui PTT) | `audio` | — | `audioUrl` |
| `video` / `ptv` | `video` | `caption` | `videoUrl` |
| `document` | `document` | `caption`/`title` | `documentUrl`, `fileName` |
| `sticker` | `sticker` | — | url |
| `location` | `location` | `name · address` | link do mapa |
| `contact` | `contact` | `displayName` | — |
| `reaction` | `reaction` | emoji | — |
| `poll`/`pollCreation` | `poll` | pergunta | — |
| `buttonsResponseMessage`, `listResponseMessage`, `hydratedTemplate` | `text` (`rawType: button_response`) | opção escolhida | — |
| nada reconhecido | `unsupported` | `null` | — |

Para `unsupported`, `describe` traz `Mensagem do tipo "X" ainda não suportada no Solar OS`
— honesto, e o `rawType` fica gravado para evoluirmos o parser.

### 6.6 Saída normalizada

`NormalizedMessage` carrega: `messageId`, `instanceId`, `connectedPhone`, `isFromMe`,
`isGroup`, `isEdit`, `chatPhone`, `chatLid`, `participantPhone`, `participantLid`,
`chatName`, `senderName`, `chatPhoto`, `senderPhoto`, `occurredAt`, `msgType`, `rawType`,
`text`, `media`, `replyTo`, `describe`, `supported`.

Mensagens de grupo (`isGroup`) são registradas como evento processado e **não** entram na
inbox.

---

## 7. Persistência (`wa-store.server.ts`)

`persistNormalizedMessage(supabase, orgId, m)`:

1. `resolveWaContact()` → id do contato (cria/atualiza por LID ou telefone).
2. `ensureConversationFor()` → reaproveita conversa aberta (`status ≠ encerrada`), senão
   cria com `status: "bot"`.
3. Monta a linha de `wa_messages`:
   `direction` (`isFromMe ? outbound : inbound`), `msg_type`, `raw_type`, `body`,
   `media_url/mime/filename`, `provider_message_id`, `reply_to`,
   `status` (`sent` para saída, `delivered` para entrada), `source: "zapi"`,
   `ai_generated: false`, `occurred_at`.
4. **Deduplicação por `provider_message_id`** dentro da org. Se já existe:
   - preenche `body` só se estava vazio;
   - preenche mídia só se estava vazia;
   - `isEdit` com texto sobrescreve o corpo;
   - nunca apaga conteúdo válido.
5. Se é mensagem nova, atualiza a conversa:
   - `summary` = `previewFor()` (📷 Foto, 🎤 Áudio, 📄 nome, etc.);
   - `last_message_at` só avança (nunca retrocede);
   - entrada → `unread_count += 1`;
   - saída pelo celular → `unread_count = 0` e `status = "humano"` (a operadora assumiu).
6. Atualiza `last_inbound_at` / `last_outbound_at` do contato.

`applyDeliveryStatus(supabase, ids, status)` busca as mensagens pelos
`provider_message_id`, filtra por `shouldApplyStatus` e atualiza em lote; retorna quantas
mudaram.

---

## 8. Identidade dos contatos (`wa-identity.server.ts`)

Problema real: no WhatsApp multi-dispositivo muitos contatos chegam apenas como `@lid`
(identificador privado), sem telefone.

### Fontes oficiais consultadas

- `GET /contacts?page&pageSize` — agenda (phone, lid, name, vname, short, imgUrl)
- `GET /chats?page&pageSize` — conversas (lid, phone, name, isGroup)
- `GET /profile-picture?phone=` — foto
- `GET /chats/{id}` — detalhe

### `syncWaDirectory(supabase, orgId)`

Pagina `/contacts` e `/chats` (100 por página, até 20 páginas), monta um mapa
`lid ↔ telefone ↔ nome ↔ foto` e grava em `wa_directory` **em lotes de 300**
(payloads grandes falhavam silenciosamente na Data API).

- Entradas **com** LID: `upsert` com `onConflict: "org_id,lid"`, garantido pelo índice
  único `wa_directory_org_lid_uidx`.
- Entradas **sem** LID: não há chave única — resolve-se por telefone, uma a uma
  (`select` → `update` ou `insert`).
- Retorna `{ total, comLid, semLid, gravados, erros }`. Última execução real: 2.029
  entradas gravadas, 0 erros.

### `resolveWaContact()` / `ensureWaContactIdentity()`

- Procura o contato por LID, depois por telefone.
- Consulta `wa_directory` para completar nome/telefone/foto.
- **Só sobrescreve nome** se o atual for genérico (`isGenericContactName`).
- Só grava telefone quando resolve um contato antes marcado `phone_unknown`.
- Foto tem TTL de 20 h (links do WhatsApp expiram em ~48 h).

### Regra de exibição (`pickDisplayName`)

Ordem: nome salvo → nome da agenda → nome do perfil → telefone formatado → rótulo curto do LID.

`isGenericContactName()` rejeita: vazio, terminado em `@lid`, só dígitos, `Contato`,
`Contato (2)`, `Cliente`, e qualquer texto com "whatsapp privado", "sem número",
"desconhecid".

`shortLidLabel(lid)` → `Sem nome · ID 123456` (últimos 6 dígitos). Assim o operador
identifica a conversa sem ver um número inventado.

`formatBrPhone()` → `+55 (43) 99999-9999`.

Na inbox, contatos com `phone_unknown = true` têm `phone`/`phoneRaw` vazios — a UI nunca
mostra número falso.

---

## 9. Modo LIVE (tempo real) — como funciona de ponta a ponta

Esta é a parte mais sensível do módulo. **Não alterar sem reproduzir os testes da seção 13.**

### Camada 1 — Chegada

O celular envia/recebe → a Z-API dispara `POST` no webhook publicado em milissegundos.
Se o webhook não estiver cadastrado no painel, ou apontar para o preview, ou o
`Client-Token` estiver errado, **nada chega** e a tela fica parada.

### Camada 2 — Gravação

O handler grava `wa_events` e depois `wa_messages`/`wa_conversations`. Só o que está no
banco existe para a UI.

### Camada 3 — Publicação Realtime

As tabelas `wa_messages` e `wa_conversations` estão na publicação
`supabase_realtime`, com `REPLICA IDENTITY FULL`. Sem isso o Postgres não emite o evento.

Verificação:

```sql
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename like 'wa_%';
```

### Camada 4 — Assinatura no cliente

`src/routes/_authenticated/mod/whatsapp/index.tsx`:

```tsx
useEffect(() => {
  const canal = supabase
    .channel("wa-inbox-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "wa_messages" }, () => {
      qc.invalidateQueries({ queryKey: ["wa-mensagens"] });
      qc.invalidateQueries({ queryKey: ["wa-conversas"] });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "wa_conversations" }, () => {
      qc.invalidateQueries({ queryKey: ["wa-conversas"] });
    })
    .subscribe();
  return () => { void supabase.removeChannel(canal); };
}, [qc]);
```

O evento **não** injeta a mensagem direto no estado: ele apenas invalida as queries do
React Query, que refazem a leitura via server function autenticada. Assim o Realtime nunca
vaza dado fora da RLS/organização — ele só serve de gatilho.

### Camada 5 — Rede de segurança (polling)

Se o WebSocket cair (rede móvel, aba suspensa), o app continua atualizando:

- lista de conversas: `refetchInterval: 30000`
- saúde do canal: `refetchInterval: 60000`
- ao trocar de conversa: recarrega mensagens e zera não lidas

Latência medida ponta a ponta (webhook → tela): **~1,48 s**.

### Diagnóstico rápido quando "não aparece em tempo real"

1. `GET https://lz7energia.com.br/api/public/whatsapp/zapi` responde 200?
2. Webhooks no painel da Z-API apontam para produção **com** o token?
3. `select count(*) from wa_events where created_at > now() - interval '10 min';` cresce?
4. `process_status` desses eventos está `processed` ou `failed`? Ler a coluna `error`.
5. As tabelas estão na publicação realtime (SQL acima)?
6. Console do navegador: o canal `wa-inbox-live` está `SUBSCRIBED`?

Se 3 cresce e a tela não muda → problema é 5/6. Se 3 não cresce → problema é 1/2.

---

## 10. Envio de mensagens

### Texto — `sendWaManualMessage`

1. `requireSupabaseAuth` + `requireMyOrg` (o usuário precisa ser membro da org da conversa).
2. Resolve o destino: telefone real, ou o `@lid` quando `phone_unknown`.
   `zApiTarget()` mantém `@lid` intacto e remove máscara de telefones.
3. `INSERT wa_messages` com `status: "sending"`, `sent_by: userId`.
4. `POST /send-text`. Sucesso → `status: "sent"` + `provider_message_id`
   (`messageId | id | zaapId`).
5. Falha → `status: "failed"` + motivo truncado em 500 chars; a UI mostra falha e permite
   reenviar. **Falha nunca vira sucesso.**
6. Conversa: `last_message_at`, `summary`, `status = "humano"`.
7. Depois, os callbacks de status elevam para `delivered` → `read`.

### Mídia — `sendWaMediaMessage`

Aceita `image | document | audio | video` em base64 + mime + nome + legenda. O arquivo vai
para o Storage privado, gera URL temporária e chama o endpoint correspondente
(`/send-image`, `/send-document/pdf`, `/send-audio`, `/send-video`). A linha segue o mesmo
ciclo `sending → sent → delivered`.

### Outras server functions da inbox

| Função | Uso |
|---|---|
| `listWaConversations` | lista com filtros `todos/bot/liz/humano/encerrada/nao_lidas` e busca por nome ou dígitos |
| `listWaMessages` | histórico paginado da conversa |
| `markWaConversationRead` | zera `unread_count` |
| `claimWaConversation` | assumir / devolver à Liz / encerrar |
| `startNewWaConversation` | inicia conversa por número |
| `getWaMediaUrl` | URL assinada temporária da mídia |
| `getWaChannelHealth` | status da instância, último evento, pendências |
| `listWaChannels` / `upsertWaChannel` | canais |
| `getWaInstanceStatus` / `requestPairingCode` | conexão e pareamento |
| `syncWaIdentities`, `repairWaMessages`, `syncWaKnowledge`, `syncWaHistoricalChats` | manutenção pela UI |
| `importWaChatExport` | importa export `.txt` do WhatsApp |

Todas passam por `requireSupabaseAuth` e `requireMyOrg` — leitura administrativa sem
validação de organização não existe no módulo.

---

## 11. Mídias (`wa-media.server.ts`)

- `ingestWaMedia()` baixa do provedor, grava em bucket privado e cria linha em `wa_media`
  com mime, tamanho e caminho.
- `transcribeWaAudio()` transcreve áudio; a transcrição vira o corpo da mensagem quando não
  há texto.
- Áudio sem transcrição → a conversa é marcada `humano` com
  `handoff_reason: "mídia sem transcrição"` (fluxo Meta legado).
- A UI só usa URL assinada de curta duração (`getWaMediaUrl`), nunca link público.

---

## 12. Manutenção e reparo

`POST /api/public/whatsapp/manutencao` — protegido pelo mesmo `Client-Token`
(`Client-Token` ou `x-zapi-token`; 403 sem ele).

Parâmetro `?acoes=` aceita lista separada por vírgula, ou `tudo`:

| Ação | Efeito |
|---|---|
| `agenda` | `syncWaDirectory` — baixa contatos/chats da instância |
| `merge` | `mergeLegacyLidContacts` — funde duplicados LID × telefone e move mensagens |
| `identidades` | `repairContactIdentities` — nomes, telefones e fotos (`?fotos=0` pula fotos) |
| `reingest` | `reingestPreservedEvents` — reprocessa até 2.000 eventos crus com o parser atual |
| `placeholders` | `removeLegacyPlaceholders` — apaga corpos sintéticos antigos |
| `recalcular` | `recalcConversations` + `countEmptyConversations` — refaz prévia, data e não lidas |

Exemplo:

```bash
curl -X POST "https://lz7energia.com.br/api/public/whatsapp/manutencao?acoes=agenda,identidades" \
  -H "Client-Token: $ZAPI_CLIENT_TOKEN"
```

Retorna JSON com o relatório de cada etapa. Tudo é idempotente e não apaga conteúdo real.

Resultados reais das últimas execuções: 87 eventos analisados / 80 mensagens recuperadas /
72 placeholders removidos / 9 contatos fundidos / 11 mensagens movidas / 2.029 entradas de
agenda / 42 fotos / 22 nomes corrigidos.

---

## 13. Testes de validação (executar após qualquer mudança)

1. Webhook sem token → **403**, nada gravado.
2. Mesmo callback enviado duas vezes → **uma** mensagem, segundo retorna
   `duplicate event ignored`.
3. `ReceivedCallback` com `text.message` → mensagem com conteúdo real, tipo `text`,
   status `delivered`.
4. `StatusCallback` `READ` seguido de `DELIVERED` → permanece `read` (não regride).
5. Texto enviado pela tela chega ao número de teste e percorre `sending → sent → delivered → read`.
6. Falha simulada (token inválido no envio) → `failed` visível, sem falso sucesso.
7. Imagem, PDF e áudio: enviar, receber e abrir pela URL assinada.
8. Não lidas zeram ao abrir e não voltam ao recarregar.
9. Contato só com `@lid` aparece como `Sem nome · ID xxxxxx`, sem telefone falso.
10. Usuário de outra organização não lista nem envia na conversa.
11. Realtime: mensagem entra pelo celular e aparece na tela sem recarregar (~1,5 s).
12. `bun run typecheck && bun run lint && bun run build` sem erros.

---

## 14. Liz (IA) — estado atual

`LIZ_AUTO_REPLY_ENABLED = false` em `src/routes/api/public/whatsapp/zapi.ts`.
Hoje o webhook apenas registra a mensagem e responde `mensagem registrada (IA pausada)`.

Peças já prontas para quando for liberada:

- `wa-context.server.ts` — últimos turnos + resumo da conversa.
- `wa-knowledge.server.ts` — base de conhecimento a partir das conversas.
- `wa-orchestrator.server.ts` — `orchestrateReply()` decide a resposta e `sendAndLog()`
  envia registrando `ai_generated: true`.
- `wa_channels.bot_enabled`, `shadow_mode`, `test_allowlist` — ativação por canal, modo
  sombra e lista de teste.

Regras acordadas para a liberação: ativação por canal (nunca constante no código), resposta
automática só para dúvidas simples cobertas pela base, e transferência obrigatória para
humano em negociação, preço, contrato, prazo, reclamação, jurídico, baixa confiança ou
pedido explícito por atendente. Conversa em `status: "humano"` nunca recebe resposta
automática.

---

## 15. Modelo de dados

| Tabela | Função |
|---|---|
| `wa_channels` | instância/canal, org, `bot_enabled`, `shadow_mode`, `test_allowlist` |
| `wa_contacts` | contato: `phone_e164`, `phone_unknown`, `lid`, `profile_name`, `photo_url`, `consent_status`, `lead_id`, `last_inbound_at`, `last_outbound_at` |
| `wa_conversations` | `status` (`bot`/`liz`/`humano`/`encerrada`), `unread_count`, `last_message_at`, `summary`, `assigned_to`, `handoff_reason`, `handoff_at` |
| `wa_messages` | `direction`, `msg_type`, `raw_type`, `body`, `media_*`, `provider_message_id`, `reply_to`, `status`, `error`, `source`, `sent_by`, `ai_generated`, `occurred_at` |
| `wa_events` | callback bruto, `provider_event_id` único, `process_status`, `attempts`, `error` |
| `wa_media` | arquivo no Storage privado, mime, transcrição |
| `wa_directory` | mapa `lid ↔ telefone ↔ nome ↔ foto` da agenda (índice único `org_id,lid`) |
| `wa_consents`, `wa_audit_log`, `wa_campaigns`, `wa_campaign_targets`, `wa_imports` | consentimento, auditoria, campanhas, importações |

Todas com RLS por organização. O webhook usa `supabaseAdmin` (fora da RLS) porque não há
usuário na requisição; toda leitura da UI passa por server function autenticada que valida
`org_members`.

---

## 16. Limites reais (não são bugs)

- **Histórico anterior à integração não é recuperável.** No WhatsApp multi-dispositivo a
  Z-API não expõe endpoint confiável de histórico por conversa; `getZApiChatMessages()`
  tenta quatro rotas e retorna vazio quando nenhuma responde. Mensagens antigas ficam
  marcadas como indisponíveis — não se fabrica conteúdo.
- Fotos de perfil expiram (~48 h); por isso o TTL de 20 h e o refresh na manutenção.
- Alguns contatos são realmente privados: só `@lid`, sem telefone público.
- Grupos são ignorados por decisão de produto.
- O webhook chega na versão **publicada**; correções exigem publicar.

---

## 17. Checklist de mudança segura

1. Nunca remover a validação de `Client-Token` do webhook.
2. Nunca gerar telefone a partir de dígitos de `@lid`.
3. Nunca preencher corpo de mensagem com texto genérico.
4. Toda ingestão nova deve passar por `normalizeZapiWebhook` + `persistNormalizedMessage`.
5. Preservar `wa_events` — é a única forma de reprocessar.
6. Mudou tabela usada pela inbox? Confirmar publicação realtime e `REPLICA IDENTITY FULL`.
7. Rodar a seção 13 antes de declarar concluído.
8. `bun run typecheck && bun run lint && bun run build` verdes.
