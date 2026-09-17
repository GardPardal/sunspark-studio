# 22 — Relatório de cobertura

## 1. Arquivos entregues (23 + ZIP)

| Arquivo | Estado | Origem predominante |
|---|---|---|
| 00_LEIA_PRIMEIRO.md | completo | auditoria |
| 01_PROMPT_MESTRE_COMPLETO.md | completo | prompts íntegros + manual + aprendizados |
| 02_IDENTIDADE_E_TOM_DE_VOZ.md | completo | `liz-prompt.ts`, `liz-training.functions.ts` |
| 03_CONHECIMENTO_DA_EMPRESA.md | completo com lacunas declaradas | manual + banco + prompt do fórum |
| 04_PRODUTOS_SERVICOS_PRECOS_E_CONDICOES.md | **parcial por ausência de fonte** | rotas + manual + aprendizados |
| 05_REGRAS_DE_QUALIFICACAO.md | completo | código + manual |
| 06_FLUXOS_DE_ATENDIMENTO.md | completo | código |
| 07_FAQ_OBJECOES_E_RESPOSTAS.md | **parcial por ausência de fonte** | manual + aprendizados |
| 08_INTEGRACOES_E_FERRAMENTAS.md | completo | código + docs |
| 09_MEMORIA_CONTEXTO_E_ESTADOS.md | completo | código + banco |
| 10_REGRAS_DE_TRANSFERENCIA_HUMANA.md | completo | `wa-orchestrator.server.ts` |
| 11_CONFIGURACAO_TECNICA_DO_MODELO.md | completo, com recomendações marcadas | código |
| 12_DICIONARIO_DE_DADOS.md | completo | schema + consultas |
| 13_TEMPLATES_DE_MENSAGENS.md | completo, derivados sinalizados | manual + prompt |
| 14_CASOS_DE_TESTE.md | 36 casos + 6 de regressão | auditoria |
| 15_INVENTARIO_DE_FONTES.md | completo | auditoria |
| 16_LACUNAS_CONFLITOS_E_DUPLICIDADES.md | completo | auditoria |
| 17_PAYLOADS_E_SCHEMAS.json | completo, JSON válido | código |
| 18_BASE_DE_CONHECIMENTO.json | 30 itens, JSON válido | todas as fontes |
| 19_FLUXOS_EM_MAQUINA_DE_ESTADOS.json | 5 máquinas, JSON válido | código |
| 20_PROMPT_COMPACTO.md | completo | condensação do 01 |
| 21_CHECKLIST_DE_IMPLANTACAO.md | completo | auditoria |
| 22_RELATORIO_DE_COBERTURA.md | este arquivo | auditoria |
| pacote_migracao_agente_ia.zip | gerado | todos acima |

## 2. Cobertura por domínio

| Domínio | Cobertura | Observação |
|---|---|---|
| Persona e tom de voz | **100%** | prompts exportados na íntegra |
| Fluxo de conversa | **100%** | todas as etapas e desvios |
| Regras de qualificação | **100%** | inclui parâmetros editáveis |
| Transferência humana | **100%** | gatilhos, ordem e frases oficiais |
| Memória e estados | **100%** | camadas, janelas e travas |
| Integrações | **100%** | sem nenhum valor de credencial |
| Modelo e parâmetros | **~70%** | muitos parâmetros são implícitos no código |
| Objeções e FAQ | **~25%** | só 3 objeções e 7 condutas existem no sistema |
| Produtos, preços, prazos, garantias | **~10%** | não existem no sistema — lacuna real, não omissão |
| Base vetorial | **0% de conteúdo** | infraestrutura existe, está vazia |

## 3. Validações executadas

- [x] Os três arquivos `.json` foram validados sintaticamente.
- [x] Todos os arquivos referenciados no doc 00 existem no diretório.
- [x] Nenhum token, chave, senha, cookie ou valor de variável de ambiente foi exportado — apenas **nomes** de variáveis.
- [x] Nenhum nome, telefone, e-mail ou documento de cliente foi exportado; exemplos são fictícios.
- [x] Nenhum arquivo do sistema foi alterado, apagado ou desativado pela auditoria.
- [x] As travas de pausa da Liz permanecem intactas.
- [x] Nomes de colaboradores internos foram mantidos porque são parte das regras operacionais (destinatário de transbordo, proteções do fórum), não dados de cliente.

## 4. O que a nova IA NÃO conseguirá reproduzir só com este pacote

1. **Preço, prazo e garantia** — não existem em lugar nenhum; precisa vir da diretoria.
2. **Histórico anterior à conexão da Z-API** — limitação técnica do WhatsApp, irrecuperável.
3. **Conhecimento tácito da SDR** que nunca foi registrado como aprendizado.
4. **Parâmetros exatos de modelo** onde o código usa o padrão do provedor.

## 5. Interpretações da auditoria (não são fonte do sistema)

Marcadas ao longo dos documentos. As principais:
- Recomendação de usar 90 dias de carência e 400 km de raio nos conflitos C1/C2.
- Recomendação de usar o piso em faixas de valor (C4).
- Tabela de parâmetros recomendados no doc 11.
- Templates marcados `[derivado]` no doc 13.
- Os 36 casos de teste do doc 14.

## 6. Conclusão

O pacote reproduz integralmente **como a IA atual conversa, qualifica, decide e transfere**. A limitação de cobertura está concentrada em **catálogo comercial** (preço, prazo, garantia), que não é uma omissão da exportação: **esse conteúdo não existe no sistema atual** — a IA de hoje também não o possui e por isso transfere para a SDR.
