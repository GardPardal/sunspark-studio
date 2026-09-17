# 04 — Produtos, serviços, preços e condições

> **AVISO CRÍTICO DE COBERTURA.** O sistema atual **não possui catálogo de produtos, tabela de preços, tabela de potências, lista de garantias nem prazos de execução em nenhuma fonte** (nem em código, nem em prompt, nem em tabela, nem em documento). A IA atual **nunca informa preço** — ela é proibida de inventar e encaminha para a SDR Stephany. Este arquivo documenta o que existe de fato e marca o que falta. Não foi criado nenhum preço fictício.

## 1. Linhas de produto/serviço identificadas

Fonte: rotas públicas do site (`src/routes/`) e campos de segmento do CRM.

| Produto/serviço | Evidência | Preço no sistema |
|---|---|---|
| Energia solar **residencial** | rota pública `energia-solar-residencial`, segmento `residencial` no extrator | não existe |
| Energia solar **comercial** | rota pública `energia-solar-comercial`, segmento `comercial` | não existe |
| Energia solar **industrial** | rota pública `energia-solar-industrial`, segmento `industrial` | não existe |
| Energia solar **rural** | rota pública `energia-solar-rural`, segmento `rural` | não existe |
| **Carport solar** (garagem solar) | rota pública `carport-solar` | não existe |
| **Sistemas híbridos / baterias** | rota pública `sistemas-hibridos` | não existe |
| **Retrofit** (troca do inversor por híbrido + baterias, para quem já tem sistema) | 2 registros em `liz_aprendizados`, categoria `DADO_TECNICO` | não existe |
| **Aumento de sistema** | etiqueta/origem no Ploomes | não existe |
| Estudo/dimensionamento gratuito | script C de fechamento | gratuito |

## 2. Condições comerciais confirmadas

| Condição | Valor | Fonte | Confiança |
|---|---|---|---|
| Economia na conta | **até 90%** | `liz_aprendizados` (regra explícita: nunca dizer 95%) | confirmado |
| Economia média citada em objeção | 85% a 90% | manual §5.1 | confirmado |
| Payback médio | 3 a 4 anos | manual §5.1 | confirmado |
| Vida útil do sistema | mais de 25 anos | manual §5.1 | confirmado |
| Entrada | **não há** — 100% financiável | manual §5.3 + `liz_aprendizados` | confirmado |
| Carência do financiamento | **90 dias** (aprendizado SDR) vs **120 dias** (manual) | conflitantes | **CONFLITO** |
| Ticket mínimo de qualificação | conta ≥ **R$ 200/mês** | `lead-core.server.ts:172` (`leads:min_fatura`, editável) | confirmado |
| Exceção ao ticket mínimo | aceito abaixo de R$ 200 se houver **plano declarado de aumentar consumo** | manual §2 pilar 2 + `liz_aprendizados` | confirmado |
| Sistema conectado à rede | sim — continua ligado à Copel/Elektro, energia 24h | manual §5.1 objeção 2 | confirmado |
| Funcionamento em dia nublado/chuva | sim, com menor captação | manual §5.1 objeção 2 | confirmado |
| Impacto da Lei 14.300 | mantém a viabilidade | manual §5.1 objeção 1 | confirmado |

## 3. Marcas de inversor citadas

Growatt, Deye, Solis — citadas apenas como referência de dimensionamento no pilar de padrão elétrico. **Não há tabela de módulos, potências, marcas de painel ou kits.**

## 4. Dados técnicos coletados do cliente (o que a IA precisa levantar)

| Dado | Obrigatório | Fonte |
|---|---|---|
| Cidade/UF do imóvel | sim (bloqueante) | `lead-core.server.ts` |
| Valor médio da conta (R$/mês) | sim (bloqueante) | `lead-core.server.ts` |
| Padrão elétrico (110V/220V, mono/bi/trifásico) | gera pendência, não bloqueia | `lead-core.server.ts` |
| Fatura de energia (foto/PDF) | opcional por padrão; bloqueante se `leads:exigir_fatura=true` | `lead-core.server.ts:173` |
| Segmento (residencial/comercial/industrial/rural) | pendência | extrator |
| Previsão de aumento de consumo | recomendado — vira margem no dimensionamento (ex.: sobra de 100 kWh) | `liz_aprendizados` |
| Nº de placas atuais (só em retrofit) | sim, nesse caso | `liz_aprendizados` |
| Terreno: consumo próprio ou venda de energia | sim, nesse caso | `liz_aprendizados` |

## 5. Lacunas declaradas (a nova IA precisará receber isso de humano)

Nenhum destes itens existe no sistema atual:

1. Tabela de preços ou faixas de investimento por potência.
2. Tabela de kits/potências (kWp) e geração estimada.
3. Marcas e modelos de painéis.
4. Prazos: de proposta, de projeto, de homologação, de instalação.
5. Garantias: de produto, de performance, de instalação, de serviço.
6. Bancos/linhas de financiamento parceiras e taxas.
7. Formas de pagamento à vista e descontos.
8. Política de pós-venda, manutenção e limpeza.
9. Política de cancelamento/distrato.
10. Termos de garantia por escrito.

> Enquanto esses dados não forem fornecidos, a instrução correta para a nova IA é a mesma da atual: **não informar preço, prazo ou garantia — transferir para a SDR Stephany.**
