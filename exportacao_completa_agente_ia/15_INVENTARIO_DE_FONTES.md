# 15 — Inventário de fontes auditadas

Legenda de confiança: **C** = confirmado (lido diretamente) · **P** = parcial (lido em trechos) · **R** = referenciado (existência confirmada, leitura não integral).

## 1. Prompts e lógica de IA

| Arquivo | Conteúdo | Conf. |
|---|---|---|
| `src/lib/liz-prompt.ts` | Persona base, `LIZ_CAPTURE_PROMPT`, `LIZ_INTERNAL_PROMPT` | C |
| `src/lib/liz-forum-prompt.ts` | `FORUM_BRAIN_PROMPT`, regras do DashHub, DISC, proteções | C |
| `src/lib/liz-forum.server.ts` | Montagem de contexto do fórum, Ploomes ao vivo, log | P |
| `src/lib/wa-orchestrator.server.ts` | Cadeia de decisão, opt-out, handoff, envio, legado desativado | C |
| `src/lib/leads/liz-qualify.server.ts` | Schema Zod e prompt do extrator | C |
| `src/lib/leads/lead-core.server.ts` | Regras editáveis, bloqueantes, ingestão, fila | C |
| `src/lib/kb.server.ts` | Chunking, embeddings, RAG | C |
| `src/lib/wa-knowledge.server.ts` | Síntese de histórico, aprendizado passivo | P |
| `src/lib/liz-training.functions.ts` | Prompt da treinadora, parsing, remoção | P |
| `src/lib/ai-provider.server.ts` | Cascata de provedores | R |
| `src/lib/ai-gateway.server.ts` | Cliente do gateway | R |
| `src/routes/api/public/liz-chat.ts` | Modos, ferramentas, multimodal, 50 passos | P |
| `src/routes/api/public/liz-image.ts` | Prompts de planejamento/refino de imagem | P |
| `src/modules/ia/insights.functions.ts` | Prompt de insights JSON | P |

## 2. WhatsApp / Z-API

| Arquivo | Conteúdo | Conf. |
|---|---|---|
| `src/routes/api/public/whatsapp/zapi.ts` | Webhook, idempotência, pausa, mídia, aprendizado passivo | C |
| `src/lib/wa-normalize.server.ts` | Normalização de payload | R |
| `src/lib/wa-identity.server.ts` | Identidade, LID, diretório | R |
| `src/lib/wa-store.server.ts` | Persistência | R |
| `src/lib/wa-repair.server.ts` | Reparo idempotente | R |
| `src/lib/wa-audio.server.ts` / `wa-media.server.ts` | Transcrição e mídia | R |
| `src/lib/wa-context.server.ts` | Janela de contexto | R |
| `src/lib/wa-inbox.functions.ts` | Inbox do painel | R |
| `src/routes/_authenticated/mod/whatsapp/index.tsx` | Interface do inbox | R |

## 3. Leads / CRM / Ploomes

| Arquivo | Conteúdo | Conf. |
|---|---|---|
| `src/lib/leads/ploomes-sync.server.ts` | Envio a contatos e negócios | R |
| `src/lib/leads/reconcile.server.ts` | Reconciliação e dry-run | R |
| `src/lib/leads/leads.functions.ts` | Funções do painel de leads | R |
| `src/routes/api/public/leads/sync-worker.ts` | Worker da fila | R |
| `src/lib/ploomes.server.ts` / `ploomes-funnel.server.ts` | Cliente e funil | R |
| `src/routes/_authenticated/mod/leads.tsx` | Painel de leads | R |

## 4. DashHub

`src/routes/api/public/dashhub/dados.ts` (C) · `liz-forum.ts` (C) · `liz-ping.ts` (P) · `src/content/dashhub.html` (R).

## 5. Documentação existente no repositório

| Documento | Conf. |
|---|---|
| `docs/MANUAL_OPERACIONAL_LIZ_IA.md` | C — fonte dos pilares, scripts e objeções |
| `docs/MANUAL-WHATSAPP.md` | C — arquitetura, modo LIVE, payloads |
| `docs/MAPA-DO-SISTEMA.md` | R |
| `docs/ANTIGRAVITY.md`, `AGENTS.md` | R |

## 6. Banco de dados consultado

`liz_aprendizados` (11) · `kb_documents` (0) · `kb_chunks` (0) · `wa_channels` (0) · `wa_messages` (3.507) · `wa_conversations` (626) · `wa_contacts` (267) · `wa_directory` (2.029) · `leads` (1.996) · `liz_conversations` (4) · `forum_liz_log` (4) · `organizations` (1) · `site_settings` (lida) · `hub_dados` / `hub_dados_hist` / `hub_estado` (lidas).

## 7. Fontes que NÃO existem (verificado)

- Tabela de FAQ.
- Tabela de templates de mensagem.
- Tabela de persona/configuração de tom.
- Catálogo de produtos ou tabela de preços.
- Tabela de garantias ou prazos.
- Base vetorial com conteúdo.
- Configuração de horário de atendimento (`wa_channels` vazia).

## 8. Método

Auditoria somente leitura: leitura de código, leitura de documentos, consultas SQL de contagem e amostragem, inspeção de rotas e conferência de configuração. **Nenhuma alteração, exclusão ou desativação foi realizada.** Nenhum segredo foi lido ou exportado; apenas nomes de variáveis. Dados de clientes não foram incluídos.
