# 08 — Integrações e ferramentas

> Nenhum valor de credencial é exportado. Apenas **nomes** de variáveis de ambiente.

## 1. Ferramentas (function calling) disponíveis para a IA

Fonte: `src/routes/api/public/liz-chat.ts:163-353`. Limite de execução: `stepCountIs(50)`.

| Ferramenta | Modo | Entrada | Saída | Efeito colateral |
|---|---|---|---|---|
| `qualificar_lead` | capture + internal | dados do lead (nome, telefone, cidade, valor, etc.) | confirmação | cria/atualiza lead no CRM interno e pode enfileirar para Ploomes |
| `pesquisar_web` | internal | consulta textual | resultados de busca | nenhum |
| `abrir_url` | internal | URL | conteúdo textual da página | nenhum |
| `gerar_imagem` | internal | prompt em inglês | imagem + campo `markdown` para renderizar | consome crédito de geração |
| `consultar_aprendizados` | internal | termo/categoria | aprendizados salvos | nenhum |
| `salvar_aprendizado` | internal | categoria, título, conteúdo | id | grava em `liz_aprendizados` (afeta todas as conversas futuras) |

Regras de uso já embutidas no prompt: chamar `consultar_aprendizados` antes de responder algo incerto; chamar `salvar_aprendizado` sempre que o time validar algo novo; incluir o `markdown` da imagem exatamente como retornado. Geração de vídeo **desabilitada por custo**.

## 2. Integrações externas

### 2.1 Z-API (WhatsApp) — transporte
- Papel: receber e enviar mensagens do WhatsApp.
- Entrada: webhook `POST /api/public/whatsapp/zapi` (recebimento, envio e status).
- Autenticação do webhook: token no header; sem token → **403**.
- Idempotência: hash do evento + ID da mensagem; repetição é ignorada.
- Saída: envio de texto e mídia pela API da Z-API.
- Variáveis: `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`.
- Particularidades: payload usa `status: "RECEIVED"` para mensagem recebida e o texto vem em `text.message`; contatos podem chegar como **LID** (identificador sem telefone) — nesse caso exibe-se ID curto, nunca telefone fabricado.
- Limitação real: **não há endpoint para histórico anterior à conexão**. Mensagens antigas não são recuperáveis.
- MCP oficial disponível em `https://mcp.z-api.io/mcp` (OAuth), fora do fluxo do agente.

### 2.2 Ploomes (CRM externo) — destino
- Papel: destino final de contatos e negócios qualificados.
- Fluxo: sempre via `lead_sync_queue`; **nunca envio direto** a partir da conversa (o caminho direto antigo está desativado e mantido como legado).
- Objetos: `Contacts` e `Deals`. Reabertura de negócio: `POST Deals({id})/Reopen`.
- Cidade: normalizada e validada contra o cadastro oficial; `CityId` só em correspondência única, senão vazio.
- Pipelines identificados: Energia Solar (comercial), Projetos e Obras/Energia Solar `10017346`, Obras legado `10017567`, Pós-venda `60000567`.
- Variáveis: `PLOOMES_API_KEY`, `PLOOMES_USER_KEY`, `PLOOMES_WEBHOOK_SECRET`.
- Webhook de retorno grava alterações; possui guarda para negócio inacessível.

### 2.3 Meta (Ads + CAPI)
- Conversões de lead enviadas por Conversions API.
- Etiquetas de campanha usadas na análise: `Tráfego Interno` (equipe LZ7) e `Tráfego Pago` (agência Conecta) — **ambas são Meta Ads**.
- Variáveis: `META_CAPI_ACCESS_TOKEN`, `META_SYSTEM_USER_TOKEN`, `META_AD_ACCOUNT_ID(S)`, `META_DEBUG_TOKEN`.

### 2.4 Provedores de IA
- Gateway Lovable AI + Google Gemini + OpenAI (embeddings) + rotas alternativas (Groq/OpenRouter configuradas).
- Variáveis: `LOVABLE_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`.
- Cascata de fallback em `src/lib/ai-provider.server.ts`.

### 2.5 DashHub
- `GET /api/public/dashhub/dados` — público, devolve o snapshot do painel.
- `POST /api/public/dashhub/dados` — protegido por header `X-Hub-Secret`, faz **merge raso de primeiro nível** e grava a versão anterior em `hub_dados_hist` (60 versões).
- `{"dados":{}}` responde 200 sem alterar nada.
- Rota indexação bloqueada: `robots.txt`, `noindex,nofollow`, header `X-Robots-Tag`.
- Variável: `DASHHUB_WEBHOOK_SECRET`.

### 2.6 Outras
- **E-mail**: envio gerenciado síncrono via `sendTemplateEmail`, domínio `notify.lz7energia.com.br` (`EMAIL_DOMAIN`, `LOVABLE_SEND_URL`).
- **Google**: Calendar/Sheets (`GOOGLE_CALENDAR_API_KEY`, `GOOGLE_SHEETS_API_KEY`).
- **Analytics**: GA4 (`GA4_API_SECRET`), TikTok Events (`TIKTOK_EVENTS_ACCESS_TOKEN`).
- **Supabase/Lovable Cloud**: banco, storage privado (currículos PDF/DOC/DOCX), RLS e Realtime.
- **MCP próprio**: `https://lz7energia.com.br/mcp` com OAuth, expõe ferramentas de leads e agenda para clientes externos (ex.: Claude).

## 3. Realtime

`wa_messages` e `wa_conversations` estão na publicação Realtime; a interface do inbox atualiza sozinha (latência medida ~1,5 s).

## 4. Cron e workers

| Job | Frequência | Função |
|---|---|---|
| `sync-worker` de leads | 15 min + wake trigger `pg_net` | drena `lead_sync_queue` para o Ploomes |
| Liz do fórum | cron protegido + ping pós-post | responde pergunta sem resposta do Claude |
| Limpeza de `integration_sync_log` | periódica | evita crescimento (já reduziu 94 MB → 1,9 MB) |
| Manutenção WhatsApp | sob demanda, rota protegida | reparo idempotente de identidades/mídias |

## 5. Lista completa de variáveis de ambiente (nomes apenas)

`DASHHUB_WEBHOOK_SECRET`, `EMAIL_DOMAIN`, `GA4_API_SECRET`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_CALENDAR_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GOOGLE_SHEETS_API_KEY`, `GROQ_API_KEY`, `LOVABLE_API_KEY`, `LOVABLE_SEND_URL`, `META_AD_ACCOUNT_ID`, `META_AD_ACCOUNT_IDS`, `META_CAPI_ACCESS_TOKEN`, `META_DEBUG_TOKEN`, `META_SYSTEM_USER_TOKEN`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `PLOOMES_API_KEY`, `PLOOMES_USER_KEY`, `PLOOMES_WEBHOOK_SECRET`, `PUBLIC_SITE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `TIKTOK_EVENTS_ACCESS_TOKEN`, `VENDAS_PORTAL_PASSWORD`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_KEY`, `WHATSAPP_APP_SECRET`, `WHATSAPP_BASE_URL`, `WHATSAPP_INSTANCE`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `ZAPI_CLIENT_TOKEN`, `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`.
