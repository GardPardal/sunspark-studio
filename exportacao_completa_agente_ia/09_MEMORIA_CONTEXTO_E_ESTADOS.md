# 09 — Memória, contexto e estados

## 1. Camadas de memória

| Camada | Onde vive | Escopo | Persistência | Entra no prompt? |
|---|---|---|---|---|
| Histórico da conversa | `wa_messages` | por conversa | permanente | sim — **20 mensagens mais recentes** |
| Resumo da conversa | campo de resumo em `wa_conversations` | por conversa | permanente | sim, quando existe |
| Aprendizados | `liz_aprendizados` | **global**, toda a operação | permanente | sim — **30 mais recentes**, formato `• [CATEGORIA] Título: Conteúdo` |
| Base vetorial (RAG) | `kb_documents` + `kb_chunks` | por organização | permanente | sim, por busca — **hoje vazia** |
| Estado do lead | `leads` + `lead_events` | por lead | permanente | parcial |
| Conversas do copiloto | `liz_conversations` | por usuário interno | permanente | sim |
| Configuração da org | `organizations.settings` | global | permanente | controla pausa e modo global |

## 2. Janela de contexto montada por resposta (WhatsApp)

```text
[system]  persona + LIZ_CAPTURE_PROMPT
        + bloco de 30 aprendizados
        + (resumo da conversa, se houver)
[msgs]    últimas 20 mensagens da conversa (cliente + Liz + humano)
[user]    mensagem atual (texto, ou transcrição de áudio, ou descrição do anexo)
```

Áudio entra marcado como `[Áudio do cliente]: "transcrição"`. Imagem/arquivo entra como anexo descrito — a IA só chama de "fatura" se realmente for.

## 3. Aprendizados — formato e categorias

Registro: `{ categoria, titulo, conteudo, created_at }`.
Categorias em uso hoje: `DADO_TECNICO`, `DICA_VENDA`.
Volume atual: **11 registros** (todos transcritos no doc 01 e no `18_BASE_DE_CONHECIMENTO.json`).
Origem: sala de treinamento `/liztreinamento` (ativo) e análise de respostas humanas no WhatsApp (passivo).
Escrita: ferramenta `salvar_aprendizado`. Remoção: função dedicada em `liz-training.functions.ts`.

## 4. RAG

- Embeddings: `openai/text-embedding-3-small`.
- Chunk: **1.200 caracteres**, sobreposição **150**, lote máximo **64**.
- Busca: RPC `match_kb_chunks`, sempre filtrada por organização.
- **Estado: `kb_documents` = 0 e `kb_chunks` = 0.** A infraestrutura está pronta e sem conteúdo. Migrar documentos para cá é uma oportunidade imediata na nova IA.

## 5. Estados da conversa (WhatsApp)

| Estado | Quem responde | Como sai |
|---|---|---|
| `bot` / IA ativa | Liz | handoff, pedido de humano, encerramento |
| `humano` / `humano_assumiu` | pessoa | devolução explícita à IA |
| `humano_bloqueado` | pessoa | ação manual |
| `encerrada` | ninguém | nova mensagem do cliente |
| `opt_out` | ninguém | consentimento novo |

Diagrama formal em `19_FLUXOS_EM_MAQUINA_DE_ESTADOS.json`.

## 6. Estados do lead

`novo → em_qualificacao → qualificado → (sincronizado no Ploomes)`
Ramos: `desqualificado`, `humano`, `opt_out`, `duplicado` (marcado, nunca apagado).
Cada transição grava um registro em `lead_events`.

## 7. Travas globais em vigor

| Trava | Valor atual | Efeito |
|---|---|---|
| `LIZ_WHATSAPP_FORCE_PAUSED` (código, `zapi.ts`) | `true` | Liz não responde no WhatsApp |
| `organizations.settings.liz_paused` (banco) | `true` | idem, camada de dados |
| `organizations.settings.liz_global_mode` | `true` | modo global habilitado |
| `LIZ_AUTO_REPLY_ENABLED` | `false` | resposta automática desligada |

> As duas primeiras foram acionadas a pedido do usuário e **não devem ser removidas** sem autorização explícita.

## 8. Idempotência e concorrência

- Webhooks: hash de evento + ID da mensagem.
- Status de mensagem: aplicação **monotônica** (status antigo nunca sobrescreve status mais avançado).
- Leads: trava por lead com expiração e compare-and-set, evitando processamento concorrente.
- Fila Ploomes: retentativa com backoff, contador de tentativas e erro persistido.

## 9. Contagens observadas na auditoria

`wa_messages` 3.507 · `wa_conversations` 626 · `leads` 1.996 · `liz_aprendizados` 11 · `liz_conversations` 4 · `forum_liz_log` 4 · `kb_documents` 0 · `kb_chunks` 0 · `wa_channels` 0 · `organizations` 1.
