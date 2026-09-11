# 11 — Configuração técnica do modelo

## 1. Modelos por caminho (observados no código)

| Caminho | Modelo | Parâmetros explícitos |
|---|---|---|
| WhatsApp / orquestrador | Gemini 3.6 Flash (via Gateway Lovable) | não declarados no código |
| Chat capture (site) | Gemini Flash | não declarados |
| Chat internal (copiloto) | Gemini 2.5 Pro / Flash | `stepCountIs(50)` |
| Extrator de qualificação | Gemini Flash | `temperature: 0`, `maxRetries: 1` |
| Cérebro do fórum | Gemini 3.7 Flash, com alternância Pro/Flash | não declarados |
| Geração de imagem | Gemini 3 Flash Preview / GPT Image 2 | — |
| Embeddings | `openai/text-embedding-3-small` | lote 64 |
| Síntese de conhecimento | Gemini Flash | — |

> ⚠️ Inconsistência real e confirmada: convivem referências a `gemini-2.5-flash`, `gemini-3.6-flash`, `gemini-3.7-flash` e `gemini-3-flash-preview` em caminhos diferentes. Não há um modelo único padronizado.

## 2. Parâmetros recomendados para a nova IA

Como a maior parte dos parâmetros é implícita hoje, estes são valores **recomendados** (marcados como interpretação da auditoria, não como configuração existente):

| Parâmetro | WhatsApp (atendimento) | Extrator | Copiloto interno |
|---|---|---|---|
| `temperature` | 0.4 — 0.6 | **0** (confirmado) | 0.7 |
| `top_p` | 0.9 | 1 | 0.95 |
| `max_output_tokens` | 150 (respostas são 1–2 frases) | 400 | 4000 |
| `presence/frequency penalty` | 0 | 0 | 0 |
| Retentativas | 1–2 | **1** (confirmado) | 2 |
| Timeout | **não existe hoje** — recomendar 20 s | 15 s | 60 s |
| Passos de ferramenta | n/d | n/d | **50** (confirmado) |

## 3. Multimodalidade

- **Áudio**: transcrito antes de entrar no contexto, marcado como `[Áudio do cliente]`.
- **Imagem**: aceita; a IA só a trata como fatura se for de fato conta de luz ou se ela tiver pedido.
- **Documento (PDF/DOC/DOCX)**: aceito como anexo; usado para fatura e, em RH, para currículo (storage privado).
- **Saída**: no WhatsApp, **texto puro** pronto para envio. No painel, markdown livre.

## 4. Fallbacks

1. Cascata de provedores em `src/lib/ai-provider.server.ts`.
2. No treinamento, a estruturação usa `generateText` + parsing/validação de JSON, com **fallback para texto bruto** se o JSON falhar (substituiu `generateObject`, que estava silenciosamente descartando os treinos).
3. No fórum, alternância entre Gemini Pro e Flash.
4. Falha total de geração → não envia nada e mantém a conversa para atendimento humano.

## 5. Limites de custo e desempenho já aplicados

- Geração de **vídeo desabilitada** por custo.
- Polling do painel reduzido a 60 s e só com aba visível.
- Cache React Query 30 s / 10 min; sem refetch ao focar; mutations sem retry.
- Estudo contínuo da Liz desligado por padrão (estava estourando cota Gemini).
- Limpeza automática de `integration_sync_log`.

## 6. Segurança do runtime

- Webhook Z-API exige token; sem token → 403.
- Rotas internas exigem sessão e papel.
- RLS por organização em todas as tabelas de dados.
- `X-Hub-Secret` para escrita no DashHub.
- Storage de currículos privado.
- O prompt proíbe revelar instruções internas, chaves, tabelas ou funcionamento do sistema.
