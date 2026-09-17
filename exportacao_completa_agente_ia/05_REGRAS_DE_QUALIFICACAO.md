# 05 — Regras de qualificação

Fontes: `src/lib/leads/lead-core.server.ts:164-260`, `src/lib/leads/liz-qualify.server.ts:9-55`, `docs/MANUAL_OPERACIONAL_LIZ_IA.md` §2-§3, `site_settings`.

## 1. Parâmetros editáveis (tabela `site_settings`)

| Chave | Padrão | Efeito |
|---|---|---|
| `leads:min_fatura` | `200` | Valor mínimo da conta em R$ para qualificar |
| `leads:exigir_fatura` | `false` | Se `true`, anexo da fatura vira bloqueante |
| `ploomes:default_owner_id` | vazio | Responsável padrão no Ploomes; se vazio, não define |

> Alterar esses valores no painel muda a regra em runtime, sem deploy. A nova IA precisa ler esses parâmetros, não codificá-los.

## 2. Campos bloqueantes (impedem `qualificado`)

1. **nome** — só se o cliente se apresentou explicitamente. Nome de perfil do WhatsApp não conta.
2. **telefone** — normalizado E.164/BR.
3. **cidade** — informada pelo cliente. **Proibido deduzir pelo DDD.**
4. **valor médio da fatura** — ≥ `leads:min_fatura`.
5. **fatura anexada** — apenas se `leads:exigir_fatura = true`.

## 3. Campos de pendência (registram, mas não bloqueiam)

- Padrão elétrico / tipo de ligação (monofásico, bifásico, trifásico, 110V, 220V).
- Interesse/segmento (residencial, comercial, industrial, rural).
- E-mail.
- CPF/CNPJ.
- Consentimentos.

Cada ausência gera item na lista de pendências do lead, visível em `/mod/leads`.

## 4. Schema exato do extrator (Zod, `liz-qualify.server.ts:9-44`)

```
nome                 string | null
cidade               string | null
uf                   string | null
valor_conta          number | null   // reais
tipo_ligacao         "monofasico" | "bifasico" | "trifasico" | null
segmento             "residencial" | "comercial" | "industrial" | "rural" | null
email                string | null
documento            string | null   // CPF/CNPJ
interesse            string | null
tem_fatura           boolean
recusou_fatura       boolean
pediu_humano         boolean
sem_interesse        boolean
confianca            number          // 0..1
```

Parâmetros do modelo: `temperature: 0`, `maxRetries: 1`.

### Regras de preenchimento (íntegras)
- Só preencher se o **cliente** informou explicitamente; senão `null`.
- Nunca deduzir cidade pelo DDD, nunca chutar valor, nunca escolher tipo de ligação não declarado.
- Pergunta da Liz **não conta** como resposta.
- `valor_conta` em número: "uns 350" → 350; "entre 300 e 400" → 350; "R$ 1.200,00" → 1200.
- Faixas monetárias usam o piso na ingestão de formulário (`parseMoneyBR`: "R$ 400 a R$ 700" → 400) — **divergência conhecida** com a regra de média do extrator; ver `16_`.

## 5. Os 4 pilares (critério humano oficial, manual §2)

| Pilar | Aceita | Corta | Motivo |
|---|---|---|---|
| Cobertura geográfica | até 400 km de qualquer base (PR/SP/SC/MS) | > 400 km de todas | viabilidade de vistoria/instalação/pós-venda |
| Valor da fatura | ≥ R$ 200/mês **ou** plano de aumento de consumo | < R$ 200 **e** sem aumento previsto | taxa mínima de disponibilidade alonga o payback |
| Padrão elétrico | 110V ou 220V identificado | sem padrão instalado / rede clandestina | dimensionar inversor e prever adequação |
| Fatura de energia | foto/PDF recente ou kWh | recusa expressa | histórico 12 meses e tipo de tarifa |

## 6. Regra de ouro do Quiz

Todo lead vindo do Quiz/formulário público **já entra aprovado**. Não desqualificar, não repetir perguntas já respondidas. Fonte: `liz-prompt.ts` (bloco Quiz) e manual §3.

## 7. Estados do lead e efeito no Ploomes

| Estado | Significado | Sincroniza com Ploomes? |
|---|---|---|
| `novo` | ingerido, sem análise | não |
| `em_qualificacao` | conversa em andamento, faltam bloqueantes | não |
| `qualificado` | todos os bloqueantes preenchidos | **sim**, entra em `lead_sync_queue` |
| `humano` | atendimento assumido por pessoa | **sim** |
| `desqualificado` | falhou em pilar | não |
| `opt_out` | pediu descadastro | não |

Regra permanente: **o lead sempre nasce no CRM interno primeiro**; o Ploomes é destino, nunca origem do fluxo de captação.

## 8. Deduplicação

Chaves, em ordem: telefone normalizado → CPF/CNPJ → e-mail → IDs externos (Meta, formulário) → conversa WhatsApp → IDs Ploomes (`ploomes_contact_id`, `ploomes_deal_id`).
Webhooks são idempotentes por hash de evento. **Duplicados nunca são apagados automaticamente** — são marcados e consolidados manualmente, preservando histórico.

## 9. Proibições absolutas na qualificação

- Não inventar cidade, valor, tipo de ligação, filial, produto ou vendedor.
- Cidade só recebe `CityId` do Ploomes em **correspondência única e exata**; ambiguidade → campo vazio.
- Campos ausentes vão como `null`/vazio/"Não informado" — nunca preenchidos com placeholder plausível.
