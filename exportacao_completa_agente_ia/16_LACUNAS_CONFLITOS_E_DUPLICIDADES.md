# 16 — Lacunas, conflitos e duplicidades

## 1. CONFLITOS (duas fontes dizem coisas diferentes — exigem decisão humana)

| # | Tema | Fonte A | Fonte B | Recomendação da auditoria |
|---|---|---|---|---|
| C1 | **Raio de cobertura** | `liz-prompt.ts`: **400 km** | Script de recusa no manual: **200 km** | Adotar 400 km e reescrever o script T09. |
| C2 | **Carência do financiamento** | Manual: **120 dias** | `liz_aprendizados` (SDR): **90 dias** | Usar 90 dias até confirmação do comercial. |
| C3 | **Economia** | Manual objeção: "85% a 90%" | Aprendizado: "**até 90%**, nunca 95%" | Compatíveis. Teto absoluto 90%. |
| C4 | **Valor em faixa** | Extrator: "entre 300 e 400" → **350** (média) | `parseMoneyBR` do formulário: "R$ 400 a R$ 700" → **400** (piso) | Padronizar em uma regra só; a auditoria sugere o **piso** (mais conservador para qualificação). |
| C5 | **Modelo de IA** | `gemini-2.5-flash`, `gemini-3.6-flash`, `gemini-3.7-flash`, `gemini-3-flash-preview` em caminhos diferentes | — | Padronizar um modelo por finalidade. |
| C6 | **Envio ao Ploomes** | Fluxo atual: fila `lead_sync_queue` | Legado em `wa-orchestrator.server.ts:460-680`: envio direto | O legado está **desativado** e deve permanecer assim. Não reproduzir na nova IA. |

## 2. LACUNAS (não existe no sistema — precisa vir de humano)

### Críticas para vender
1. Tabela de preços / faixas de investimento.
2. Kits, potências (kWp) e geração estimada.
3. Marcas e modelos de painel.
4. Prazos de proposta, projeto, homologação e instalação.
5. Garantias (produto, performance, instalação, serviço).
6. Bancos parceiros, taxas e número de parcelas.
7. Condições à vista e descontos.

### Operacionais
8. Razão social e CNPJ.
9. Endereços completos das três bases.
10. Telefone e e-mail públicos de atendimento.
11. Horário de atendimento (`wa_channels` está vazia).
12. Política de pós-venda, manutenção e limpeza.
13. Política de cancelamento/distrato.
14. Roteamento de transbordo por unidade (hoje tudo vai para a Stephany).

### De conhecimento
15. **Base vetorial vazia**: `kb_documents` e `kb_chunks` = 0. A infraestrutura de RAG existe e não tem um único documento.
16. Nenhuma tabela de FAQ, de templates ou de persona — tudo está hardcoded em prompt.
17. Só **11 aprendizados** persistidos, todos de duas categorias.
18. Nenhum caso de teste automatizado da IA existia antes deste pacote.

## 3. DUPLICIDADES (mesma regra em mais de um lugar)

| Regra | Onde se repete | Risco |
|---|---|---|
| Piso de R$ 200 | prompt de captura, manual, `lead-core.server.ts` (`leads:min_fatura`) | Mudar o parâmetro no painel **não** muda o texto do prompt — a IA continua falando 200. |
| Raio de cobertura | prompt (400), manual/script (200) | Já é o conflito C1. |
| Pausa da Liz | `LIZ_WHATSAPP_FORCE_PAUSED` no código + `liz_paused` no banco | Duplicidade **intencional** (dupla trava). Manter. |
| Instrução de qualificação | prompt de captura + 6 dos 11 aprendizados | Redundância inofensiva, mas infla o prompt. |
| Cidade/valor perguntados | prompt + 3 aprendizados diferentes | Consolidar em um aprendizado só. |

## 4. RISCOS OBSERVADOS

1. **Parâmetro editável desalinhado do prompt** (duplicidade acima) — maior risco de a IA falar um número diferente da regra vigente.
2. **Sem timeout explícito** nas chamadas de modelo no caminho do WhatsApp.
3. **Histórico anterior à conexão da Z-API é irrecuperável** — limitação real do WhatsApp multi-dispositivo, não bug.
4. **`wa_channels` vazia** significa que horário comercial, modo sombra e allowlist rodam em valores implícitos do código.
5. **RAG ocioso** — todo o conhecimento depende do prompt, que tem limite prático de tamanho.
6. Linter do banco reporta ~46 apontamentos, majoritariamente preexistentes (RLS/policies e funções `SECURITY DEFINER`).

## 5. O QUE NÃO PODE SER ALTERADO SEM AUTORIZAÇÃO EXPLÍCITA

- `LIZ_WHATSAPP_FORCE_PAUSED = true`
- `organizations.settings.liz_paused = true`
- `LIZ_AUTO_REPLY_ENABLED = false`
- Legado de envio direto ao Ploomes (deve continuar desativado)
- Regra "Alison Barbosa é analista de marketing, nunca diretor"
- Proibição de comentar desempenho dos quatro supervisores no fórum
