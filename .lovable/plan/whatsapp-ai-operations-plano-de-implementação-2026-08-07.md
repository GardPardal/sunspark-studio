# WhatsApp AI Operations — Plano de Implementação

Objetivo: transformar o Solar OS num sistema de operação por WhatsApp com IA, sem quebrar nada do fluxo solar atual (leads, roleta, Ploomes, Meta CAPI, agenda, ranking). Tudo novo entra ao lado do que existe (regra: nunca remover, sempre somar), já com multi-tenant para reuso por outras empresas.

## Estado atual verificado

- `src/routes/api/public/whatsapp/webhook.ts`: já valida `hub.verify_token` no GET e HMAC `x-hub-signature-256` no POST; processa mensagens de texto de forma assíncrona, chama a Liz e responde. Não tem idempotência, nem mídia/áudio, nem fila.
- `src/lib/whatsapp.server.ts`: envia texto via Graph v21 e verifica assinatura. Sem envio de template, mídia ou marcação de leitura.
- `public.whatsapp_conversations` (9 colunas): uma linha por telefone com histórico em JSON. Não é multi-tenant, não guarda mensagens individuais, status de entrega nem mídia.
- Existem `leads`, `timeline_events`, `lead_cadence_tasks`, `liz_aprendizados`, `liz_conversations`, `meta_campaigns` e afins.
- Extensão `vector` **não** está instalada no banco (verificado em `pg_extension`) — embeddings exigem habilitá-la.
- Secrets já presentes: `WHATSAPP_VERIFY_TOKEN`, `LOVABLE_API_KEY`. Faltam `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` (o código já os lê, mas não estão configurados).

## 1. Webhook de entrada: verificação + processamento idempotente

- Manter a rota atual e endurecer: exigir HMAC sempre (hoje só valida se `WHATSAPP_APP_SECRET` existir), comparar em tempo constante, limitar tamanho do corpo, responder 200 rápido.
- Nova tabela `wa_events` (id do provedor como chave única) grava o payload cru antes de qualquer processamento. Reentrega da Meta com o mesmo `message.id`/`statuses.id` cai em conflito e vira no-op.
- Enfileirar via `pgmq` (`q_wa_inbound`) e processar por worker em rota `/api/public/wa/queue/process` disparada por `pg_cron` — mesmo padrão já usado na fila de e-mails. Backoff exponencial e DLQ (`move_to_dlq` já existe).
- Tratar todos os tipos: `text`, `audio`, `image`, `document`, `button`, `interactive`, `reaction`, além de `statuses` (sent/delivered/read/failed).

## 2. Mídia e transcrição de áudio

- Baixar mídia em duas etapas na Graph API (`GET /{media_id}` → URL assinada → download com o token), sempre no servidor, com limite de tamanho e allowlist de MIME.
- Guardar no bucket privado novo `wa-media` (sem acesso público; leitura só por URL assinada de curta duração para usuários autenticados da organização).
- Áudio: converter/enviar para `https://ai.gateway.lovable.dev/v1/audio/transcriptions` com `openai/gpt-4o-mini-transcribe`. Voz do WhatsApp vem em OGG/Opus, que o modelo rejeita — transcodificar para WAV/MP3 antes; se a transcodificação não for viável no runtime Worker, usar o caminho de áudio de um modelo Gemini via `/v1/chat/completions` como fallback (documentado no card de STT). O transcrito vira o `body` da mensagem e alimenta a IA; o arquivo original fica no storage.
- Transcrição falha → mensagem entra como mídia sem texto e marca handoff humano, nunca resposta inventada.

## 3. Modelo de dados multi-tenant

Novas tabelas em `public`, todas com `org_id` e RLS por associação (nada removido do modelo atual):

- `organizations`, `org_members` (usuário ↔ organização ↔ papel). A LZ7 é a organização semente e todo dado atual é atribuído a ela.
- `wa_channels`: número/phone_number_id, app secret ref, verify token, persona, horários de atendimento.
- `wa_contacts`: telefone normalizado E.164, nome de perfil, `lead_id` opcional ligando ao CRM existente, `consent_status`, `opt_in_at`, `opt_out_at`, `last_inbound_at` (janela de 24h).
- `wa_conversations`: por contato+canal, status (`bot`, `humano`, `encerrada`), responsável, `handoff_reason`.
- `wa_messages`: direção, tipo, corpo, `provider_message_id` único, status de entrega, custo/erro, `reply_to`, referência à mídia.
- `wa_media`: caminho no storage, mime, tamanho, hash, transcrição, estado do download.
- `wa_consents`: log imutável de opt-in/opt-out com origem e prova.
- `kb_documents`, `kb_chunks`, com `embedding vector(1536)` (exige `create extension vector`) e índice ivfflat/HNSW por organização.
- `wa_handoffs`: fila de atendimento humano com SLA e histórico.
- `wa_audit_log`: quem/o quê/quando para toda ação sensível (envio, exportação, exclusão, mudança de configuração).

Cada `CREATE TABLE` acompanha `GRANT` para `authenticated`/`service_role` na mesma migração, RLS ligada e políticas via função `security definer` `is_org_member(org_id)` (mesmo padrão de `has_role`, sem recursão).

`whatsapp_conversations` continua existindo e sendo escrito durante a transição; um backfill copia para o novo modelo e só depois a rota antiga passa a ser espelho.

