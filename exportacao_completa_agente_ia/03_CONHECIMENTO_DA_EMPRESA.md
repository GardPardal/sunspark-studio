# 03 — Conhecimento da empresa

`confidence`: confirmado onde houver fonte citada; `inferido` está marcado explicitamente. Nada aqui foi inventado.

## 1. Identificação

| Item | Valor | Fonte | Confiança |
|---|---|---|---|
| Nome fantasia | **LZ7 Energia Solar** / LZ7 Energia | `liz-prompt.ts:1`, `organizations.name = "LZ7 Energia"` | confirmado |
| Razão social | **NÃO ENCONTRADA** em nenhuma fonte do sistema | — | lacuna |
| CNPJ | **NÃO ENCONTRADO** | — | lacuna |
| Site institucional | `https://lz7energia.com.br` e `https://www.lz7energia.com.br` | `liz-forum-prompt.ts:156`, domínios do projeto | confirmado |
| Painel interno | `/dashhub` (Sala de Comando), Solar OS autenticado | rotas do projeto | confirmado |
| Ramo | Geração distribuída fotovoltaica (residencial, comercial, industrial, rural, carport, híbridos) | rotas públicas `energia-solar-*`, `carport-solar`, `sistemas-hibridos` | confirmado |

## 2. Bases operacionais e cobertura (raio 400 km)

Fonte: `docs/MANUAL_OPERACIONAL_LIZ_IA.md` §4 + `liz-prompt.ts:9`.

### Sede — Wenceslau Braz (PR)
Regiões: Norte Pioneiro do Paraná, Vale do Itararé, Sudoeste Paulista, Vale do Paranapanema, Centro Paulista.
Cidades: Wenceslau Braz, Tomazina, Santana do Itararé, Siqueira Campos, Arapoti, Jaguariaíva, Sengés, Itararé (SP), Ibaiti, Santo Antônio da Platina, Jacarezinho, Cambará, Ourinhos (SP), Assis (SP), Avaré (SP), Bauru (SP), Marília (SP).

### Filial 1 — Londrina (PR)
Regiões: Norte Central, Noroeste Paranaense, Vale do Ivaí, Oeste Paulista.
Cidades: Londrina, Cambé, Ibiporã, Rolândia, Arapongas, Apucarana, Bela Vista do Paraíso, Sertanópolis, Cornélio Procópio, Assaí, Maringá, Mandaguari, Astorga, Jandaia do Sul, Ivaiporã, Paranavaí, Umuarama, Cianorte, Campo Mourão, Presidente Prudente (SP).

### Filial 2 — Ponta Grossa (PR)
Regiões: Campos Gerais, Centro-Sul, Região Metropolitana de Curitiba, Litoral Paranaense, Planalto Norte e Vale do Itajaí (SC).
Cidades: Ponta Grossa, Castro, Carambeí, Palmeira, Ipiranga, Teixeira Soares, Telêmaco Borba, Tibagi, Irati, Campo Largo, Curitiba e RMC, Paranaguá, Joinville (SC), Jaraguá do Sul (SC), Mafra (SC), São Bento do Sul (SC).

### Quarta unidade
**Representantes** — existe como unidade no CRM (`unit_enum` inclui `representantes`) e no painel (`liz-forum-prompt.ts:115`), sem cidades mapeadas.

Estados citados na cobertura: **PR, SP, SC, MS**.

## 3. Endereços, telefones e horários

- **Endereços completos: NÃO ENCONTRADOS** em nenhuma fonte do sistema (só cidades das bases).
- **Telefone/WhatsApp oficial: não exportado** — o número está atrelado à instância Z-API (`ZAPI_INSTANCE_ID`), cujo valor é segredo.
- **Horário de atendimento**: existe o campo `wa_channels.business_hours` no schema, mas a tabela está **vazia** — nenhum horário configurado. O prompt do fórum menciona a rotina comercial interna 08:00–18:20 (ver §6), que é operação interna, não horário de atendimento publicado.

## 4. Equipe e responsáveis

| Pessoa | Papel | Fonte |
|---|---|---|
| **Stephany Martins** | SDR — destinatária de todo transbordo e de todo lead qualificado | manual §1, `wa-orchestrator.server.ts:322,329` |
| **Alison Barbosa** | Analista de marketing (**nunca chamar de diretor**) | `liz-forum-prompt.ts:74-89` |
| **Paloma Stalen** | RH (acesso isolado ao módulo `/mod/rh`) | papel `rh` no sistema |
| Pamela Martins, Thiago Paiva, Ademir Silva, Adonias Pereira da Silva | Supervisores comerciais — **desempenho deles não pode ser comentado no fórum** | `liz-forum-prompt.ts:42-52` |
| Coordenador | Roda a semana: seg. Wenceslau Braz · ter/qua Ponta Grossa · qui/sex Londrina | `liz-forum-prompt.ts:111-112` |

