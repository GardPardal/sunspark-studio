/**
 * Treinamento "DISC em Vendas LZ7" — conteúdo idêntico ao PDF, com o design da /apresentacao.
 * Cores fixas por animal: vermelho Leão · amarelo Papagaio · verde Cachorro · azul Coruja.
 */
import { motion } from "framer-motion";
import {
  Brain,
  Compass,
  Dices,
  Grid3x3,
  Repeat,
  ScrollText,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

import { EASE, Item } from "@/components/apresentacao/palco";

import {
  Capa,
  Cartao,
  Conteudo,
  Duas,
  Erro,
  Fala,
  Fim,
  Mantras,
  Rico,
  Tabela,
  type SlideTreino,
  type Tom,
} from "./blocos";

type Letra = "D" | "I" | "S" | "C";

const ANIMAL: Record<
  Letra,
  {
    nome: string;
    emoji: string;
    perfil: string;
    bg: string;
    text: string;
    caixa: string;
    tag: "disc-d" | "disc-i" | "disc-s" | "disc-c";
  }
> = {
  D: {
    nome: "Leão",
    emoji: "🦁",
    perfil: "D · Dominante",
    bg: "bg-disc-d",
    text: "text-disc-d",
    caixa: "border-disc-d/45 bg-disc-d/12",
    tag: "disc-d",
  },
  I: {
    nome: "Papagaio",
    emoji: "🦜",
    perfil: "I · Influente",
    bg: "bg-disc-i",
    text: "text-disc-i",
    caixa: "border-disc-i/45 bg-disc-i/12",
    tag: "disc-i",
  },
  S: {
    nome: "Cachorro",
    emoji: "🐕",
    perfil: "S · Estável",
    bg: "bg-disc-s",
    text: "text-disc-s",
    caixa: "border-disc-s/45 bg-disc-s/12",
    tag: "disc-s",
  },
  C: {
    nome: "Coruja",
    emoji: "🦉",
    perfil: "C · Conforme",
    bg: "bg-disc-c",
    text: "text-disc-c",
    caixa: "border-disc-c/45 bg-disc-c/12",
    tag: "disc-c",
  },
};

const ORDEM: Letra[] = ["D", "I", "S", "C"];

const Emoji = ({ e, tam = 80, i = 0 }: { e: string; tam?: number; i?: number }) => (
  <motion.span
    className="inline-block leading-none"
    style={{ fontSize: tam }}
    initial={{ scale: 0, rotate: -15 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ delay: 0.2 + i * 0.12, type: "spring", stiffness: 200, damping: 13 }}
  >
    {e}
  </motion.span>
);

/* ---------------- "Se você é…" (vendedor) ---------------- */

function SeVoceE({
  l,
  titulo,
  frase,
  barras,
  poderes,
  kryptonita,
  treino,
}: {
  l: Letra;
  titulo: string;
  frase: string;
  barras: [number, number, number, number];
  poderes: string[];
  kryptonita: string[];
  treino: string[];
}) {
  const a = ANIMAL[l];
  return (
    <Conteudo
      tag={`${a.emoji} ${a.nome} · Vendedor`}
      corTag={a.tag}
      kicker={`Se você é ${a.nome.toLowerCase()}`}
      titulo={titulo}
    >
      <div className="mt-8 grid grid-cols-[300px_1fr] gap-8">
        <Item i={2} className="flex flex-col items-center text-center">
          <Emoji e={a.emoji} tam={120} />
          <div className={"mt-3 font-display text-[38px] font-semibold uppercase " + a.text}>
            {a.nome}
          </div>
          <div className="mt-1 text-[17px] italic text-apr-muted">{frase}</div>
          <div className="mt-7 w-full space-y-3">
            {(["Ritmo", "Pessoas", "Risco", "Dados"] as const).map((rot, k) => (
              <div key={rot} className="flex items-center gap-3">
                <span className="w-[78px] text-right text-[15px] font-semibold text-apr-muted">
                  {rot}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-apr-line/60">
                  <motion.div
                    className={"h-full rounded-full " + a.bg}
                    initial={{ width: 0 }}
                    animate={{ width: `${barras[k]}%` }}
                    transition={{ delay: 0.5 + k * 0.12, duration: 0.9, ease: EASE }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Item>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <Cartao titulo="💪 Superpoderes" tom="bom" i={3} tamanho={17}>
              <ul className="space-y-2 text-[19px] leading-snug text-apr-muted">
                {poderes.map((t) => (
                  <li key={t}>
                    • <Rico t={t} />
                  </li>
                ))}
              </ul>
            </Cartao>
            <Cartao titulo="☠ Kryptonita" tom="ruim" i={4} tamanho={17}>
              <ul className="space-y-2 text-[19px] leading-snug text-apr-muted">
                {kryptonita.map((t) => (
                  <li key={t}>
                    • <Rico t={t} />
                  </li>
                ))}
              </ul>
            </Cartao>
          </div>
          <Cartao titulo="🏋 Treino para fortalecer" tom="ouro" i={5}>
            <ul className="space-y-2 text-[19px] leading-snug text-apr-muted">
              {treino.map((t) => (
                <li key={t}>
                  • <Rico t={t} />
                </li>
              ))}
            </ul>
          </Cartao>
        </div>
      </div>
    </Conteudo>
  );
}

/* ---------------- "Vendendo para…" (cliente) ---------------- */

function VendendoPara({
  l,
  titulo,
  sinais,
  frase,
  faca,
  naoFaca,
  sentir,
  erro,
}: {
  l: Letra;
  titulo: string;
  sinais: [string, string][];
  frase: string;
  faca: string;
  naoFaca: string;
  sentir: string;
  erro: string;
}) {
  const a = ANIMAL[l];
  return (
    <Conteudo
      tag={`${a.emoji} ${a.nome} · Cliente`}
      corTag={a.tag}
      kicker={`Vendendo para ${l === "C" ? "a" : "o"} ${a.nome.toLowerCase()}`}
      titulo={titulo}
    >
      <Duas
        esquerda={
          <>
            <Cartao titulo="🔍 Reconheça em 30 segundos" i={2}>
              <ul className="space-y-2.5 text-[20px] leading-snug text-apr-muted">
                {sinais.map(([e, t]) => (
                  <li key={t} className="flex gap-3">
                    <span className="w-7 shrink-0 text-center">{e}</span>
                    <span>
                      <Rico t={t} />
                    </span>
                  </li>
                ))}
              </ul>
            </Cartao>
            <Fala rotulo="Frase que funciona" tom={l as Tom} i={3} tamanho={20} texto={frase} />
          </>
        }
        direita={
          <>
            <div className="grid grid-cols-2 gap-4">
              <Cartao
                titulo="✓ Faça"
                tom="bom"
                i={4}
                tamanho={16}
                textos={[faca]}
                className="p-5"
              />
              <Cartao
                titulo="✗ Não faça"
                tom="ruim"
                i={5}
                tamanho={16}
                textos={[naoFaca]}
                className="p-5"
              />
            </div>
            <Cartao titulo="🎯 O que ele quer sentir" i={6} tamanho={18} textos={[sentir]} />
            <Erro texto={erro} i={7} />
          </>
        }
      />
    </Conteudo>
  );
}

/* ---------------- slides ---------------- */

export const SLIDES_DISC: SlideTreino[] = [
  {
    id: "disc-capa",
    titulo: "DISC na mesa de vendas",
    icone: Brain,
    render: () => (
      <Capa
        kicker="Treinamento comportamental do time comercial LZ7"
        titulo="DISC na _mesa de vendas_"
        sub="Os 4 animais que você precisa reconhecer — ^no cliente e em você.^"
        enfeite={
          <div className="flex gap-6">
            {ORDEM.map((l, k) => (
              <Emoji key={l} e={ANIMAL[l].emoji} tam={84} i={k} />
            ))}
          </div>
        }
      />
    ),
  },
  {
    id: "disc-porque",
    titulo: "Por que DISC em vendas",
    icone: Compass,
    render: () => (
      <Conteudo
        tag="Comece por aqui"
        kicker="Por que DISC em vendas"
        titulo={'Você não vende para "um cliente". _Você vende para um perfil._'}
      >
        <Duas
          esquerda={
            <>
              <Item i={2} className="text-[22px] leading-relaxed text-apr-muted">
                <Rico t="O mesmo discurso que _fecha_ com um cliente ~espanta~ o outro. O Leão quer o número em 30 segundos. A Coruja quer o datasheet. O Cachorro quer saber quem vai cuidar dele. O Papagaio quer imaginar o churrasco." />
              </Item>
              <Fala
                rotulo="A regra"
                tom="bom"
                i={3}
                tamanho={19}
                texto="Perfil não é rótulo, é *mapa*. Reconheça o animal em 30 segundos e *mude o seu jogo* — sem deixar de ser você."
              />
              <Fala
                rotulo="E o tubarão?"
                tom="ouro"
                i={4}
                tamanho={19}
                texto="Tubarão não é perfil, é *atitude*. Qualquer animal pode ser tubarão na mesa — desde que conheça as próprias fraquezas."
              />
            </>
          }
          direita={
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ["D", '"Quanto custa e quando entrega?"'],
                  ["I", '"Meu vizinho vai ficar louco!"'],
                  ["S", '"E se der problema?"'],
                  ["C", '"Qual a eficiência do inversor?"'],
                ] as const
              ).map(([l, q], k) => (
                <Item
                  key={l}
                  i={3 + k}
                  className={
                    "flex h-[200px] flex-col items-center justify-center rounded-3xl border p-5 text-center " +
                    ANIMAL[l].caixa
                  }
                >
                  <Emoji e={ANIMAL[l].emoji} tam={64} i={k} />
                  <div
                    className={
                      "mt-3 font-display text-[21px] font-semibold leading-snug " + ANIMAL[l].text
                    }
                  >
                    {q}
                  </div>
                </Item>
              ))}
            </div>
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "disc-mapa",
    titulo: "O mapa: Ritmo × Foco",
    icone: Grid3x3,
    render: () => (
      <Conteudo
        tag="O mapa"
        kicker="Dois eixos, quatro animais"
        titulo="Ritmo × Foco: é assim que se lê qualquer pessoa."
      >
        <div className="mt-6 grid grid-cols-[1fr_440px] gap-10">
          <div className="relative px-12 py-9">
            <div className="absolute inset-x-0 top-0 text-center text-[14px] font-semibold uppercase tracking-[0.16em] text-apr-muted">
              ▲ Rápido · extrovertido · decide na hora
            </div>
            <div className="absolute inset-x-0 bottom-0 text-center text-[14px] font-semibold uppercase tracking-[0.16em] text-apr-muted">
              ▼ Calmo · reservado · pensa antes
            </div>
            <div className="absolute left-0 top-1/2 -translate-x-[38%] -translate-y-1/2 -rotate-90 whitespace-nowrap text-[14px] font-semibold uppercase tracking-[0.16em] text-apr-muted">
              ◀ Foco em tarefa / resultado
            </div>
            <div className="absolute right-0 top-1/2 translate-x-[38%] -translate-y-1/2 rotate-90 whitespace-nowrap text-[14px] font-semibold uppercase tracking-[0.16em] text-apr-muted">
              Foco em pessoas / relação ▶
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ["D", "D · Dominante", "Leão · resultado · comando"],
                  ["I", "I · Influente", "Papagaio · pessoas · entusiasmo"],
                  ["C", "C · Conforme", "Coruja · dados · precisão"],
                  ["S", "S · Estável", "Cachorro · segurança · lealdade"],
                ] as const
              ).map(([l, t, s], k) => (
                <motion.div
                  key={l}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + k * 0.12, duration: 0.6, ease: EASE }}
                  className={"relative h-[220px] overflow-hidden rounded-3xl p-6 " + ANIMAL[l].bg}
                >
                  <div className="font-display text-[30px] font-semibold text-apr-bg">{t}</div>
                  <div className="text-[16px] font-semibold text-apr-bg/80">{s}</div>
                  <span className="absolute bottom-3 right-4 text-[80px] leading-none">
                    {ANIMAL[l].emoji}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <Cartao
              titulo="⏱ Eixo 1 — Ritmo"
              i={3}
              tamanho={15.5}
              className="p-5"
              textos={[
                "Fala rápido, decide rápido, interrompe? *Topo* (Leão, Papagaio). Fala devagar, pondera, pede tempo? *Base* (Coruja, Cachorro).",
              ]}
            />
            <Cartao
              titulo="🎯 Eixo 2 — Foco"
              i={4}
              tamanho={15.5}
              className="p-5"
              textos={[
                "Fala de resultado, prazo, número? *Esquerda* (Leão, Coruja). Fala de gente, sentimento, família? *Direita* (Papagaio, Cachorro).",
              ]}
            />
            <Fala
              rotulo="Dica"
              tom="bom"
              i={5}
              tamanho={15.5}
              texto="Ninguém é 100% um animal. Todo mundo tem um *dominante* e um *secundário*. Leia o dominante e ajuste."
            />
          </div>
        </div>
      </Conteudo>
    ),
  },
  {
    id: "disc-elenco",
    titulo: "Os 4 animais",
    icone: Users,
    render: () => (
      <Conteudo
        tag="Os 4 animais"
        kicker="Apresentando o elenco"
        titulo="Decore os quatro. Você vai encontrá-los _toda semana._"
        rodape="Cor de cada animal vai se repetir no deck inteiro: [D]vermelho[/] Leão · [I]amarelo[/] Papagaio · [S]verde[/] Cachorro · [C]azul[/] Coruja."
      >
        <div className="mt-8 grid grid-cols-4 gap-5">
          {(
            [
              [
                "D",
                "Direto, competitivo, impaciente. Quer *resultado e controle*. Decide rápido e odeia rodeio.",
              ],
              [
                "I",
                "Falante, otimista, sociável. Quer *reconhecimento e emoção*. Compra pela história e pelo status.",
              ],
              [
                "S",
                "Calmo, leal, paciente. Quer *segurança e confiança*. Não gosta de pressão nem de mudança.",
              ],
              [
                "C",
                "Analítica, precisa, cética. Quer *dados e provas*. Compra quando os números fecham.",
              ],
            ] as const
          ).map(([l, t], k) => (
            <motion.div
              key={l}
              initial={{ opacity: 0, y: 40, rotateY: -25 }}
              animate={{ opacity: 1, y: 0, rotateY: 0 }}
              transition={{ delay: 0.3 + k * 0.15, duration: 0.8, ease: EASE }}
              className={
                "flex h-[510px] flex-col items-center rounded-[30px] p-8 text-center " +
                ANIMAL[l].bg
              }
            >
              <span className="text-[120px] leading-none">{ANIMAL[l].emoji}</span>
              <div className="mt-5 font-display text-[36px] font-semibold uppercase text-apr-bg">
                {ANIMAL[l].nome}
              </div>
              <div className="mt-1 text-[15px] font-semibold uppercase tracking-[0.18em] text-apr-bg/75">
                {ANIMAL[l].perfil}
              </div>
              <p className="mt-6 text-[19px] leading-snug text-apr-bg/90 [&_b]:text-apr-bg">
                <Rico t={t} />
              </p>
            </motion.div>
          ))}
        </div>
      </Conteudo>
    ),
  },
  {
    id: "disc-teste",
    titulo: "Teste rápido",
    icone: Dices,
    render: () => (
      <Conteudo
        tag="Teste rápido"
        kicker="Qual é o seu animal?"
        titulo="Responda de instinto. _Conte as letras._"
        rodape="A letra que mais aparece é o seu _dominante_; a segunda é o seu _secundário_. Anote os dois — os próximos slides são sobre você."
      >
        <div className="mt-8 grid grid-cols-2 gap-5">
          {(
            [
              [
                '1. Cliente diz "está caro". Sua reação interna:',
                [
                  '"Vou mostrar o valor e fechar agora."',
                  '"Vou contar o caso do cliente de Londrina."',
                  '"Ai… será que ele vai desistir?"',
                  '"Vou refazer o cálculo de payback."',
                ],
              ],
              [
                "2. Numa reunião você é quem…",
                [
                  "conduz e corta o papo furado.",
                  "faz todo mundo rir e se sentir bem.",
                  "ouve, apoia e evita conflito.",
                  "anota tudo e questiona os detalhes.",
                ],
              ],
              [
                "3. Seu maior medo na venda:",
                [
                  "perder o controle da negociação.",
                  "o cliente não gostar de mim.",
                  "pressionar demais e magoar.",
                  "dar uma informação errada.",
                ],
              ],
              [
                "4. Seu WhatsApp com cliente é…",
                [
                  'curto: "Fechamos? Sim ou não."',
                  "cheio de emoji, áudio e história.",
                  'gentil, paciente, "sem pressa".',
                  "uma proposta em PDF com 3 anexos.",
                ],
              ],
            ] as const
          ).map(([p, rs], k) => (
            <Cartao key={p} titulo={p} i={2 + k}>
              <ul className="space-y-2 text-[21px] text-apr-muted">
                {rs.map((r, j) => (
                  <li key={r} className="flex gap-3">
                    <span>{ANIMAL[ORDEM[j]].emoji}</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </Cartao>
          ))}
        </div>
      </Conteudo>
    ),
  },
  {
    id: "disc-leao-v",
    titulo: "Se você é Leão",
    icone: Trophy,
    render: () => (
      <SeVoceE
        l="D"
        titulo="O [D]Leão[/] fecha rápido — e às vezes fecha a porta rápido demais."
        frase={'"Vamos resolver isso agora."'}
        barras={[95, 30, 90, 35]}
        poderes={[
          "Pede a venda *sem medo*.",
          "Energia alta — o cliente sente convicção.",
          'Não aceita "vou pensar": vai atrás.',
          "Resolve objeção de frente, sem drama.",
          "Competitivo: bate meta.",
        ]}
        kryptonita={[
          "*Atropela* o cliente e pula a descoberta.",
          "Fala mais do que ouve.",
          "Impaciente com Cachorro e Coruja.",
          'Pode soar arrogante ou "vendedor de porta".',
          "Briga em vez de conduzir.",
        ]}
        treino={[
          "*Regra 70/30:* o cliente fala 70% do tempo. Cronometre.",
          "*3 perguntas antes do preço.* Sempre. Sem exceção.",
          "Conte até 3 antes de responder uma objeção — o silêncio te dá autoridade.",
          "Com Cachorro e Coruja: *reduza a velocidade pela metade* — vai parecer lento para você e normal para eles.",
        ]}
      />
    ),
  },
  {
    id: "disc-leao-c",
    titulo: "Vendendo para o Leão",
    icone: Trophy,
    render: () => (
      <VendendoPara
        l="D"
        titulo="Ele quer [D]resultado, rapidez e controle.[/] Dê os três."
        sinais={[
          ["🗣", "Fala rápido, direto, *interrompe*."],
          ["⏱", 'Olha o relógio; "vai direto ao ponto".'],
          ["💰", 'Primeira pergunta: *"quanto custa e quando entrega?"*'],
          ["🤝", "Aperto de mão firme, postura de dono."],
          ["📱", "WhatsApp de uma linha, sem emoji."],
        ]}
        frase={
          '"Vou direto: *3 motivos* para a LZ7 custar mais e entregar mais. Depois *o senhor decide*."'
        }
        faca="Resumo em 3 pontos · números e ROI · *2 ou 3 opções* para ele escolher · fale de resultado · feche rápido."
        naoFaca={
          'Rodeio ou papo social longo · detalhe técnico demais · dizer "não dá" · disputar quem manda.'
        }
        sentir="Que está *no comando*, que você *respeita o tempo dele*, e que comprar da LZ7 é a decisão de quem *ganha*."
        erro={
          'tentar "vencer" o Leão. Ele não compra de quem disputa o controle — ele compra de quem entrega opções e deixa ele decidir.'
        }
      />
    ),
  },
  {
    id: "disc-pap-v",
    titulo: "Se você é Papagaio",
    icone: Sparkles,
    render: () => (
      <SeVoceE
        l="I"
        titulo="O [I]Papagaio[/] encanta em 1 minuto — e esquece o follow-up em 2."
        frase={'"Deixa eu te contar uma história…"'}
        barras={[88, 95, 70, 20]}
        poderes={[
          "Cria *conexão* instantânea.",
          "Entusiasmo contagiante — *vendas é energia*, e você tem.",
          "Conta histórias que fazem o cliente *se imaginar* com a usina.",
          "Ótimo com Papagaio e Cachorro.",
        ]}
        kryptonita={[
          "Fala demais, *escuta de menos*.",
          "*Promete* o que a engenharia não confirmou.",
          "Foge de número e detalhe.",
          "Desorganizado: perde o follow-up.",
          "Quer ser querido → *cede desconto* fácil.",
        ]}
        treino={[
          "*CRM religiosamente:* toda conversa termina com próximo passo agendado — antes de sair da sala.",
          "Prepare *3 números* antes de cada reunião (geração, payback, parcela). Coruja vai perguntar.",
          "*Silêncio depois do preço.* Sua vontade de preencher o vazio é o que te faz dar desconto.",
          '"Nunca prometo sem confirmar com a engenharia" — decore.',
        ]}
      />
    ),
  },
  {
    id: "disc-pap-c",
    titulo: "Vendendo para o Papagaio",
    icone: Sparkles,
    render: () => (
      <VendendoPara
        l="I"
        titulo="Ele quer [I]reconhecimento, história e emoção.[/] Faça-o sonhar."
        sinais={[
          ["😄", "Simpático, fala de si, *conta casos*."],
          ["🙌", "Cumprimenta com as duas mãos; chama pelo nome logo."],
          ["📸", "Fala de viagem, carro, o que postou."],
          ["🔥", "Empolga rápido — e *dispersa* rápido."],
          ["📱", 'WhatsApp com áudio, emoji e "kkk".'],
        ]}
        frase={
          '"Imagina o senhor mostrando o *app da usina* pros amigos no churrasco, com a conta zerada…"'
        }
        faca={
          'Crie relação primeiro · mostre *fotos e depoimentos* · conte histórias de clientes · fale do "vizinho vai perguntar" · feche *na empolgação*.'
        }
        naoFaca="Planilha fria e tabela longa · cortar a conversa · seriedade excessiva · deixar sem follow-up."
        sentir="Que é *especial*, que a decisão vai *impressionar*, e que você é *amigo* — não vendedor."
        erro={
          'deixar esfriar. "Some" de Papagaio não é "não" — é dispersão. Se você não marcou o próximo passo na hora, perdeu.'
        }
      />
    ),
  },
  {
    id: "disc-cao-v",
    titulo: "Se você é Cachorro",
    icone: Users,
    render: () => (
      <SeVoceE
        l="S"
        titulo="O [S]Cachorro[/] conquista confiança — e tem medo de pedir a venda."
        frase={'"Sem pressa, o que for melhor pra você."'}
        barras={[30, 90, 20, 45]}
        poderes={[
          "O cliente *confia* em você de cara.",
          "Escuta de verdade; descobre a dor real.",
          "Paciente com Coruja e Cachorro.",
          "Rei do *pós-venda e da indicação*.",
          "Não promete o que não pode.",
        ]}
        kryptonita={[
          "*Não pede a venda* — espera o cliente pedir.",
          'Aceita "vou pensar" sem tratar.',
          "Energia *morna*; tom de voz baixo.",
          "Medo de conflito → *desconto para agradar*.",
          "Trava com Leão que pressiona.",
        ]}
        treino={[
          '*Pedido de fechamento obrigatório* em toda reunião: "Vamos garantir sua data?" — mesmo desconfortável. Ajudar o cliente é *conduzir*, não esperar.',
          "Ensaie o roteiro de objeção em voz alta até sair automático. Grave-se e *suba o volume*.",
          "Reenquadre: conflito não é briga — é *ajudar o cliente a decidir* o que é bom pra ele.",
          "Com Leão: fale em *resultado* e segure a postura. Ele respeita firmeza.",
        ]}
      />
    ),
  },
  {
    id: "disc-cao-c",
    titulo: "Vendendo para o Cachorro",
    icone: Users,
    render: () => (
      <VendendoPara
        l="S"
        titulo="Ele quer [S]segurança, sem surpresa e sem pressão.[/]"
        sinais={[
          ["🐢", "Fala devagar, calmo, *não decide na hora*."],
          ["👪", 'Envolve a esposa/marido, os filhos: "vou conversar em casa".'],
          ["🛡", 'Pergunta: *"e se der problema?"* "quem vem aqui?"'],
          ["🏡", "Casa acolhedora, fotos de família, café oferecido."],
          ["📱", 'WhatsApp educado, responde devagar, "obrigado pela atenção".'],
        ]}
        frase={
          '"Vou te apresentar *quem vai cuidar da sua usina* pelos próximos 10 anos — o técnico exclusivo do pós-venda."'
        }
        faca="Ritmo calmo · mostre as garantias (*72h, técnico exclusivo, +1.000 usinas*) · apresente o time · envolva a família · dê o passo a passo."
        naoFaca={
          'Pressionar · urgência falsa · mudar o combinado · falar rápido ou agressivo · "assina hoje".'
        }
        sentir="Que *não vai se arrepender*, que tem *alguém para ligar* quando precisar, e que a família aprova."
        erro={
          'pressa. Cachorro pressionado diz "sim" para você ir embora — e depois some. Ganhe pela confiança, não pelo empurrão.'
        }
      />
    ),
  },
  {
    id: "disc-cor-v",
    titulo: "Se você é Coruja",
    icone: ScrollText,
    render: () => (
      <SeVoceE
        l="C"
        titulo="A [C]Coruja[/] tem a melhor proposta — e demora demais para entregá-la."
        frase={'"Deixa eu conferir esse número."'}
        barras={[30, 25, 15, 98]}
        poderes={[
          "*Domínio técnico*: credibilidade imediata.",
          "Proposta impecável, cálculo certo.",
          "Não promete o que não entrega.",
          "Convence Coruja e Leão pelo número.",
          "Organizada: nada se perde.",
        ]}
        kryptonita={[
          "*Paralisia por análise*: não fecha.",
          "Fria — não gera *empolgação*.",
          "Técnica demais para Papagaio e Cachorro.",
          "Perfeccionismo *atrasa* a proposta.",
          "Medo de errar → não improvisa, não pede a venda.",
        ]}
        treino={[
          '*"80% bom já vai."* Proposta perfeita que chega atrasada perde para a boa que chegou hoje.',
          "Treine *1 história de cliente por semana* — emoção também é dado que fecha venda.",
          "Grave-se: *sorria e suba o tom*. Sua precisão precisa de calor para virar confiança.",
          "Toda reunião termina com *pedido de próximo passo*. Sem exceção.",
        ]}
      />
    ),
  },
  {
    id: "disc-cor-c",
    titulo: "Vendendo para a Coruja",
    icone: ScrollText,
    render: () => (
      <VendendoPara
        l="C"
        titulo="Ela quer [C]dados, provas e tempo.[/] Um número errado e acabou."
        sinais={[
          ["📊", "Pergunta detalhe técnico: *marca do inversor, eficiência, garantia em anos*."],
          ["📄", "Pede datasheet, compara orçamentos em planilha."],
          ["🤫", "Silêncio pensativo; poucas emoções na cara."],
          ["🧐", 'Cético: "de onde vem esse número?"'],
          ["📱", "WhatsApp com perguntas numeradas; responde por e-mail."],
        ]}
        frase={
          '"Deixo o *memorial técnico* e o *cálculo de geração* por escrito. O senhor confere e a gente fecha os detalhes quinta."'
        }
        faca="Datasheet e garantias *por escrito* · cálculo transparente · cases com número · responda por escrito · *dê tempo* com data marcada."
        naoFaca={
          'Exagerar · "confia em mim" · pressionar · *errar um número* · prometer sem base · entusiasmo forçado.'
        }
        sentir="Que a decisão é *lógica e defensável*, que ninguém a está enganando, e que a engenharia é séria."
        erro="um número errado ou um exagero. A Coruja não discute — ela simplesmente te risca da lista. Precisão é a sua única moeda aqui."
      />
    ),
  },
  {
    id: "disc-matriz",
    titulo: "Matriz de encontros",
    icone: Grid3x3,
    render: () => {
      // encaixe natural (b) · precisa ajuste (a) · zona de perigo (p)
      const M: [string, "b" | "a" | "p"][][] = [
        [
          ["*Choque de egos.* Entregue o controle: dê opções e deixe ele escolher.", "p"],
          ["Você quer ir direto, ele quer conversar. *Dê 5 min de papo* antes do número.", "a"],
          ["Você atropela, ele trava. *Desacelere 50%* e traga as garantias.", "p"],
          ["Você quer fechar, ela quer analisar. *Leve dados* e marque data.", "a"],
        ],
        [
          ["Ele te acha prolixo. *Corte a história*, vá ao número.", "a"],
          ["*Festa — e ninguém fecha.* Você conduz o fechamento na empolgação.", "p"],
          ["Boa química. Só *não prometa demais* — ele confia em você.", "b"],
          ["Ela desconfia do entusiasmo. *Fale menos, prove mais*, por escrito.", "p"],
        ],
        [
          ["Ele te domina. *Postura firme*, fale em resultado, não recue.", "p"],
          ["Vocês se gostam, mas ninguém pede a venda. *Peça.*", "a"],
          ["*Conforto mútuo = enrolação.* Marque o próximo passo com data.", "p"],
          ["Ela quer dados, você quer relação. *Traga a engenharia* junto.", "a"],
        ],
        [
          ["Ele não quer detalhe. *Resumo em 3 linhas* + número final.", "a"],
          ["Você entedia ele. *Menos planilha, mais história* e foto de usina.", "p"],
          ["Bom encaixe. Só *aqueça o tom* — ele precisa sentir confiança, não só ler.", "b"],
          ["*Análise infinita.* Coloque prazo de decisão e feche o escopo.", "p"],
        ],
      ];
      const fundo = {
        b: "bg-success/12 border-success/30",
        a: "bg-apr-gold/10 border-apr-gold/30",
        p: "bg-danger/12 border-danger/30",
      };
      return (
        <Conteudo
          tag="Matriz de encontros"
          kicker="Seu animal × o animal do cliente"
          titulo="Onde a venda _trava_ — e o que fazer em cada encontro."
        >
          <div className="mt-6 grid grid-cols-[150px_repeat(4,1fr)] gap-2.5">
            <Item
              i={2}
              className="flex items-center justify-center rounded-xl bg-apr-surface text-center text-[13px] font-semibold uppercase leading-tight tracking-wider text-apr-muted"
            >
              Vendedor ↓<br />
              Cliente →
            </Item>
            {ORDEM.map((l, k) => (
              <Item
                key={l}
                i={2 + k}
                className={
                  "flex items-center justify-center gap-2 rounded-xl py-2.5 " + ANIMAL[l].bg
                }
              >
                <span className="text-[26px]">{ANIMAL[l].emoji}</span>
                <span className="font-display text-[19px] font-semibold text-apr-bg">
                  {ANIMAL[l].nome}
                </span>
              </Item>
            ))}
            {M.flatMap((linha, r) => [
              <Item
                key={"h" + r}
                i={4 + r}
                className={
                  "flex flex-col items-center justify-center rounded-xl " + ANIMAL[ORDEM[r]].bg
                }
              >
                <span className="text-[26px]">{ANIMAL[ORDEM[r]].emoji}</span>
                <span className="font-display text-[17px] font-semibold text-apr-bg">
                  {ANIMAL[ORDEM[r]].nome}
                </span>
              </Item>,
              ...linha.map(([t, z], c) => (
                <motion.div
                  key={r + "-" + c}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + (r * 4 + c) * 0.04, duration: 0.5, ease: EASE }}
                  className={
                    "rounded-xl border px-4 py-3.5 text-[18px] leading-snug text-apr-muted " +
                    fundo[z]
                  }
                >
                  <Rico t={t} />
                </motion.div>
              )),
            ])}
          </div>
          <Item i={9} className="mt-4 flex gap-7 text-[15px] text-apr-muted">
            <span className="flex items-center gap-2">
              <i className="h-3.5 w-3.5 rounded bg-success/40" /> encaixe natural
            </span>
            <span className="flex items-center gap-2">
              <i className="h-3.5 w-3.5 rounded bg-apr-gold/40" /> precisa ajuste
            </span>
            <span className="flex items-center gap-2">
              <i className="h-3.5 w-3.5 rounded bg-danger/40" /> zona de perigo
            </span>
          </Item>
        </Conteudo>
      );
    },
  },
  {
    id: "disc-cola",
    titulo: "Cola de bolso",
    icone: ScrollText,
    render: () => (
      <Conteudo
        tag="Cola de bolso"
        kicker="Leitura em 30 segundos"
        titulo="Os sinais que _entregam_ o animal antes de ele abrir a proposta."
      >
        <div className="mt-6">
          <Tabela
            tamanho={16}
            larguras={["170px", "auto", "auto", "auto", "auto"]}
            cabecalho={[
              "Sinal",
              ...ORDEM.map((l) => (
                <span
                  key={l}
                  className={
                    "normal-case tracking-normal text-[17px] font-semibold " + ANIMAL[l].text
                  }
                >
                  {ANIMAL[l].emoji} {ANIMAL[l].nome}
                </span>
              )),
            ]}
            linhas={[
              [
                "Fala",
                "Rápida, curta, imperativa",
                "Rápida, longa, animada",
                "Lenta, suave, gentil",
                "Lenta, precisa, questionadora",
              ],
              [
                "Primeira pergunta",
                '"Quanto e quando?"',
                '"Você conhece o fulano?"',
                '"E se der problema?"',
                '"Qual a eficiência?"',
              ],
              [
                "Decide",
                "Na hora, sozinho",
                "Na empolgação (e esquece)",
                "Depois, com a família",
                "Depois, com planilha",
              ],
              [
                "Espaço / mesa",
                "Troféus, poucas coisas",
                "Fotos, cor, bagunça feliz",
                "Família, plantas, café",
                "Organizado, pastas, gráficos",
              ],
              [
                "WhatsApp",
                '"Ok." "Fechado."',
                "Áudio de 2 min + emoji",
                '"Bom dia! Obrigado pela atenção"',
                "Lista numerada de dúvidas",
              ],
              [
                "O que compra",
                "Resultado e controle",
                "Status e emoção",
                "Segurança e relação",
                "Prova e precisão",
              ],
              [
                "Sua arma LZ7",
                "Estrutura + 72h (menos risco)",
                "+1.000 usinas, depoimentos, app",
                "Técnico exclusivo + garantia",
                "Engenharia própria + memorial",
              ],
            ]}
          />
        </div>
      </Conteudo>
    ),
  },
  {
    id: "disc-camaleao",
    titulo: "Seja camaleão",
    icone: Repeat,
    render: () => (
      <Conteudo
        tag="A virada"
        kicker="Adapte-se sem se anular"
        titulo="Seja _camaleão_ 🦎: mude 30% do seu jogo, não 100% de quem você é."
      >
        <div className="mt-10 grid grid-cols-4 gap-5">
          {(
            [
              ["D", "Com o Leão", "acelere, resuma, dê opções"],
              ["I", "Com o Papagaio", "sorria, conte história, feche quente"],
              ["S", "Com o Cachorro", "desacelere, garanta, apresente o time"],
              ["C", "Com a Coruja", "prove, escreva, dê tempo com data"],
            ] as const
          ).map(([l, t, s], k) => (
            <Item
              key={l}
              i={2 + k}
              className={
                "flex flex-col items-center rounded-3xl border p-8 text-center " + ANIMAL[l].caixa
              }
            >
              <Emoji e={ANIMAL[l].emoji} tam={84} i={k} />
              <div className={"mt-4 font-display text-[26px] font-semibold " + ANIMAL[l].text}>
                {t}
              </div>
              <div className="mt-2 text-[22px] text-apr-muted">{s}</div>
            </Item>
          ))}
        </div>
        <Item i={7} className="mt-10 max-w-[1350px] text-[24px] leading-relaxed text-apr-muted">
          <Rico
            t={
              'O cliente não precisa saber que você "leu" ele. Ele só precisa sentir que _você fala a língua dele_. Isso não é manipulação — é respeito pela forma como cada pessoa decide.'
            }
          />
        </Item>
      </Conteudo>
    ),
  },
  {
    id: "disc-dinamica",
    titulo: "O rodízio dos animais",
    icone: Dices,
    render: () => (
      <Conteudo
        tag="Dinâmica em sala"
        kicker="Hora de brincar de verdade"
        titulo="O rodízio dos animais 🎭"
      >
        <Duas
          esquerda={
            <>
              <Cartao titulo="🃏 Como funciona" i={2}>
                <ul className="space-y-2.5 text-[20px] leading-snug text-apr-muted">
                  {[
                    "Duplas: um *vendedor*, um *cliente*.",
                    "O cliente sorteia uma *carta-animal* (🦁🦜🐕🦉) e interpreta o perfil — sem revelar.",
                    'Cena: *5 minutos*, objeção obrigatória: "está caro / achei mais barato".',
                    "O vendedor precisa *identificar o animal* em 1 min e adaptar o pitch.",
                    "Troca de papéis. Depois, troca de dupla. *4 rodadas* = todos os animais.",
                  ].map((t) => (
                    <li key={t}>
                      • <Rico t={t} />
                    </li>
                  ))}
                </ul>
              </Cartao>
              <Cartao
                titulo="🏆 Pontuação"
                tom="ouro"
                i={3}
                tamanho={19}
                textos={[
                  "+1 acertou o animal · +1 usou a arma LZ7 certa · +1 pediu o fechamento · ~−1 deu desconto no reflexo~.",
                ]}
              />
            </>
          }
          direita={
            <>
              {(
                [
                  [
                    "D",
                    '"Vai direto. Quanto custa? Meu tempo é curto. Já tenho 2 orçamentos mais baratos."',
                  ],
                  [
                    "I",
                    '"Adorei você! Meu cunhado colocou solar… caro, né? Mas me conta, vocês são famosos?"',
                  ],
                  [
                    "S",
                    '"Achei caro… vou conversar com minha esposa. E se der problema, quem vem aqui?"',
                  ],
                  [
                    "C",
                    '"Está caro. De onde vem esse payback? Qual a eficiência do inversor e a garantia real?"',
                  ],
                ] as const
              ).map(([l, t], k) => (
                <Fala
                  key={l}
                  rotulo={`${ANIMAL[l].emoji} Carta ${ANIMAL[l].nome}`}
                  tom={l}
                  i={4 + k}
                  tamanho={18}
                  texto={t}
                />
              ))}
            </>
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "disc-mantras",
    titulo: "Os mantras do DISC",
    icone: Sparkles,
    render: () => (
      <Mantras
        kicker="Os mantras do DISC em vendas"
        itens={[
          "🔍 _Leia em 30 segundos_ — ritmo e foco entregam o animal.",
          "🦁 Com o Leão, _seja rápido_ e dê o controle.",
          "🦜 Com o Papagaio, _faça sonhar_ e feche quente.",
          "🐕 Com o Cachorro, _garanta_ e nunca pressione.",
          "🦉 Com a Coruja, _prove por escrito_ e não erre um número.",
          "🦎 _Conheça sua kryptonita_ — e treine ela toda semana.",
        ]}
      />
    ),
  },
  {
    id: "disc-fim",
    titulo: "Quatro animais. Um tubarão.",
    icone: Trophy,
    render: () => (
      <Fim
        linha1="Quatro animais."
        linha2="Um tubarão."
        texto="Tubarão é quem conhece o próprio animal, treina a própria fraqueza e fala a língua do cliente. ^Agora é praticar.^"
        enfeite={
          <div className="flex gap-6">
            {ORDEM.map((l, k) => (
              <Emoji key={l} e={ANIMAL[l].emoji} tam={76} i={k} />
            ))}
          </div>
        }
      />
    ),
  },
];