## 4. Importação histórica (só o que é autorizado)

- Fontes permitidas: exportação oficial do WhatsApp Business (arquivo `.txt`/`.zip` que o próprio dono do número exporta), CSVs do Ploomes/CRM já existentes, e dados já presentes no banco (`leads`, `timeline_events`, `liz_conversations`).
- Não haverá scraping, automação de WhatsApp Web, leitura de dispositivo nem API não oficial.
- Fluxo: upload → job de importação (`wa_import_jobs`) → parsing → deduplicação por telefone + timestamp + hash do texto → gravação com `source='import'`.
- Cada importação exige confirmação explícita de titularidade e fica registrada na auditoria.

## 5. Contexto com RAG, privacidade e retenção

- Contexto montado por camadas: perfil do contato + lead do CRM → últimas N mensagens → trechos recuperados da base de conhecimento (`kb_chunks`) **sempre** filtrados por `org_id` antes da busca vetorial → aprendizados da Liz.
- Embeddings gerados no servidor via Lovable AI; nenhuma chamada a modelo recebe dado de outra organização.
- Retenção configurável por organização (padrão: mídia 180 dias, mensagens 24 meses); job `pg_cron` apaga o que vencer.
- Exclusão a pedido do titular: função que apaga contato, mensagens, mídia e chunks derivados e registra o evento na auditoria (LGPD).
- Contato com opt-out não recebe campanha nem resposta automática — apenas fila humana.

## 6. Orquestração de resposta

- Roteador determina: campanha (template aprovado, fora da janela de 24h), atendimento (resposta livre dentro da janela), ou handoff.
- Templates de campanha ficam em `wa_templates`, sincronizados com a Meta, com variáveis validadas por Zod e checagem de opt-in antes do disparo.
- Escalonamento para humano por: pedido explícito, baixa confiança, tema sensível (preço fechado, jurídico, reclamação), 3 idas e vindas sem avanço, ou falha de transcrição.
- Envio com retry e backoff; erro definitivo vira alerta em `system_health` e item no inbox.
- Toda mensagem gerada por IA grava modelo, prompt, tokens e latência para auditoria.
- Comportamento solar atual preservado: a persona `LIZ_CAPTURE_PROMPT` e a criação de lead (`qualificar_lead`) continuam idênticas para a organização LZ7.

## 7. Dashboard

Novas rotas sob `_authenticated`:

- `/wa/inbox`: lista de conversas, filtros (bot/humano/aguardando), painel de mensagens, envio manual, botão "assumir/devolver ao bot", player de áudio com transcrição.
- `/wa/conhecimento`: upload e gestão de documentos, status de indexação, teste de busca.
- `/wa/importacoes`: progresso, erros e histórico dos jobs.
- `/wa/config`: canal, persona, horários, retenção, opt-out, templates, chaves.

Tudo com o Design System atual (Sora/Manrope, tokens OKLCH), navegação existente e sem criar segunda barra de navegação.

## 8. Secrets e implantação

Necessários em Project Settings → Secrets: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_BUSINESS_ACCOUNT_ID`. `LOVABLE_API_KEY` já existe e cobre IA e transcrição.

Etapas seguras:
1. Migrações + RLS, sem tráfego novo.
2. Webhook em modo sombra: grava eventos, não responde.
3. Bot ativo só para números de teste em allowlist.
4. Liberação por organização, com kill switch em `wa_channels.bot_enabled`.

## Detalhes técnicos

- Server functions em `src/lib/wa-*.functions.ts`; helpers server-only em `*.server.ts`; webhook e worker em `src/routes/api/public/wa/*`.
- Nada de `src/server/` para módulos importados pelo cliente; `supabaseAdmin` só dentro de handler após verificar o chamador.
- Transcodificação/mídia dentro do runtime Worker: sem `child_process`/ffmpeg — usar caminho WAV/PCM ou fallback Gemini.
- Fila com `pgmq` + `pg_cron`, reaproveitando `enqueue_email`/`move_to_dlq` como referência.

## Primeiras mudanças de código, na ordem mais segura

1. Migração 1: `organizations`, `org_members`, `is_org_member()`, semente da LZ7 (só estrutura, nada em uso).
2. Migração 2: `wa_channels`, `wa_contacts`, `wa_conversations`, `wa_messages`, `wa_media`, `wa_consents`, `wa_events`, `wa_audit_log` + GRANTs + RLS.
3. Bucket privado `wa-media` e políticas de acesso.
4. `src/lib/wa.server.ts`: normalização E.164, verificação HMAC obrigatória, cliente Graph (texto, template, mídia, marcar lido).
5. Endurecer `src/routes/api/public/whatsapp/webhook.ts` em modo sombra: gravar `wa_events` + enfileirar, mantendo o fluxo atual da Liz intacto.
6. Worker `/api/public/wa/queue/process` + `pg_cron`: normaliza evento em `wa_contacts`/`wa_conversations`/`wa_messages`.
7. Pipeline de mídia + transcrição (`wa-media.server.ts`).
8. `/wa/inbox` somente leitura para validar os dados antes de qualquer resposta automática.
9. Migração 3: `vector`, `kb_documents`, `kb_chunks` + indexação.
10. Orquestrador de resposta e handoff, ligado atrás de `bot_enabled`.
11. Importação histórica + telas de conhecimento, importações e configurações.
