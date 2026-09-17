# 06 — Fluxos de atendimento

Fontes: `src/lib/wa-orchestrator.server.ts`, `src/routes/api/public/whatsapp/zapi.ts`, `src/routes/api/public/liz-chat.ts`, `src/lib/leads/lead-core.server.ts`.

## 1. Fluxo mestre — mensagem recebida no WhatsApp

```text
Z-API  ──POST──►  /api/public/whatsapp/zapi
                        │
                        ├─ 1. autentica por token          → 403 se inválido
                        ├─ 2. hash do evento (idempotência) → ignora repetido
                        ├─ 3. grava wa_events
                        ├─ 4. normaliza (wa-normalize)      → telefone, LID, tipo
                        ├─ 5. resolve identidade            → wa_contacts / wa_directory
                        ├─ 6. persiste wa_messages + atualiza wa_conversations
                        ├─ 7. Realtime → interface atualiza sozinha
                        ├─ 8. áudio? → transcreve  |  mídia? → baixa e anexa
                        │
                        ▼
              LIZ_WHATSAPP_FORCE_PAUSED === true ?
                        │
                 SIM ───┴─── NÃO
                  │            │
             encerra       orquestrador (§2)
        (só registra)
```

**Estado hoje: pausada.** Dupla trava ativa: `LIZ_WHATSAPP_FORCE_PAUSED = true` no código e `organizations.settings.liz_paused = true` no banco. A IA recebe e registra tudo, mas não responde.

## 2. Orquestrador — cadeia de decisão (ordem exata)

```text
1. OPT-OUT      mensagem ∈ {sair, parar, descadastrar, remover, stop}
                → grava consentimento, encerra, NÃO responde
2. CANAL        canal desligado / modo sombra / bot off / fora da allowlist de teste
                → não responde
3. HUMANO       conversa em humano | humano_assumiu | humano_bloqueado | encerrada
                → não responde
4. HANDOFF      pedido explícito OU tema sensível (§4 do doc 10)
                → responde frase de transbordo, marca handoff, para
5. CONTEXTO     carrega até 20 mensagens mais recentes + aprendizados + resumo
6. GERA         modelo produz resposta
7. CONFIANÇA    confiança baixa → handoff em vez de enviar
8. ENVIA        Z-API; persiste como mensagem outbound
9. QUALIFICA    extrator roda em paralelo → atualiza lead → fila Ploomes se qualificado
```

## 3. Fluxo conversacional com o cliente (leads orgânicos)

```text
[saudação] → [cidade do imóvel] → [média da conta] → [padrão elétrico]
   → [pedido da fatura] → [fechamento: Stephany + engenharia]
```
Regras que atravessam todas as etapas:
- Pergunta do cliente **interrompe** o fluxo: responde a dúvida primeiro, depois retoma.
- Nunca repetir etapa já respondida no histórico.
- Uma etapa por mensagem, 1–2 frases.
- Conta < R$ 200 → pergunta sobre aumento de consumo antes de desqualificar.
- Cliente com sistema instalado querendo bateria → desvia para o fluxo de **retrofit** (explica troca por inversor híbrido + pergunta quantas placas).
- Cliente falando de **terreno** → pergunta se é consumo próprio ou venda de energia.

## 4. Fluxo do lead do Quiz

```text
Quiz público → lead-core (ingestão) → lead nasce QUALIFICADO
   → mensagem inicial no WhatsApp já traz Nome/Cidade/Consumo
   → Liz confirma dados, avisa que a proposta está sendo montada, abre para dúvidas
   → NUNCA repergunta cidade/consumo, NUNCA desqualifica
   → lead_sync_queue → Ploomes (contato + negócio)
   → conversão enviada à Meta CAPI
```

## 5. Fluxo do lead até o Ploomes

```text
fonte (quiz | site | WhatsApp | Meta | importação)
   → lead-core.upsert  (normaliza telefone, deduplica, grava lead_events)
   → validação / deduplicação
   → qualificação (bloqueantes do doc 05)
   → lead_sync_queue  (fila persistente, retentativa com backoff)
   → sync-worker (cron 15 min + wake trigger via pg_net)
   → Ploomes: Contact → Deal (pipeline Energia Solar, estágio inicial, origem, responsável)
   → grava ploomes_contact_id / ploomes_deal_id no lead
```
Falha externa nunca perde lead: fica na fila com erro e contador de tentativas, visível em `/mod/leads`.

## 6. Fluxo do copiloto interno (`/api/public/liz-chat`, modo `internal`)

```text
usuário do painel → valida sessão → LIZ_INTERNAL_PROMPT
   → loop de ferramentas (até 50 passos): pesquisar_web, abrir_url,
     gerar_imagem, consultar_aprendizados, salvar_aprendizado, qualificar_lead
   → resposta markdown → persiste em liz_conversations
```
Modo `capture` (site público) usa `LIZ_CAPTURE_PROMPT` e não exige sessão.

## 7. Fluxo de aprendizado

- **Ativo**: `/liztreinamento` — a SDR ensina, o modelo estrutura em `{categoria, titulo, conteudo}` e grava em `liz_aprendizados`; os 30 mais recentes entram no prompt de toda conversa.
- **Passivo**: quando um humano responde no WhatsApp, o sistema analisa a resposta e pode propor um aprendizado (`wa-knowledge.server.ts`).
- **RAG**: `kb_documents`/`kb_chunks` com embeddings `text-embedding-3-small`, busca por `match_kb_chunks`. **Hoje as duas tabelas estão vazias** — o RAG existe mas não tem conteúdo.

## 8. Fluxo do fórum (DashHub)

```text
pergunta no fórum → Claude responde (quando online)
   → se ninguém responde: cron/ping aciona a Liz do fórum
   → monta contexto: painel hub_dados + funil Ploomes ao vivo + histórico do fórum
   → FORUM_BRAIN_PROMPT → resposta gravada + log em forum_liz_log
   → trava de 20s e indicador "pensando" na interface
```