Time comercial: **17 pessoas** (`liz-forum-prompt.ts:116`).

Papéis de acesso no sistema: `admin`, `diretor`, `coordenador`, `sdr`, `consultor`, `rh`.

## 5. Concessionárias e marcas técnicas citadas

- Concessionárias: **Copel** (PR), **Elektro** (SP). Fonte: manual §5.2, `wa-knowledge.server.ts:85`.
- Inversores citados como referência de dimensionamento: **Growatt, Deye, Solis**. Fonte: manual §2, pilar 3.
- Regulação citada: **Lei 14.300** (marco legal da geração distribuída) e **ANEEL** (base de market share).

## 6. Rotina comercial interna (contexto usado pelo Cérebro do Fórum)

Fonte: `liz-forum-prompt.ts:95-112`. Mesma grade para vendedor e supervisor:

| Bloco | Vendedor | Supervisor |
|---|---|---|
| 08:00–09:00 | daily com a supervisão | avalia o dia anterior, cobra prospecção, instrui fechamentos |
| 09:00–10:00 | liga para os leads do dia anterior | liga nos próprios + valida 3 ligações de cada vendedor |
| 10:00–12:00 | prospecção porta a porta (PAP) | acompanha no PAP e direciona o território |
| 13:00–17:00 | apresentações | apresenta as próprias + acompanha 1 de cada vendedor |
| 17:00–18:00 | prospecção | prospecção |
| 18:00–18:20 | fechamento do dia | mensagem individual para cada vendedor com os números |

Na **segunda-feira** o supervisor tem reunião das 9h às 14h — a equipe fica sozinha na rua, então a daily de segunda é a mais detalhada da semana.

## 7. Regras de leitura de indicadores (contexto do fórum, `liz-forum-prompt.ts:118-151`)

- **Aderência é a hora do REGISTRO no CRM, não a hora da ação.**
- **O bloco de PAP não tem medição real** — o Ploomes tem check-in geolocalizado e ninguém usa (zero check-ins).
- **Vendido ≠ entregue.** Vendido = negócio ganho no Ploomes; entregue = planilha de instalações.
- **O Ploomes não tem faturamento confiável** — não responder pergunta de faturamento com dado do CRM.
- **Não existem metas cadastradas no Ploomes** — compara-se cada pessoa com a própria média do ano.
- **Market share só vale de janeiro a abril de 2026** (base ANEEL sai defasada).
- **O Meta reporta muito mais "leads" que o CRM** — nunca dividir um pelo outro.
- **Negócios perdidos quase todos sem motivo cadastrado** (existem 20 motivos no campo).
- Tempo de resposta ao lead pago: Sede ~6h de mediana → converte ~7%; Ponta Grossa ~33h → ~1,3%; Londrina ~24h → ~1,1%.
- Carteira sem responsável quando alguém é desligado; agenda vencida acumulada é o sintoma mais precoce de queda.

## 8. Políticas comerciais e de atendimento

| Política | Conteúdo | Fonte |
|---|---|---|
| Princípio de atendimento | "Ajudar primeiro, vender depois" | manual §1 |
| Economia prometida | **Até 90%** na conta (nunca 95%) | `liz_aprendizados` |
| Payback | 3 a 4 anos em média | manual §5.1 |
| Vida útil | Mais de 25 anos | manual §5.1 |
| Financiamento | 100% financiado, sem entrada, carência até 90 dias (aprendizado SDR) / até 120 dias (manual) — **conflito** | `liz_aprendizados`, manual §5.3 |
| Ticket mínimo | Conta ≥ R$ 200/mês (parâmetro editável `leads:min_fatura`) | `lead-core.server.ts:172` |
| Consentimento | Opt-out por palavra-chave, registrado em `wa_consents` | `wa-orchestrator.server.ts:98-104` |
| Pós-venda | Existe funil "Pós-venda" no Ploomes (pipeline 60000567); **nenhuma regra de atendimento pós-venda para a IA foi encontrada** | — |
| Garantia | **NÃO ENCONTRADA** em nenhuma fonte | — |
| Prazo de instalação | **NÃO ENCONTRADO** | — |
