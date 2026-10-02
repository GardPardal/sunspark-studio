/**
 * Treinamento Comercial LZ7 — conteúdo idêntico ao PDF "Treinamento Comercial LZ7 - Completo"
 * (páginas 1 a 31), com o design da /apresentacao.
 */
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Brain,
  Crosshair,
  Flame,
  HandCoins,
  MessageSquareQuote,
  Mic2,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users,
  Wrench,
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
  Lista,
  Mantras,
  Modulo,
  Numero,
  Passos,
  Rico,
  Tabela,
  type SlideTreino,
} from "./blocos";

const DISC_LINHA = (letra: "D" | "I" | "S" | "C") => {
  const cls = { D: "bg-disc-d", I: "bg-disc-i", S: "bg-disc-s", C: "bg-disc-c" }[letra];
  return (
    <span
      className={
        "flex h-11 w-11 items-center justify-center rounded-xl font-display text-[22px] font-semibold text-apr-bg " +
        cls
      }
    >
      {letra}
    </span>
  );
};

/** Bloco de perfil DISC (letra + nome + descrição). */
function Perfil({
  letra,
  nome,
  desc,
  i,
}: {
  letra: "D" | "I" | "S" | "C";
  nome: string;
  desc: string;
  i: number;
}) {
  return (
    <Item i={i} className="flex items-center gap-4">
      <span className="scale-125">{DISC_LINHA(letra)}</span>
      <div className="ml-2">
        <div className="font-display text-[28px] font-semibold text-apr-text">{nome}</div>
        <div className="text-[17px] text-apr-muted">{desc}</div>
      </div>
    </Item>
  );
}

