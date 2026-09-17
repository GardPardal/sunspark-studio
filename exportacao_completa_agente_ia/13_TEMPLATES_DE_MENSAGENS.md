# 13 — Templates de mensagens

> O sistema **não tem tabela de templates**. Todos os textos abaixo são os que existem literalmente em prompt, manual ou aprendizados. Textos marcados `[derivado]` foram montados a partir das regras existentes para dar cobertura operacional e estão sinalizados como interpretação da auditoria — não são texto oficial aprovado.

## T01 — Saudação (oficial, `liz-prompt.ts`)
> Olá! Tudo bem? Me chamo Liz, da LZ7 Energia. Como posso te ajudar hoje? ☀️

## T02 — Pergunta de cidade `[derivado]`
> Perfeito! Em qual cidade fica o imóvel?

## T03 — Pergunta de valor da conta `[derivado do aprendizado de qualificação inicial]`
> E quanto vem, em média, a sua conta de luz por mês?

## T04 — Sondagem de aumento de consumo (conta < R$ 200) — regra oficial, texto `[derivado]`
> Entendi! Você pretende aumentar o consumo por aí, tipo instalar ar-condicionado ou algum aparelho novo?

## T05 — Pergunta de padrão elétrico (oficial em conteúdo, `liz_aprendizados`)
> Só mais uma: o padrão aí é monofásico (110V) ou bifásico (110V e 220V)?

## T06 — Pedido da fatura `[derivado]`
> Pode me mandar uma foto ou o PDF da última conta de luz? Assim a engenharia calcula sua economia exata.

## T07 — Fechamento de lead qualificado (oficial, manual §5)
> Perfeito! Já recebi seus dados e a cópia da sua fatura. Nossos engenheiros estão calculando agora o seu dimensionamento e a consultora Stephany da LZ7 entrará em contato em instantes para apresentar o seu estudo de economia gratuito! 😊☀️

## T08 — Acolhimento de lead do Quiz `[derivado da regra oficial]`
> Oi, {nome}! Recebi sua simulação aqui de {cidade}. Já estou passando pro consultor montar sua proposta sob medida. Quer aproveitar e tirar alguma dúvida enquanto isso? ☀️

## T09 — Recusa por cobertura (oficial, manual §5.4)
> Poxa, que pena! No momento a LZ7 Energia atua em um raio de até 200km das nossas bases em Londrina, Ponta Grossa e Wenceslau Braz para garantir nossa assistência técnica e instalação de excelência. Por estar fora desse raio hoje, não conseguimos te atender no momento, mas deixarei seu contato salvo com muito carinho para futuras expansões! ☀️
>
> ⚠️ Trocar 200 km por 400 km ao reutilizar.

## T10 — Recusa por consumo baixo (oficial, manual §5.4)
> Entendi perfeitamente! Como seu consumo é mais baixinho (menos de R$ 200 por mês), a taxa mínima obrigatória da concessionária faz com que o investimento em painéis solares próprios demore bastante para se pagar. Por isso, para a sua faixa de consumo hoje não compensa fazer o investimento na usina. De qualquer forma, agradeço muito pelo seu contato e fico à disposição se no futuro seu consumo aumentar! ⚡

## T11 — Transbordo por pedido de humano (oficial)
> Claro! Já estou chamando a Stephany da nossa equipe para continuar com você por aqui. 🙂

## T12 — Transbordo por tema sensível (oficial)
> Esse assunto eu prefiro passar direto para um especialista do time. Já estou encaminhando para a Stephany!

## T13 — Informação que a IA não tem (oficial)
> Deixa eu confirmar isso com o time pra não te passar informação errada. Já te retorno por aqui. 🙂

## T14 — Objeção Lei 14.300 (oficial)
> Compensa e muito! Mesmo com a Lei 14.300, a economia média na conta de luz continua entre 85% e 90%. O sistema se paga em média de 3 a 4 anos e dura mais de 25 anos gerando energia de graça para o seu imóvel!

## T15 — Objeção dia nublado (oficial)
> Não fica! O sistema continua captando a radiação solar mesmo em dias nublados e de chuva. Além disso, o imóvel continua conectado à rede da Copel/Elektro, garantindo energia estável 24 horas por dia.

## T16 — Objeção entrada/financiamento (oficial, ajustar carência)
> Não precisa! Trabalhamos com linhas de financiamento solar bancário com até 90 dias de carência para começar a pagar e parcelas que muitas vezes ficam no mesmo valor que você já gasta hoje na conta de luz.

## T17 — Retrofit / baterias (oficial em conteúdo, `liz_aprendizados`)
> Nesse caso a gente faz um retrofit: troca o inversor atual por um híbrido e instala as baterias. Quantas placas seu sistema tem hoje?

## T18 — Terreno (oficial em conteúdo, `liz_aprendizados`)
> Legal! Esse terreno seria pra consumo próprio ou você pensa em venda de energia?

## T19 — Reativação de lead antigo (oficial em conteúdo, `liz_aprendizados`)
> Que bom que retornou! Pra eu já adiantar aqui: qual o valor médio mensal da sua conta de luz?

## T20 — Recebimento de áudio `[derivado]`
> (Responder diretamente ao assunto falado, sem avisar que era áudio.)

## T21 — Opt-out
> (Nenhuma mensagem. O sistema encerra em silêncio e registra o descadastro.)

## Regras de formatação válidas para todos
1–2 frases curtas. No máximo 1 emoji. Sem "Prezado(a)", "Oizão", "Eba". Sem textão. Sem markdown no WhatsApp. Nunca repetir pergunta já respondida.
