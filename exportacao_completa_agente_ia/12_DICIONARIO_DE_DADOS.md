# 12 — Dicionário de dados

Tabelas relevantes para o agente de IA. Contagens medidas na auditoria.

## 1. WhatsApp

### `wa_messages` (3.507)
Mensagem individual, inbound ou outbound.
| Campo | Descrição |
|---|---|
| `id` | PK |
| `org_id` | organização (RLS) |
| `conversation_id` | conversa |
| `contact_id` | contato |
| `external_id` | ID da mensagem na Z-API (idempotência) |
| `direction` | `inbound` / `outbound` |
| `source` | `whatsapp` |
| `type` | texto, áudio, imagem, documento, status |
| `content` | texto ou transcrição; vazio quando indisponível |
| `media_url` / metadados de mídia | anexo |
| `status` | enviado/entregue/lido — aplicado de forma monotônica |
| `created_at` / timestamp do provedor | ordenação |

### `wa_conversations` (626)
Agrupa mensagens por contato. Guarda estado (`bot`, `humano`, `humano_assumiu`, `humano_bloqueado`, `encerrada`), resumo, última mensagem, não lidas.

### `wa_contacts` / `wa_directory` (267 contatos; 2.029 entradas de diretório)
Identidade: telefone normalizado, LID, nome, foto. Nome genérico é invalidado; sem telefone exibe ID curto — **nunca telefone fabricado**.

### `wa_events`
Log bruto de webhooks com hash para idempotência.

### `wa_consents`
Opt-in/opt-out por contato.

### `wa_channels` (0)
Configuração de canal: bot ligado/desligado, modo sombra, allowlist de teste, `business_hours`. **Vazia hoje.**

## 2. IA e conhecimento

### `liz_aprendizados` (11)
`categoria` (`DADO_TECNICO`, `DICA_VENDA`), `titulo`, `conteudo`, `created_at`. Os 30 mais recentes entram no prompt.

### `kb_documents` (0) / `kb_chunks` (0)
RAG. Chunk 1.200 chars, overlap 150, embedding `text-embedding-3-small`, busca por RPC `match_kb_chunks`.

### `liz_conversations` (4)
Histórico do copiloto interno.

### `forum_liz_log` (4)
Log de cada resposta da Liz no fórum DashHub.

## 3. Leads e CRM interno

### `leads` (1.996)
| Grupo | Campos |
|---|---|
| Identificação | nome, telefone, `telefone_normalizado`, e-mail, CPF/CNPJ |
| Localização | cidade, UF |
| Técnico | valor da conta, tipo de ligação, segmento, tem fatura |
| Origem | origem, canal, UTM, IDs externos (Meta, formulário) |
| Vínculo | `conversation_id` do WhatsApp, `quiz_data` |
| Ploomes | `ploomes_contact_id`, `ploomes_deal_id` |
| Estado | status, pendências, erros, tentativas, marca de duplicidade |

### `lead_sync_queue`
Fila persistente para o Ploomes: payload, tentativas, último erro, próxima tentativa (backoff).

### `lead_events`
Auditoria de toda transição de estado e de toda sincronização.

### `backup_leads_20260908`
Backup lógico criado antes da grande migração de leads.

## 4. Configuração

### `site_settings`
`leads:min_fatura` (200), `leads:exigir_fatura` (false), `ploomes:default_owner_id`.

### `organizations` (1)
`LZ7 Energia`. `settings.liz_paused = true`, `settings.liz_global_mode = true`, palavras de opt-out.

## 5. DashHub

`hub_dados` — snapshot único do painel (merge raso de primeiro nível via POST protegido).
`hub_dados_hist` — 60 versões anteriores.
`hub_estado` — estado do fórum; acesso restrito a admin/coordenador autenticados e serviços internos.

## 6. Enumerações

- `unit_enum`: londrina, ponta_grossa, wenceslau_braz, **representantes**.
- Papéis: `admin`, `diretor`, `coordenador`, `sdr`, `consultor`, `rh`.
- `tipo_ligacao`: monofasico, bifasico, trifasico.
- `segmento`: residencial, comercial, industrial, rural.
- Direção da mensagem: inbound, outbound.

## 7. Regras de dados invioláveis

1. Campo sem evidência fica `null` / vazio / "Não informado". Nunca placeholder plausível.
2. Duplicado é **marcado**, nunca apagado.
3. Histórico de mensagem nunca é editado nem removido para "preencher lacuna".
4. Conteúdo indisponível, evento de status e limitação da Z-API são coisas distintas e devem ser exibidos como tal.
5. Toda leitura e escrita respeita RLS por organização.
