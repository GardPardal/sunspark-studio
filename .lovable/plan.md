# WhatsApp AI Operations — Plano de Implementação

Transformar o LZ7 Energy Hub em uma plataforma de atendimento e vendas por WhatsApp com IA, reutilizável por outras empresas, **sem alterar** o comportamento atual do CRM solar, do ranking, da Liz no site e das integrações Meta/Ploomes.

## Estado atual (já entregue)

- Fundação multi-empresa no banco: `organizations`, `org_members`, `wa_channels`, `wa_contacts`, `wa_conversations`, `wa_messages`, `wa_media`, `wa_consents`, `wa_events`, `wa_audit_log`.
- Bucket privado `wa-media` com leitura restrita a membros da organização dona do arquivo.
- Webhook grava todo evento recebido em `wa_events` de forma idempotente (modo sombra), mantendo o fluxo atual da Liz intacto.
- Worker a cada minuto normaliza contato, conversa, mídia e transcrição de áudio (OGG/Opus via caminho multimodal, demais formatos via transcrição dedicada).
- Helpers de envio (texto, template, marcar como lida), retry, janela de 24h e auditoria.

O que segue é o restante do sistema.

## Etapa A — Base de conhecimento e memória com recuperação

- Habilitar busca vetorial e criar `kb_documents`, `kb_chunks` (com embedding), `kb_ingest_jobs`, todos com `org_id`, RLS por organização e GRANTs.
- Pipeline de ingestão: documento (texto, PDF, FAQ, tabela de preços) → limpeza → chunks com sobreposição → embeddings → índice.
- Recuperação sempre filtrada por `org_id` e, quando aplicável, pelo contato; o contexto enviado ao modelo combina: perfil do contato, resumo da conversa, últimas mensagens e trechos recuperados.
- Resumo contínuo por conversa (`summary`) para não estourar contexto em históricos longos.
- Controles de privacidade: retenção configurável por organização, exclusão de contato/conversa em cascata (mensagens, mídia no bucket, embeddings) e registro da exclusão no log de auditoria.

## Etapa B — Importação histórica autorizada

- Apenas duas fontes: exportações oficiais fornecidas pela empresa e dados já existentes no próprio sistema (leads, timeline, conversas da Liz). Sem raspagem de aparelho ou de terceiros.
- Tela de importação com declaração de titularidade e finalidade, gravada em auditoria antes do processamento.
- Processamento em lote com deduplicação por telefone e por hash de mensagem, marcação `imported = true`, painel com progresso, linhas rejeitadas e motivo.
- Mensagens importadas alimentam contexto e conhecimento, mas nunca disparam resposta automática.

## Etapa C — Orquestração de resposta e transbordo humano

- Roteador por conversa: automático, aguardando humano, em atendimento humano, encerrada.
- Regras de transbordo: pedido explícito do cliente, baixa confiança do modelo, tema sensível (contrato, jurídico, reclamação), mídia sem transcrição, repetição de falha, fora do horário configurado.
- Ao transbordar: para o bot, notifica o responsável (e-mail e painel), grava motivo e horário; retorno ao automático apenas manual.
- Campanhas: só templates aprovados na Meta, respeitando a janela de 24h, consentimento válido e lista de bloqueio; opt-out por palavra-chave em qualquer mensagem, aplicado imediatamente.
- Simulação obrigatória antes do disparo: mostra quantos contatos são elegíveis, quantos foram bloqueados e por quê.

## Etapa D — Auditoria, retentativas e observabilidade

- Todo envio, transbordo, importação, exclusão e mudança de configuração vai para `wa_audit_log`.
- Retentativa com espera crescente para falhas temporárias; eventos que estouram o limite viram fila morta com motivo visível.
- Painel de saúde do canal: fila pendente, eventos mortos, taxa de erro de envio, latência de resposta, transcrições falhas, último evento recebido — integrado ao `/mod/saude` existente.

## Etapa E — Painel

- **Caixa de entrada**: lista de conversas com filtro por status, busca, painel da conversa com mídia e transcrição, resposta manual, botão assumir/devolver, ficha do contato ligada ao lead.
- **Conhecimento**: upload e gestão de documentos, status de indexação, teste de recuperação ("o que a IA sabe sobre X").
- **Importações**: histórico, progresso e erros.
- **Configurações do canal**: número, modo sombra, bot ligado/desligado, lista de teste, horários, retenção, palavras de opt-out.
- Todas as telas respeitam a navegação atual (5 itens) e o design system Sora/Manrope.

## Etapa F — Segredos e integrações

Já configurados: `WHATSAPP_VERIFY_TOKEN`, `LOVABLE_API_KEY`, chaves do backend.

A solicitar quando entrarmos na fase de envio real: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` (assinatura do webhook — hoje o webhook aceita sem assinatura porque o segredo não existe).

## Etapa G — Testes e implantação em estágios

1. **Sombra** (atual): grava e normaliza, não responde pelo novo pipeline.
2. **Lista de teste**: responde apenas para números autorizados.
3. **Piloto**: uma unidade, bot ligado com transbordo agressivo.
4. **Produção**: liberação geral com painel de saúde monitorado.

Cada estágio só avança com sua aprovação.

## Ordem segura das próximas mudanças de código

1. Ativar busca vetorial e criar as tabelas de conhecimento (migração isolada).
2. Serviço de ingestão e indexação de documentos (server-only).
3. Serviço de recuperação de contexto por organização e contato.
4. Orquestrador de resposta com transbordo, ainda desligado por padrão.
5. Caixa de entrada somente leitura no painel.
6. Ações humanas na caixa de entrada (assumir, responder, devolver).
7. Tela de conhecimento e teste de recuperação.
8. Importação histórica com declaração e painel de progresso.
9. Campanhas com templates, consentimento e simulação.
10. Ligar o bot para a lista de teste; depois piloto; depois geral.

## Detalhes técnicos

- Toda lógica de servidor em `createServerFn` ou rotas `src/routes/api/public/*`; nada de novas Edge Functions.
- Isolamento por `org_id` em todas as tabelas novas, com RLS baseada em pertencimento à organização e GRANTs explícitos.
- Chaves e tokens lidos apenas dentro dos handlers de servidor.
- Comportamento solar atual (Liz no site, leads, Ploomes, Meta CAPI, ranking) permanece intocado; o novo pipeline roda em paralelo.