export const SLIDES_COMERCIAL: SlideTreino[] = [
  {
    id: "com-capa",
    titulo: "Treinamento Comercial",
    icone: Trophy,
    render: () => (
      <Capa
        kicker="Treinamento comercial"
        titulo="Vender _valor_. Dominar a mesa."
        sub="Postura · DISC · Estrutura & diferenciais · Contorno de objeções"
      />
    ),
  },
  {
    id: "com-m1",
    titulo: "Módulo 1 · Postura & energia",
    icone: Flame,
    render: () => (
      <Modulo
        numero={1}
        titulo="Postura & _energia_"
        texto="Antes de qualquer técnica: o cliente compra a sua convicção. Um vendedor morno não vende — ele informa e perde."
      />
    ),
  },
  {
    id: "com-energia",
    titulo: "Vendas é energia",
    icone: Flame,
    render: () => (
      <Conteudo
        tag="Postura"
        kicker="A base de tudo"
        titulo="Vendas é _energia._ E energia se sente em 10 segundos."
      >
        <Duas
          esquerda={
            <Lista
              itens={[
                "O cliente decide se confia em você *antes* de você abrir a proposta.",
                "Se *você* não está empolgado com o que vende, por que ele estaria?",
                "Energia não é gritar — é *convicção, ritmo e presença.*",
                "Entusiasmo genuíno vende mais que qualquer tabela de preço.",
              ]}
            />
          }
          direita={
            <Cartao
              titulo="A verdade dura"
              tom="ouro"
              textos={[
                "Um time *apático* transforma o melhor produto do mercado numa venda morna. O cliente espelha a sua temperatura: se você entra desanimado, ele sai sem comprar.",
                "A LZ7 tem o melhor produto da região. *Falta o time vender como quem acredita nisso.*",
              ]}
            />
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-espelho",
    titulo: "Morno × Tubarão",
    icone: Swords,
    render: () => (
      <Conteudo
        tag="Postura"
        kicker="O espelho — em qual você se reconhece?"
        titulo="Vendedor ~morno~ × Vendedor _tubarão_"
      >
        <Duas
          esquerda={
            <>
              <Fala
                rotulo="✗ Morno (perde a venda)"
                tom="ruim"
                texto={
                  '"É... o sistema é bom... qualquer coisa eu te mando os valores no zap, tá? Aí você vê com calma..."'
                }
              />
              <Lista
                tom="ruim"
                i={4}
                tamanho={20}
                itens={[
                  "Voz monótona, sem ritmo, sem olho no olho.",
                  "Espera o cliente puxar, não conduz.",
                  'Termina sem próximo passo — "fica à vontade".',
                ]}
              />
            </>
          }
          direita={
            <>
              <Fala
                rotulo="✓ Tubarão (fecha)"
                tom="bom"
                i={4}
                texto={
                  '"Deixa eu te mostrar por que esse é o projeto certo pra sua casa. [conduz] Faz sentido, né? Então bora garantir sua instalação ainda esse mês — quinta funciona pra vistoria?"'
                }
              />
              <Lista
                tom="bom"
                i={6}
                tamanho={20}
                itens={[
                  "Fala com firmeza, ritmo e pausa.",
                  "Conduz a conversa com perguntas.",
                  "*Sempre* fecha o próximo passo.",
                ]}
              />
            </>
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-voz",
    titulo: "Tom de voz",
    icone: Mic2,
    render: () => (
      <Conteudo
        tag="Postura"
        kicker="Como você fala vale mais que o que você fala"
        titulo="Tom de voz: _firmeza, ritmo e pausa._"
      >
        <Duas
          esquerda={
            <Lista
              itens={[
                '*Firmeza:* fale afirmando, não perguntando. "Esse sistema resolve sua conta." — não "acho que talvez ajude".',
                "*Ritmo:* desacelere nos números importantes. Pressa passa insegurança.",
                "*Pausa:* depois de perguntar o fechamento, *segure o silêncio.* Quem fala primeiro, perde.",
                "*Energia crescente:* termine cada bloco mais forte do que começou.",
              ]}
            />
          }
          direita={
            <Cartao
              titulo="O erro que entrega insegurança"
              tom="ruim"
              textos={[
                'Terminar frase com "né?", "seria isso...", "mais ou menos". O cliente ouve dúvida e devolve dúvida.',
                '*Troque por afirmação:* "É isso. Esse é o caminho." A convicção na sua voz é metade da venda.',
              ]}
            />
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-tubarao",
    titulo: "Seja o tubarão na mesa",
    icone: Target,
    render: () => (
      <Conteudo
        tag="Postura"
        kicker="Posicionamento"
        titulo="Seja o _tubarão na mesa_ — não o peixe pedindo a venda."
      >
        <Duas
          esquerda={
            <Lista
              itens={[
                "Você é o *especialista* que resolve o problema dele — não um pedinte com desconto.",
                "Quem *pergunta* comanda. Quem só despeja informação, obedece.",
                'Nunca implore ("qualquer coisa me chama"). *Comande* o próximo passo.',
              ]}
            />
          }
          direita={
            <>
              <Fala
                rotulo="Peixe (implora)"
                tom="ruim"
                texto={'"Se você tiver interesse, qualquer coisa me chama, tá bom?"'}
              />
              <Fala
                rotulo="Tubarão (comanda)"
                tom="bom"
                i={4}
                texto={
                  '"Pelo seu consumo, você está jogando dinheiro fora todo mês. Vamos resolver isso: fecho sua vistoria pra quinta?"'
                }
              />
            </>
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-m2",
    titulo: "Módulo 2 · DISC",
    icone: Brain,
    render: () => (
      <Modulo
        numero={2}
        titulo="Ler o cliente _com o DISC_"
        texto="Cada cliente compra de um jeito. O tubarão lê o perfil em 30 segundos e muda o discurso — o morno fala igual pra todo mundo e perde 3 de 4."
      />
    ),
  },
  {
    id: "com-4perfis",
    titulo: "4 perfis",
    icone: Brain,
    render: () => (
      <Conteudo
        tag="DISC"
        kicker="Reconheça em 30 segundos"
        titulo="4 perfis. 4 formas de comprar."
        rodape="Não existe perfil melhor. Existe _vendedor que adapta_ e vendedor que fala igual pra todos."
      >
        <div className="mt-9">
          <Tabela
            larguras={["90px", "200px", "auto", "380px"]}
            cabecalho={["", "Perfil", "Como reconhecer na hora", "O que ele quer ouvir"]}
            linhas={[
              [
                DISC_LINHA("D"),
                "*Dominante*",
                "Fala rápido, direto, pergunta preço e prazo logo, impaciente, quer decidir.",
                'Resultado, controle, "você decide".',
              ],
              [
                DISC_LINHA("I"),
                "*Influente*",
                "Falante, animado, conta histórias, sorri, cita vizinhos e amigos.",
                "Entusiasmo, status, reconhecimento.",
              ],
              [
                DISC_LINHA("S"),
                "*Estável*",
                'Calmo, cauteloso, "vou ver com a esposa", não gosta de pressão.',
                "Segurança, garantia, sem pressa.",
              ],
              [
                DISC_LINHA("C"),
                "*Conforme*",
                "Pergunta detalhe técnico, quer números, anota, desconfia de exagero.",
                "Dados, provas, ficha técnica.",
              ],
            ]}
            tamanho={20}
          />
        </div>
      </Conteudo>
    ),
  },
  {
    id: "com-di",
    titulo: "Para o D e o I",
    icone: Brain,
    render: () => (
      <Conteudo
        tag="DISC · Como vender"
        kicker="Os dois perfis rápidos"
        titulo="Para o [D]D[/] e para o [I]I[/] — velocidade e emoção."
      >
        <Duas
          esquerda={
            <>
              <Perfil letra="D" nome="Dominante" desc="direto, no controle, decide rápido" i={2} />
              <Fala
                rotulo="Frase real"
                tom="D"
                texto={
                  '"Vou ser direto: esse sistema zera sua conta e te dá controle total. Tenho 3 opções — qual você fecha?"'
                }
              />
              <Erro
                texto="enrolar, falar demais, não deixar ele decidir. Ele desliga na hora."
                i={4}
              />
            </>
          }
          direita={
            <>
              <Perfil letra="I" nome="Influente" desc="social, empolgado, compra na emoção" i={3} />
              <Fala
                rotulo="Frase real"
                tom="I"
                i={4}
                texto={
                  '"Imagina sua conta despencando e todo mundo perguntando de quem foi o projeto? Você vira referência na rua."'
                }
              />
              <Erro
                texto="ser técnico e frio, não criar conexão. Sem emoção, ele não compra."
                i={5}
              />
            </>
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-sc",
    titulo: "Para o S e o C",
    icone: Brain,
    render: () => (
      <Conteudo
        tag="DISC · Como vender"
        kicker="Os dois perfis cautelosos"
        titulo="Para o [S]S[/] e para o [C]C[/] — segurança e dados."
      >
        <Duas
          esquerda={
            <>
              <Perfil letra="S" nome="Estável" desc="cauteloso, quer segurança, sem pressa" i={2} />
              <Fala
                rotulo="Frase real"
                tom="S"
                texto={
                  '"Sem pressa nenhuma. Meu papel é te deixar seguro. Olha a garantia, a troca em 72h e os +1000 clientes que já confiam. Tô com você nos 10 anos."'
                }
              />
              <Erro texto="pressionar, meter pressa, forçar urgência. Ele trava e foge." i={4} />
            </>
          }
          direita={
            <>
              <Perfil letra="C" nome="Conforme" desc="analítico, quer entender tudo" i={3} />
              <Fala
                rotulo="Frase real"
                tom="C"
                i={4}
                texto={
                  '"Trouxe tudo documentado: geração mês a mês, payback, degradação, ficha do inversor. Pode conferir linha por linha — os números falam sozinhos."'
                }
              />
              <Erro
                texto="exagerar, prometer sem provar, só discurso. Ele desconfia e sai."
                i={5}
              />
            </>
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-m3",
    titulo: "Módulo 3 · Arsenal",
    icone: Shield,
    render: () => (
      <Modulo
        numero={3}
        titulo="Nosso arsenal _competitivo_"
        texto="O que a LZ7 tem e o concorrente pequeno não consegue copiar. Isto é o que justifica o preço — decore."
      />
    ),
  },
  {
    id: "com-ancora",
    titulo: "Ancore o valor",
    icone: Sparkles,
    render: () => (
      <Conteudo
        tag="Mindset"
        kicker="A regra de ouro do time"
        titulo="Ancore o valor _antes_ de o preço virar assunto."
        rodape="Preço só é caro quando o cliente não enxergou o valor. _Valor primeiro, número depois._"
      >
        <Duas
          esquerda={
            <Cartao
              titulo="✗ Vendedor que perde"
              tom="ruim"
              tamanho={22}
              textos={[
                "Mostra o kit, joga o preço, e só quando o cliente reclama tenta explicar por que a LZ7 é melhor. Já virou discussão de desconto.",
              ]}
            />
          }
          direita={
            <Cartao
              titulo="✓ Vendedor que fecha"
              tom="bom"
              i={4}
              tamanho={22}
              textos={[
                "Constrói o valor da LZ7 desde o primeiro minuto. Quando o preço aparece, o cliente *já sabe* que paga por algo que os outros não têm.",
              ]}
            />
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-construir",
    titulo: "Construir valor",
    icone: Sparkles,
    render: () => (
      <Conteudo
        tag="Mindset · Na prática"
        kicker={'"Mas como eu construo esse valor?" — a dúvida do time'}
        titulo="Construir valor é _plantar os diferenciais antes do preço._"
      >
        <Duas
          esquerda={
            <Lista
              tamanho={21}
              itens={[
                'No início, apresente a *estrutura*: "A LZ7 tem +40 pessoas, engenharia própria e time de pós-venda."',
                'Conte a *troca em 72h* como história: "Sabe o que mais assusta em solar? Ficar meses parado. Aqui isso não acontece."',
                'Use as *+1.000 usinas* como prova: "A gente não está começando — mais de mil famílias já confiaram."',
                "Faça o cliente *sentir o risco* de escolher errado antes de você falar em preço.",
              ]}
            />
          }
          direita={
            <Cartao
              titulo="A regra prática"
              tom="ouro"
              tamanho={20}
              textos={[
                "Para cada diferencial, diga *o que é* + *a dor que resolve* + *uma frase de imagem.*",
                "Quando o preço chega, o cliente já tem 4 ou 5 motivos guardados para pagar mais. *Valor construído é objeção evitada.*",
              ]}
            />
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-arma1",
    titulo: "Arma 1 · Troca em 72h",
    icone: Wrench,
    render: () => (
      <Conteudo
        tag="Arma 1"
        kicker="Estoque próprio · Troca express"
        titulo="Inversor queimou? _Trocamos em até 72 horas._"
      >
        <Duas
          esquerda={
            <div className="space-y-8 pt-4">
              <Numero
                valor="72h"
                legenda="nosso prazo de troca, com estoque próprio"
                tom="bom"
                tamanho={140}
              />
              <Numero
                valor="90–120"
                legenda="dias no concorrente, que depende do fabricante"
                tom="ruim"
                tamanho={110}
                i={3}
              />
            </div>
          }
          direita={
            <Cartao
              titulo="Por que importa para o cliente"
              i={4}
              tamanho={20}
              textos={[
                "Na empresa pequena, o inversor falha e o cliente *fica meses sem gerar* — pagando conta cheia e a parcela do sistema juntas.",
                "Na LZ7, *nós trocamos* com equipamento do nosso estoque e resolvemos a garantia com o fabricante por trás. *Vale pelos 10 anos de garantia do equipamento.*",
              ]}
            />
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-arma2",
    titulo: "Arma 2 · Garantia de instalação",
    icone: ShieldCheck,
    render: () => (
      <Conteudo
        tag="Arma 2"
        kicker="Garantia de instalação"
        titulo="Quem instalou responde. _E vai até a casa do cliente._"
      >
        <Duas
          esquerda={
            <Lista
              itens={[
                "*1 ano de garantia da instalação*, feita pela própria LZ7.",
                "No 1º ano, *sem cobrança de deslocamento* em garantia.",
                "Depois, a garantia continua — cobra-se só a hora técnica.",
                "A garantia do equipamento (10 anos) segue com a troca express.",
              ]}
            />
          }
          direita={
            <Cartao
              titulo="O que o cliente ouve por trás"
              tom="ouro"
              tamanho={20}
              textos={[
                '"Se der problema, tem uma empresa de verdade que vem resolver — não um instalador autônomo que some depois de receber."',
                "Segurança é o que ele mais quer num investimento de R$ 30 mil no telhado pelos próximos 25 anos.",
              ]}
            />
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-arma3",
    titulo: "Arma 3 · Engenharia e pós-venda",
    icone: Users,
    render: () => (
      <Conteudo
        tag="Arma 3"
        kicker="Engenharia própria · Pós-venda dedicado"
        titulo="A venda não acaba na instalação — _é ali que ela começa._"
      >
        <Duas
          esquerda={
            <Lista
              itens={[
                "*Engenharia própria:* o projeto é dimensionado dentro de casa, não terceirizado.",
                "*Acompanhamento pós-venda:* monitoramos a usina do cliente e avisamos se a geração cair.",
                "*Técnico exclusivo de pós-venda:* gente dedicada só a cuidar de quem já comprou.",
              ]}
            />
          }
          direita={
            <Cartao
              titulo="Por que isso vende (e muito)"
              tom="ouro"
              tamanho={20}
              textos={[
                "O medo nº 1 do cliente é *ser abandonado depois de pagar.* A empresa pequena instala e some. A LZ7 tem um time inteiro cuidando da usina *depois* que o dinheiro entrou.",
                "*Quase ninguém no mercado tem isso* — é ouro na hora da objeção.",
              ]}
            />
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-arma4",
    titulo: "Arma 4 · Estrutura",
    icone: Trophy,
    render: () => (
      <Conteudo
        tag="Arma 4"
        kicker="A estrutura por trás da LZ7"
        titulo="Uma empresa desse tamanho _não vai sumir._"
      >
        <div className="mt-12 grid grid-cols-4 gap-6">
          {(
            [
              ["+40", "colaboradores"],
              ["3", "unidades físicas"],
              ["4", "escritórios de representação"],
              ["+1.000", "usinas instaladas"],
            ] as const
          ).map(([v, l], k) => (
            <Item
              key={l}
              i={2 + k}
              className="rounded-3xl border border-apr-line/80 bg-apr-surface/70 p-8"
            >
              <div className="font-display text-[84px] font-semibold leading-none text-apr-text">
                {v}
              </div>
              <div className="mt-3 text-[20px] text-apr-muted">{l}</div>
            </Item>
          ))}
        </div>
        <Item i={7} className="mt-10 max-w-[1300px] text-[24px] leading-relaxed text-apr-muted">
          <Rico t="Presença em *3 estados — Paraná, Santa Catarina e Rio Grande do Sul.* Estrutura é o que garante que a troca em 72h, a engenharia e a garantia vão existir daqui a 10 anos. O concorrente barato de hoje pode não existir amanhã." />
        </Item>
      </Conteudo>
    ),
  },
  {
    id: "com-prova",
    titulo: "O barato sai caro",
    icone: HandCoins,
    render: () => (
      <Conteudo
        tag="A prova"
        kicker="O barato sai caro"
        titulo='Uma troca demorada custa mais que o "desconto" da concorrência.'
      >
        <Duas
          esquerda={
            <Cartao
              titulo="Com o concorrente barato"
              tom="ruim"
              tamanho={20}
              textos={["Inversor queima e fica *90 a 120 dias parado.* Enquanto isso, o cliente:"]}
            >
              <Lista
                tom="ruim"
                i={4}
                tamanho={20}
                itens={[
                  "volta a pagar a conta de luz cheia (~R$ 1.100/mês)",
                  "continua pagando a parcela do sistema (~R$ 900/mês)",
                ]}
              />
              <div className="pt-2 font-display text-[28px] font-semibold leading-tight text-danger">
                ≈ R$ 2.000 por mês parado → R$ 6 a 8 mil por evento.
              </div>
            </Cartao>
          }
          direita={
            <Cartao
              titulo="Com a LZ7"
              tom="bom"
              i={4}
              tamanho={20}
              textos={["Inversor queima e é trocado em *até 72h*, do nosso estoque."]}
            >
              <div className="flex items-end gap-4 py-2">
                <span className="whitespace-nowrap font-display text-[110px] font-semibold leading-none text-success">
                  ~R$ 0
                </span>
                <span className="pb-3 text-[20px] text-apr-muted">
                  de prejuízo — o cliente quase não percebe
                </span>
              </div>
              <p className="text-[20px] leading-relaxed text-apr-muted">
                <Rico t='E pode acontecer *mais de uma vez* em 10 anos. O "desconto" some no primeiro problema.' />
              </p>
            </Cartao>
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-m4",
    titulo: "Módulo 4 · Objeções",
    icone: MessageSquareQuote,
    render: () => (
      <Modulo
        numero={4}
        titulo="Contorno _de objeções_"
        texto={
          'Objeção não é "não". É o cliente pedindo mais motivo para dizer "sim". O tubarão espera a objeção — e tem a resposta na ponta da língua.'
        }
      />
    ),
  },
  {
    id: "com-metodo",
    titulo: "O método",
    icone: Crosshair,
    render: () => (
      <Conteudo
        tag="O método"
        kicker="4 passos para qualquer objeção"
        titulo="Não discuta com o cliente. _Conduza._"
        rodape="Decore: _Acolha → Pergunte → Prove → Avance._ Nunca brigue, nunca dê desconto no reflexo."
      >
        <div className="mt-10">
          <Passos
            colunas={4}
            itens={[
              {
                titulo: "Acolha",
                texto: 'Concorde com o sentimento: "Entendo, preço é importante mesmo."',
              },
              {
                titulo: "Pergunte",
                texto: 'Descubra o que está por trás: "Além do preço, tem algo mais te segurando?"',
              },
              {
                titulo: "Prove",
                texto: "Traga a arma certa (72h, garantia, +1000) ligada à dor dele.",
              },
              {
                titulo: "Avance",
                texto: 'Feche o próximo passo: "Faz sentido? Vamos garantir sua data?"',
              },
            ]}
          />
        </div>
      </Conteudo>
    ),
  },
  {
    id: "com-obj1",
    titulo: "Objeção 1 · Falsa paridade",
    icone: MessageSquareQuote,
    render: () => (
      <Conteudo
        tag="Objeção 1 · A mais comum"
        kicker="Falsa paridade"
        titulo='"A outra empresa faz tudo isso também — e mais barato."'
      >
        <Duas
          esquerda={
            <Cartao
              titulo="✗ O erro do time"
              tom="ruim"
              tamanho={20}
              textos={[
                'Ficar se defendendo ("mas a gente é melhor...") e virar queda de braço. *O cliente não acredita em quem se elogia.*',
              ]}
            />
          }
          direita={
            <Cartao
              titulo="✓ A virada"
              tom="bom"
              i={4}
              tamanho={20}
              textos={[
                "Não afirme que somos melhores — *faça o cliente verificar.* Quem descobre sozinho, acredita.",
              ]}
            />
          }
        />
        <Fala
          rotulo="Fale exatamente assim"
          tom="bom"
          i={6}
          className="mt-6"
          tamanho={23}
          texto={
            '"Que ótimo que eles oferecem o mesmo — aí sua decisão fica fácil. Antes de fechar com qualquer um, pede pra eles *colocarem no papel* quatro coisas, as mesmas que a gente coloca. Se responderem igual, pode fechar com o mais barato sem medo. Posso te mandar a listinha pra comparar?"'
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-checklist",
    titulo: "O checklist das 4 perguntas",
    icone: BadgeCheck,
    render: () => (
      <Conteudo
        tag="Objeção 1 · A arma"
        kicker="O checklist que expõe a verdade"
        titulo="4 perguntas que colocam o ~medo~ na mesa — e o concorrente _não responde igual._"
        rodape='O cliente leva a lista, o concorrente trava, e a "paridade" cai — _sem você ter falado mal de ninguém._'
      >
        <div className="mt-8 space-y-4">
          {[
            "Se meu inversor *queimar*, em quantos dias vocês trocam — do *estoque de vocês*, ou vou ficar *meses* esperando o fabricante?",
            "Vocês têm *engenharia própria e técnico de pós-venda*, ou terceirizam? *Quem* me atende se der problema daqui a 5 anos?",
            "Vocês *acompanham* minha usina depois de instalada — ou somem depois de receber?",
            "Há *quanto tempo* vocês existem e quantas usinas já instalaram? Vão estar aqui daqui a 10 anos pra honrar minha garantia?",
          ].map((t, k) => (
            <Item
              key={k}
              i={2 + k}
              className="flex items-center gap-5 rounded-2xl border border-apr-line/80 bg-apr-surface/70 px-6 py-4"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-apr-signed font-display text-[22px] font-semibold text-apr-bg">
                ?
              </span>
              <span className="text-[21px] leading-snug text-apr-muted">
                <Rico t={t} />
              </span>
            </Item>
          ))}
        </div>
      </Conteudo>
    ),
  },
  {
    id: "com-obj2",
    titulo: "Objeção 2 · Preço",
    icone: MessageSquareQuote,
    render: () => (
      <Conteudo
        tag="Objeção 2"
        kicker="Preço"
        titulo='"Está caro." / "Achei mais barato em outra."'
      >
        <Duas
          proporcao="0.9fr_1.1fr"
          esquerda={
            <>
              <Cartao
                titulo="✗ Não faça"
                tom="ruim"
                tamanho={20}
                textos={[
                  'Dar desconto no reflexo ou defender com "é que nosso material é bom". Vira briga de número.',
                ]}
              />
              <Cartao
                titulo="✓ Faça"
                tom="bom"
                i={4}
                tamanho={20}
                textos={[
                  "Tire do *preço de compra* e leve ao *custo de 10 anos* — onde a LZ7 ganha.",
                ]}
              />
            </>
          }
          direita={
            <>
              <Fala
                rotulo="Roteiro"
                tom="bom"
                i={4}
                tamanho={21}
                texto={
                  '"Entendo, e o senhor está certíssimo em comparar. Só pergunto: *o que é caro* — pagar um pouco mais agora, ou ficar 4 meses sem energia quando o inversor falha, pagando conta cheia e parcela junto?"'
                }
              />
              <Fala
                rotulo="A frase que fecha"
                tom="ouro"
                i={5}
                tamanho={21}
                texto={
                  '"Olha, *essa diferença o senhor vai pagar de qualquer jeito.* Só falta decidir: *agora*, na melhor condição — ou *mais pra frente*, com a correção da inflação e a margem de um pós-venda que o senhor vai precisar."'
                }
              />
            </>
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-obj3",
    titulo: "Objeção 3 · Outro orçamento",
    icone: MessageSquareQuote,
    render: () => (
      <Conteudo tag="Objeção 3" kicker="Concorrência na mesa" titulo='"Já tenho outro orçamento."'>
        <Duas
          esquerda={
            <Cartao
              titulo="Transforme em vantagem"
              tom="ouro"
              tamanho={20}
              textos={[
                "Orçamento na mão é *cliente quente* — ele já quer solar, só está escolhendo com quem. Seu trabalho não é baixar preço: é *mudar o critério de escolha.*",
                "Um orçamento só mostra potência e preço. Não mostra o que acontece quando dá problema — e é aí que você entra.",
              ]}
            />
          }
          direita={
            <>
              <Fala
                rotulo="Roteiro"
                tom="bom"
                i={4}
                tamanho={21}
                texto={
                  '"Perfeito, orçamento é importante. Posso te ajudar a comparar do jeito certo? Olhar só potência e preço é como comprar carro pela cor. Deixa eu te passar *4 perguntas* pra você fazer nos dois — inclusive na gente. Quem responder melhor, merece sua confiança."'
                }
              />
              <Item i={5} className="text-[19px] text-apr-muted">
                <Rico t="→ Emenda direto no *checklist das 4 perguntas.*" />
              </Item>
            </>
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-obj4",
    titulo: "Objeção 4 · Vou pensar",
    icone: MessageSquareQuote,
    render: () => (
      <Conteudo
        tag="Objeção 4"
        kicker={'O disfarce do "não" — e o veneno do time morno'}
        titulo='"Vou pensar." / "Me manda no zap."'
      >
        <Duas
          esquerda={
            <>
              <Cartao
                titulo="✗ O que o morno faz"
                tom="ruim"
                tamanho={20}
                textos={[
                  '"Tá bom, mando sim!" — e o cliente some. *"Vou pensar" sem tratativa é venda perdida.*',
                ]}
              />
              <Cartao
                titulo="✓ O que o tubarão faz"
                tom="bom"
                i={4}
                tamanho={20}
                textos={[
                  'Descobre o que *realmente* trava antes de deixar ir. "Pensar" é uma dúvida escondida.',
                ]}
              />
            </>
          }
          direita={
            <>
              <Fala
                rotulo="Roteiro"
                tom="bom"
                i={4}
                tamanho={21}
                texto={
                  "\"Claro, decisão de R$ 30 mil se pensa mesmo. Só me ajuda: quando você diz 'pensar', é o *valor*, é a *confiança na empresa* ou é o *momento*? Porque cada um desses eu resolvo agora com você.\""
                }
              />
              <Item i={5} className="text-[19px] leading-snug text-apr-muted">
                <Rico
                  t={
                    '→ Isola a objeção real e volta pro método. E sempre marque o retorno: *"Te ligo quinta às 10h, combinado?"*'
                  }
                />
              </Item>
            </>
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-m5",
    titulo: "Módulo 5 · Desconto",
    icone: HandCoins,
    render: () => (
      <Modulo
        numero={5}
        titulo="O desconto _que não te faz sangrar_"
        texto="Você tem 5% de margem. Ela é a última linha de defesa da empresa — não é troco para acalmar o cliente, nem para acalmar você. Quem solta desconto no reflexo entrega a margem e ainda ensina o cliente a pedir mais."
      />
    ),
  },
  {
    id: "com-sangra",
    titulo: "O erro que sangra a margem",
    icone: HandCoins,
    render: () => (
      <Conteudo
        tag="O erro que sangra a margem"
        kicker="Antes da técnica, a cabeça certa"
        titulo="O desconto mais caro é o que o vendedor dá _pra si mesmo._"
      >
        <Duas
          esquerda={
            <>
              <Cartao
                titulo="✗ O vendedor morno"
                tom="ruim"
                tamanho={19}
                textos={[
                  'Acha o preço caro, *tem vergonha do número* e joga os 5% de cara "pra facilitar". O cliente nem brigou — e ele já entregou tudo. Aí o cliente pede mais, porque sentiu que *tinha folga.*',
                ]}
              />
              <Cartao
                titulo="✓ O tubarão"
                tom="bom"
                i={4}
                tamanho={19}
                textos={[
                  "Acredita no preço. Sabe que os 5% são a *última margem da empresa* — o que paga engenharia, pós-venda e a troca em 72h. Só solta se precisar, aos pouquinhos, e cobrando algo em troca.",
                ]}
              />
            </>
          }
          direita={
            <Fala
              rotulo="A verdade que o time precisa ouvir"
              tom="ruim"
              i={4}
              tamanho={23}
              texto="Se *você* acha caro, o cliente vai achar mais ainda. Desconto dado por insegurança não fecha venda — só derruba a sua comissão e a saúde da empresa. *Cada 1% de R$ 30 mil é R$ 300* que saem do bolso do mesmo pós-venda que vai te socorrer lá na frente."
            />
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-regua",
    titulo: "A régua do desconto",
    icone: HandCoins,
    render: () => (
      <Conteudo
        tag="A régua do desconto"
        kicker="Como conceder sem se queimar"
        titulo="Desconto se concede _com método_ — nunca no impulso."
      >
        <div className="mt-9">
          <Passos
            colunas={4}
            itens={[
              {
                titulo: "Segure primeiro",
                texto:
                  "Desconto é o ÚLTIMO recurso. Antes dele, valor: reforce as armas (72h, garantia, +1.000, estrutura).",
              },
              {
                titulo: "Comece por 1%",
                texto: "Nunca solte os 5% de uma vez. O primeiro passo é pequeno de propósito.",
              },
              {
                titulo: "Faça doer",
                texto:
                  '"Deixa eu ver com meu gestor…" O cliente precisa sentir que a margem está apertada.',
              },
              {
                titulo: "Peça algo em troca",
                texto:
                  "Fechar hoje, pagamento à vista, indicação. Desconto de graça vira expectativa de mais.",
              },
            ]}
          />
        </div>
        <div className="mt-7">
          <Erro
            texto="jogar os 5% na primeira reclamação. Você mata a margem, perde autoridade e ensina o cliente que dá pra apertar mais."
            i={7}
          />
        </div>
      </Conteudo>
    ),
  },
  {
    id: "com-escada",
    titulo: "A escada decrescente",
    icone: HandCoins,
    render: () => (
      <Conteudo
        tag="Na prática"
        kicker="A escada decrescente — cada degrau menor que o anterior"
        titulo="Se precisar ir além do 1%, os passos _encolhem._"
      >
        <Duas
          esquerda={
            <>
              <div className="flex h-[300px] items-end gap-6 pt-6">
                {(
                  [
                    ["1%", "1º passo", 260, "bg-apr-signed"],
                    ["0,5%", "só se preciso", 190, "bg-apr-signed/70"],
                    ["0,3%", "o limite", 130, "bg-apr-signed/45"],
                  ] as const
                ).map(([v, l, h, cor], k) => (
                  <div key={v} className="flex flex-col items-center">
                    <motion.div
                      className={
                        "flex w-[150px] items-center justify-center rounded-t-3xl rounded-b-lg " +
                        cor
                      }
                      initial={{ height: 0 }}
                      animate={{ height: h }}
                      transition={{ delay: 0.4 + k * 0.25, duration: 0.9, ease: EASE }}
                    >
                      <span className="font-display text-[40px] font-semibold text-apr-text">
                        {v}
                      </span>
                    </motion.div>
                    <span className="mt-3 text-[17px] text-apr-muted">{l}</span>
                  </div>
                ))}
              </div>
              <Item i={5} className="text-[20px] leading-relaxed text-apr-muted">
                <Rico
                  t={
                    'Degraus que _diminuem_ dizem: "estou raspando o fundo". Degraus que aumentam gritam que ainda tem muito pra dar. *Nunca aumente a concessão.*'
                  }
                />
              </Item>
            </>
          }
          direita={
            <>
              <Fala
                rotulo="Segurando"
                tom="bom"
                i={3}
                tamanho={20}
                texto={
                  '"Preço não é problema quando o valor está claro. Deixa eu te mostrar de novo o que está incluso — e por que a gente não some em 90 dias."'
                }
              />
              <Fala
                rotulo="Concedendo 1% (com troca)"
                tom="ouro"
                i={4}
                tamanho={20}
                texto={
                  '"Esse valor eu não mexo. O que consigo brigar com meu gestor é *1%* — e já vou ter que justificar. Se fecharmos *hoje*, eu corro atrás. Combinado?"'
                }
              />
              <Fala
                rotulo="No limite"
                tom="ruim"
                i={5}
                tamanho={20}
                texto={
                  '"Cheguei no osso. Mais que isso eu tiraria da qualidade do seu projeto — e é exatamente por isso que você me procurou."'
                }
              />
            </>
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "com-mantras",
    titulo: "Os mantras do time LZ7",
    icone: Sparkles,
    render: () => (
      <Mantras
        kicker="Os mantras do time LZ7"
        itens={[
          "_Vendas é energia_ — o cliente compra sua convicção.",
          "Seja o _tubarão na mesa_: pergunte, conduza, feche.",
          "_Leia o cliente_ (DISC) e mude o discurso.",
          "_Valor primeiro_, número depois — nunca brigue por preço.",
          "Toda objeção: _Acolha → Pergunte → Prove → Avance._",
          "_Desconto com método_ — 1% de cada vez, e sempre por algo em troca.",
        ]}
      />
    ),
  },
  {
    id: "com-fim",
    titulo: "10 anos de sossego",
    icone: Trophy,
    render: () => (
      <Fim
        linha1="O concorrente vende um kit."
        linha2="Nós vendemos 10 anos de sossego."
        texto="Agora é treinar até virar natural. Entre na mesa como tubarão. ^Bora.^"
      />
    ),
  },
];
