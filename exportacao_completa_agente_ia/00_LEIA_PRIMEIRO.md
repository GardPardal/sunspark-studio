# Pacote de migração integral — Agente de IA "LIZ" · LZ7 Energia Solar

Gerado em 11/09/2026 (UTC-3) por auditoria de leitura do projeto Solar OS (TanStack Start + Lovable Cloud/Supabase + Z-API + Ploomes).
**Nada foi alterado, apagado ou desativado.** Esta exportação é somente leitura.

## Visão geral

A "IA atual" não é um agente único. São **seis agentes/motores distintos** que compartilham parte da infraestrutura:

| # | Agente | Onde roda | Prompt de sistema |
|---|---|---|---|
| 1 | **LIZ Captura** (WhatsApp + site) | `orchestrateLizZapiReply` / `/api/public/liz-chat` (mode=capture) | `LIZ_CAPTURE_PROMPT` |
| 2 | **LIZ Copiloto Interno** (time LZ7) | `/api/public/liz-chat` (mode=internal) | `LIZ_INTERNAL_PROMPT` |
| 3 | **LIZ Treinadora** (sala `/liztreinamento`) | `chatWithLizTraining` | `LIZ_TRAINER_SYSTEM_PROMPT` |
| 4 | **Extrator de qualificação** | `liz-qualify.server.ts` | `SYSTEM` (extrator JSON) |
| 5 | **Cérebro do Fórum** (`/dashhub`) | `liz-forum.server.ts` | `FORUM_BRAIN_PROMPT` |
| 6 | **Motores auxiliares** | insights, imagem, editorial, aprendizado neural | prompts próprios |

O agente que corresponde a "atendimento ao cliente" é o **nº 1 (LIZ Captura)**. É ele que o `01_PROMPT_MESTRE_COMPLETO.md` reproduz. Os demais estão documentados para não haver perda.

## Estado operacional atual (confirmado no banco e no código)

- **A LIZ está PAUSADA no WhatsApp.** Dupla trava:
  - `LIZ_WHATSAPP_FORCE_PAUSED = true` em `src/routes/api/public/whatsapp/zapi.ts:9` (constante em código);
  - `organizations.settings.liz_paused = true` (banco).
  - Ela continua **recebendo e registrando** mensagens em tempo real; apenas não responde.
- `organizations.settings.liz_global_mode = true` (atualizado em 04/09/2026), mas é sobreposto pelas travas acima.
- `wa_channels` está **vazia (0 linhas)** — ou seja, `persona` por canal, `bot_enabled`, `shadow_mode` e `test_allowlist` não estão configurados hoje. O caminho genérico `orchestrateReply` (que depende de canal) **nunca dispara** na prática.
- `kb_documents` e `kb_chunks` estão **vazios (0 linhas)** — o RAG vetorial existe, está implementado e funcional, mas **não tem nenhum documento indexado**. Logo, a busca semântica `searchKnowledge` sempre retorna vazio hoje.
- `liz_aprendizados`: **11 registros** — é a memória de longo prazo realmente em uso (exportada integralmente em `18_BASE_DE_CONHECIMENTO.json`).
- `wa_messages`: 3.507 · `wa_conversations`: 626 · `leads`: 1.996 · `forum_liz_log`: 4 · `liz_conversations`: 4.

## Como usar este pacote

1. Leia este arquivo e `22_RELATORIO_DE_COBERTURA.md`.
2. Configure o novo agente com `01_PROMPT_MESTRE_COMPLETO.md` (ou `20_PROMPT_COMPACTO.md` se houver limite de caracteres).
3. Carregue `18_BASE_DE_CONHECIMENTO.json` como base de conhecimento/RAG do novo agente.
4. Implemente ferramentas e integrações conforme `08_INTEGRACOES_E_FERRAMENTAS.md` + `17_PAYLOADS_E_SCHEMAS.json`.
5. Implemente a máquina de estados de `19_FLUXOS_EM_MAQUINA_DE_ESTADOS.json`.
6. Rode os 32 testes de `14_CASOS_DE_TESTE.md`.
7. Siga `21_CHECKLIST_DE_IMPLANTACAO.md` na ordem.

## O que foi encontrado

Prompts de sistema (6), prompts dinâmicos montados em runtime (4), 11 aprendizados persistidos, 1 manual operacional em Markdown, 4 mensagens fixas de fallback/transbordo, regras de qualificação em código (`lead-core.server.ts`) com 3 parâmetros editáveis em `site_settings`, 12 integrações, 41 nomes de variáveis de ambiente, 24 tabelas relacionadas.

## O que NÃO pôde ser localizado / não existe

- **Nenhuma tabela de FAQ estruturada.** As perguntas frequentes existem apenas em `docs/MANUAL_OPERACIONAL_LIZ_IA.md` e dentro dos prompts.
- **Nenhum documento na base vetorial** (`kb_documents` vazio).
- **Nenhuma tabela de templates de mensagem do WhatsApp.** Os textos automáticos estão hard-coded (ver `13_TEMPLATES_DE_MENSAGENS.md`).
- **Nenhuma persona de canal cadastrada** (`wa_channels` vazio).
- **Nenhuma configuração de temperatura/max tokens** na maioria das chamadas — usam o default do provedor.
- **Preços, prazos de instalação e condições de garantia não existem em nenhuma fonte do sistema.** O manual cita financiamento e economia, mas não tabela de preço. Isso é uma lacuna real, registrada em `16_LACUNAS_CONFLITOS_E_DUPLICIDADES.md`.

## Riscos e pendências críticas

1. **Conflito de raio de cobertura**: o prompt e o manual dizem **400 km**; o script oficial de desqualificação geográfica (seção 4.A do manual) diz **200 km**. Precisa de decisão humana.
2. **Conflito de economia prometida**: aprendizado salvo diz "até 90%, nunca 95%"; o manual diz "entre 85% e 90%". Compatíveis, mas o novo agente deve usar **até 90%**.
3. **Código legado ativo no repositório**: `autoRegisterPloomesLeadIfQualified` (em `wa-orchestrator.server.ts:460-680`) contém cidades hard-coded e envio direto ao formulário Ploomes. Está **desativado** (não é chamado), mas não foi removido — não reproduza esse comportamento.
4. **A LIZ está pausada** — qualquer teste comparativo "novo agente vs. atual" precisa reativação consciente.

## Privacidade

Nenhum token, chave, senha ou cookie foi exportado. Dados de clientes foram anonimizados. Apenas **nomes** de variáveis de ambiente aparecem, nunca valores.
