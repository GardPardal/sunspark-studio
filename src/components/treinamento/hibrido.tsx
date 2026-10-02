/**
 * Treinamento técnico-comercial "Sistema híbrido" — conteúdo idêntico ao PDF
 * "Treinamento Comercial LZ7 - Completo" (páginas 32 a 47), com o design da /apresentacao.
 */
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BatteryCharging,
  CircuitBoard,
  Gauge,
  HelpCircle,
  House,
  Landmark,
  ListOrdered,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
  Zap,
} from "lucide-react";

import { EASE, Item } from "@/components/apresentacao/palco";

import { Capa, Cartao, Conteudo, Duas, Fim, Lista, Rico, Tabela, type SlideTreino } from "./blocos";

/* ---------------- diagramas ---------------- */

function No({
  x,
  y,
  w,
  h,
  titulo,
  sub,
  cor,
  apagado = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  titulo: string;
  sub?: string;
  cor: string;
  apagado?: boolean;
}) {
  return (
    <foreignObject x={x} y={y} width={w} height={h}>
      <div
        className={
          "flex h-full w-full flex-col items-center justify-center rounded-2xl border-2 bg-apr-surface text-center " +
          cor +
          (apagado ? " opacity-45" : "")
        }
      >
        <div className="font-display text-[20px] font-semibold text-apr-text">{titulo}</div>
        {sub && <div className="mt-0.5 text-[14px] text-apr-muted">{sub}</div>}
      </div>
    </foreignObject>
  );
}

/** Linha animada (desenho do traço). */
function Traco({
  d,
  cls,
  atraso = 0,
  tracejado,
}: {
  d: string;
  cls: string;
  atraso?: number;
  tracejado?: boolean;
}) {
  return (
    <motion.path
      d={d}
      fill="none"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      strokeDasharray={tracejado ? "10 10" : undefined}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ delay: atraso, duration: 0.9, ease: EASE }}
    />
  );
}

/** Energia correndo pela linha (bolinha que percorre o traço). */
function Fluxo({ d, cls, atraso = 0 }: { d: string; cls: string; atraso?: number }) {
  return (
    <circle r={6} className={cls} opacity={0}>
      <animate
        attributeName="opacity"
        values="0;1;1;0"
        dur="2.4s"
        begin={`${atraso}s`}
        repeatCount="indefinite"
      />
      <animateMotion dur="2.4s" repeatCount="indefinite" path={d} begin={`${atraso}s`} />
    </circle>
  );
}

function DiagramaInversor() {
  const sol = "M 290 230 L 560 230";
  const casa = "M 800 230 L 930 230 L 930 90 L 1080 90";
  const bat = "M 930 230 L 1080 230";
  const rede = "M 930 230 L 930 370 L 1080 370";
  return (
    <svg viewBox="0 0 1424 460" className="w-full">
      <title>Inversor híbrido no centro: painéis, casa, bateria e rede</title>
      <Traco d={sol} cls="stroke-apr-gold" atraso={0.3} />
      <Traco d={casa} cls="stroke-apr-signed" atraso={0.6} />
      <Traco d={bat} cls="stroke-apr-billed" atraso={0.75} />
      <Traco d={rede} cls="stroke-apr-dim" atraso={0.9} />
      <Fluxo d={sol} cls="fill-apr-gold" atraso={1.2} />
      <Fluxo d={casa} cls="fill-apr-signed" atraso={1.6} />
      <Fluxo d={bat} cls="fill-apr-billed" atraso={1.8} />
      <No
        x={60}
        y={175}
        w={230}
        h={110}
        titulo="☀ Painéis"
        sub="geram do sol (CC)"
        cor="border-apr-gold"
      />
      <No x={560} y={150} w={240} h={160} titulo="INVERSOR HÍBRIDO" cor="border-apr-glow" />
      <No
        x={1080}
        y={40}
        w={260}
        h={100}
        titulo="🏠 Sua casa"
        sub="as cargas"
        cor="border-apr-signed"
      />
      <No
        x={1080}
        y={180}
        w={260}
        h={100}
        titulo="🔋 Bateria"
        sub="guarda energia"
        cor="border-apr-billed"
      />
      <No
        x={1080}
        y={320}
        w={260}
        h={100}
        titulo="⚡ Rede (Copel)"
        sub="reforço + créditos"
        cor="border-apr-line"
      />
    </svg>
  );
}

function DiagramaApagao() {
  const sol = "M 270 170 L 520 170";
  const bat = "M 330 330 L 400 330 L 400 170 L 520 170";
  const paraGateway = "M 760 170 L 860 170";
  const paraCasa = "M 1060 170 L 1100 170 L 1100 80 L 1160 80";
  const rede = "M 1100 170 L 1100 330 L 1160 330";
  return (
    <svg viewBox="0 0 1424 420" className="w-full">
      <title>
        No apagão o gateway isola a casa e o inversor segue alimentando as cargas essenciais
      </title>
      <Traco d={sol} cls="stroke-apr-gold" atraso={0.3} />
      <Traco d={bat} cls="stroke-apr-billed" atraso={0.45} />
      <Traco d={paraGateway} cls="stroke-apr-signed" atraso={0.7} />
      <Traco d={paraCasa} cls="stroke-apr-signed" atraso={0.9} />
      <Traco d={rede} cls="stroke-apr-dim" atraso={1.0} tracejado />
      <Fluxo d={sol} cls="fill-apr-gold" atraso={1.3} />
      <Fluxo d={bat} cls="fill-apr-billed" atraso={1.4} />
      <Fluxo d={paraGateway} cls="fill-apr-signed" atraso={1.7} />
      <Fluxo d={paraCasa} cls="fill-apr-signed" atraso={1.9} />
      <motion.g
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.4, type: "spring", stiffness: 200, damping: 12 }}
        style={{ transformOrigin: "1100px 250px" }}
      >
        <path
          d="M 1080 230 L 1120 270 M 1120 230 L 1080 270"
          strokeWidth={7}
          strokeLinecap="round"
          className="stroke-danger"
        />
      </motion.g>
      <No
        x={50}
        y={115}
        w={220}
        h={110}
        titulo="☀ Painéis"
        sub="(se houver sol)"
        cor="border-apr-gold"
      />
      <No
        x={110}
        y={280}
        w={220}
        h={100}
        titulo="🔋 Bateria"
        sub="fornece energia"
        cor="border-apr-billed"
      />
      <No x={520} y={100} w={240} h={140} titulo="INVERSOR HÍBRIDO" cor="border-apr-glow" />
      <No
        x={860}
        y={115}
        w={200}
        h={110}
        titulo="Gateway"
        sub="ATS · isola"
        cor="border-apr-muted"
      />
      <No
        x={1160}
        y={25}
        w={240}
        h={110}
        titulo="🏠 Cargas essenciais"
        sub="geladeira, luz, internet…"
        cor="border-apr-signed"
      />
      <No x={1160} y={280} w={240} h={100} titulo="⚡ Rede caiu" cor="border-apr-line" apagado />
    </svg>
  );
}

const Legenda = ({ itens }: { itens: [string, string][] }) => (
  <div className="flex flex-wrap items-center justify-center gap-7 text-[16px] text-apr-muted">
    {itens.map(([cls, t]) => (
      <span key={t} className="flex items-center gap-2">
        <i className={"h-1.5 w-7 rounded-full " + cls} />
        {t}
      </span>
    ))}
  </div>
);

/* ---------------- slides ---------------- */

const Sim = ({ t }: { t: string }) => <span className="font-semibold text-success">✓ {t}</span>;
const Nao = ({ t }: { t: string }) => <span className="font-semibold text-danger">✗ {t}</span>;

function Fila({ passos }: { passos: { n: string; t: string; s: string; cls: string }[] }) {
  return (
    <div className="mt-10 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-4">
      {passos.flatMap((p, k): ReactNode[] => {
        const card = (
          <Item
            key={p.n}
            i={2 + k * 2}
            className={"rounded-3xl border-2 bg-apr-surface/70 p-8 text-center " + p.cls}
          >
            <div className="font-display text-[56px] font-semibold leading-none text-apr-text">
              {p.n}
            </div>
            <div className="mt-3 font-display text-[24px] font-semibold uppercase tracking-wide text-apr-text">
              {p.t}
            </div>
            <div className="mt-2 text-[18px] text-apr-muted">{p.s}</div>
          </Item>
        );
        if (k === passos.length - 1) return [card];
        return [
          card,
          <Item
            key={p.n + "→"}
            i={3 + k * 2}
            className="flex items-center font-display text-[44px] text-apr-glow"
          >
            →
          </Item>,
        ];
      })}
    </div>
  );
}

export const SLIDES_HIBRIDO: SlideTreino[] = [
  {
    id: "hib-capa",
    titulo: "Sistema híbrido",
    icone: BatteryCharging,
    render: () => (
      <Capa
        kicker="Treinamento técnico-comercial"
        titulo="Sistema _híbrido_"
        sub="Solar + bateria = ^um no-break para a casa inteira.^"
        nota="Cliente residencial · Grupo B · baixa tensão"
      />
    ),
  },
  {
    id: "hib-duas",
    titulo: "A bateria faz duas coisas",
    icone: Sparkles,
    render: () => (
      <Conteudo
        tag="Comece por aqui"
        kicker="A regra de ouro deste produto"
        titulo="A bateria faz _DUAS coisas_ — e as duas vendem."
        rodape="_Lidere pelo backup_ (todo mundo entende) e use a ^fuga do imposto^ como o reforço que faz o valor crescer ano a ano."
      >
        <Duas
          esquerda={
            <Cartao
              titulo="① Backup — o principal"
              tom="bom"
              tamanho={21}
              textos={[
                "*Segurança quando falta luz.* Alimenta as cargas essenciais (geladeira, luz, internet, portão) no apagão. É conforto e proteção — como um *no-break da casa inteira.* É o que todo cliente entende na hora.",
              ]}
            />
          }
          direita={
            <Cartao
              titulo="② Fugir do imposto — a opção que cresce"
              tom="ouro"
              i={4}
              tamanho={21}
              textos={[
                "Cada kWh que sai da *sua bateria* à noite *não paga Fio B nem ICMS de transmissão.* E o Fio B só sobe. É uma opção real — o cliente escolhe o tamanho da bateria.",
              ]}
            />
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "hib-tipos",
    titulo: "On-grid, off-grid e híbrido",
    icone: PlugZap,
    render: () => (
      <Conteudo
        tag="Fundamento"
        kicker="Saiba diferenciar na hora"
        titulo="On-grid, off-grid e _híbrido._"
        rodape="O concorrente vende *on-grid*. O híbrido resolve o ponto fraco dele: _ficar sem energia quando a rede cai._"
      >
        <div className="mt-10 grid grid-cols-3 gap-6">
          <Cartao
            titulo="On-grid (comum)"
            i={2}
            tamanho={20}
            textos={[
              "Só painéis, ligado à rede. Gera de dia. *Cai a luz, ele desliga* por norma (anti-ilhamento) — a casa fica no escuro, mesmo com sol.",
            ]}
          />
          <Cartao
            titulo="Off-grid (isolado)"
            tom="azul"
            i={3}
            tamanho={20}
            textos={[
              "Painéis + bateria, *sem rede*. Para onde não chega energia. Bateria grande, mais caro. Nicho.",
            ]}
          />
          <Cartao
            titulo="Híbrido ✓"
            tom="bom"
            i={4}
            tamanho={20}
            className="ring-2 ring-success/50"
            textos={[
              "Painéis + bateria + rede. Gera, guarda e ainda tem a rede de reserva — e *segura a casa no apagão*. É o que a gente vende.",
            ]}
          />
        </div>
      </Conteudo>
    ),
  },
  {
    id: "hib-cerebro",
    titulo: "O inversor é o cérebro",
    icone: CircuitBoard,
    render: () => (
      <Conteudo
        tag="Como funciona · 1"
        kicker="O inversor híbrido é o cérebro"
        titulo="Ele decide, a cada segundo, _para onde vai a energia._"
        rodape={
          'Três "portas" no inversor: entra o _sol_, conversa com a _bateria_ (carrega e usa), e liga na _casa_ e na _rede_.'
        }
      >
        <Item i={2} className="mt-8">
          <DiagramaInversor />
        </Item>
      </Conteudo>
    ),
  },
  {
    id: "hib-fila",
    titulo: "A fila do inversor",
    icone: ListOrdered,
    render: () => (
      <Conteudo
        tag="Como funciona · 2"
        kicker="A ordem que o inversor sempre segue"
        titulo='"Vai tudo pra bateria?" _Não._ Existe uma fila.'
        rodape="Alimentar a casa primeiro _protege a bateria_ (menos ciclos à toa) e aproveita melhor o sol."
      >
        <Fila
          passos={[
            {
              n: "1º",
              t: "Casa",
              s: "o sol atende o consumo do momento",
              cls: "border-apr-signed",
            },
            { n: "2º", t: "Carrega bateria", s: "o que sobra do sol", cls: "border-apr-billed" },
            { n: "3º", t: "Injeta na rede", s: "excedente vira crédito", cls: "border-apr-line" },
          ]}
        />
        <Item i={8} className="mt-9 text-center text-[22px] text-apr-muted">
          <Rico t="À noite a fila inverte: *usa a bateria* → e só *completa com a rede* quando ela chega no mínimo reservado." />
        </Item>
      </Conteudo>
    ),
  },
  {
    id: "hib-dor",
    titulo: "Backup · a dor",
    icone: Zap,
    render: () => (
      <Conteudo
        tag="Backup · 1 · A dor"
        kicker="O que choca o cliente"
        titulo="Solar comum _apaga junto com a rede_ — mesmo ao meio-dia com sol forte."
      >
        <Duas
          esquerda={
            <Lista
              itens={[
                "Todo inversor on-grid é *obrigado por norma* a desligar quando a rede cai (anti-ilhamento).",
                'Por segurança: se continuasse injetando na rede "morta", poderia *eletrocutar o técnico* no poste.',
                "Resultado: quem tem só solar comum *fica no escuro no apagão*, com o sol brilhando lá fora.",
              ]}
            />
          }
          direita={
            <Cartao
              titulo="A frase que abre os olhos"
              tom="ruim"
              tamanho={21}
              textos={[
                '"Você sabia que o seu vizinho com placa solar comum *também fica no escuro* quando cai a luz? A placa desliga junto com a rede. É a lei."',
                "*É essa dor que o híbrido com backup resolve.*",
              ]}
            />
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "hib-apagao",
    titulo: "Faltou luz na rua",
    icone: ShieldCheck,
    render: () => (
      <Conteudo
        tag="Backup · 2 · O coração"
        kicker="Faltou luz na rua"
        titulo="O híbrido _isola a casa da rede_ e continua funcionando."
        rodape="O _gateway/ATS_ desconecta a casa da rede em *10–30 ms* — você nem percebe a queda. Exige o inversor certo + quadro de essenciais."
      >
        <Item i={2} className="mt-6">
          <DiagramaApagao />
        </Item>
        <Item i={3} className="mt-2">
          <Legenda
            itens={[
              ["bg-apr-gold", "Sol"],
              ["bg-apr-billed", "Bateria"],
              ["bg-apr-signed", "Para a casa"],
              ["bg-apr-dim", "Rede isolada"],
            ]}
          />
        </Item>
      </Conteudo>
    ),
  },
  {
    id: "hib-quadro",
    titulo: "Quadro de cargas essenciais",
    icone: House,
    render: () => (
      <Conteudo
        tag="Backup · 3"
        kicker="O quadro de cargas essenciais"
        titulo="O que entra no backup — e o que _não entra._"
      >
        <Duas
          proporcao="1.1fr_0.9fr"
          esquerda={
            <Tabela
              cabecalho={["Carga", "No backup?"]}
              larguras={["auto", "220px"]}
              tamanho={20}
              primeiraColuna={() => "text-apr-text"}
              linhas={[
                ["Geladeira / freezer", <Sim key="1" t="Sim" />],
                ["Luzes, internet, TV, celular", <Sim key="2" t="Sim" />],
                ["Portão, câmeras, alarme", <Sim key="3" t="Sim" />],
                ["Bomba d'água / poço", <Sim key="4" t="Geralmente" />],
                ["Chuveiro elétrico (4.500–7.500 W)", <Nao key="5" t="Não" />],
                ["Ar-condicionado / forno / indução", <Nao key="6" t="Evitar" />],
              ]}
            />
          }
          direita={
            <Cartao
              titulo="Por que isso importa"
              tom="ouro"
              i={4}
              tamanho={19}
              textos={[
                'O que "estoura" o backup não é a energia — é a *potência de pico*. Chuveiro e ar puxam muito de uma vez e drenam a bateria em minutos.',
                '*Backup real* = um quadro separado só com o essencial. "Backup" sem esse quadro é promessa vazia — é engenharia, não só equipamento.',
                "_Alinhe isso na venda: backup é para o essencial, não para a casa inteira._",
              ]}
            />
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "hib-kwh",
    titulo: "kWh × kW",
    icone: Gauge,
    render: () => (
      <Conteudo
        tag="A bateria · 1"
        kicker="O conceito mais mal explicado do mercado"
        titulo="Capacidade (kWh) × Potência (kW)."
        rodape={
          '"kWh é por quanto tempo. kW é quanta coisa ao mesmo tempo. Nós projetamos os dois — quem vende kit não projeta nenhum."'
        }
      >
        <Duas
          esquerda={
            <Cartao
              titulo="kWh = o tamanho do tanque"
              tom="bom"
              tamanho={21}
              textos={[
                "Quanta energia a bateria guarda. Define *por quanto tempo* você aguenta no apagão.",
              ]}
            >
              <div className="flex h-[120px] items-end gap-3 pt-3" aria-hidden>
                <div className="relative h-full w-[90px] overflow-hidden rounded-2xl border-2 border-success/60">
                  <motion.div
                    className="absolute inset-x-0 bottom-0 bg-success/50"
                    initial={{ height: "0%" }}
                    animate={{ height: "80%" }}
                    transition={{ delay: 0.6, duration: 1.4, ease: EASE }}
                  />
                </div>
              </div>
            </Cartao>
          }
          direita={
            <Cartao
              titulo="kW = o diâmetro da torneira"
              tom="azul"
              i={4}
              tamanho={21}
              textos={[
                "Quanto ela entrega *de uma vez*. Define *quantos aparelhos juntos* você liga.",
              ]}
            >
              <div className="flex h-[120px] items-center gap-4 pt-3" aria-hidden>
                {[10, 22, 36].map((w, k) => (
                  <motion.div
                    key={w}
                    className="rounded-full bg-apr-billed/60"
                    style={{ width: w, height: 100 }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.7 + k * 0.2, duration: 0.8, ease: EASE }}
                  />
                ))}
              </div>
            </Cartao>
          }
        />
        <Item
          i={6}
          className="mt-6 rounded-2xl border border-apr-line/70 bg-apr-surface/70 px-7 py-5"
        >
          <div className="text-[13px] font-semibold uppercase tracking-[0.2em] text-apr-dim">
            Exemplo que o cliente entende
          </div>
          <p className="mt-2 text-[21px] leading-snug text-apr-muted">
            <Rico t="Uma bateria de *10 kWh / 5 kW* guarda bastante, mas só entrega 5 kW por vez. Se ligar tudo junto e pedir 6 kW, ela não dá conta *mesmo estando cheia* — falta potência, não energia. *Projeto ruim erra justamente aqui.*" />
          </p>
        </Item>
      </Conteudo>
    ),
  },
  {
    id: "hib-lfp",
    titulo: "Lítio LFP",
    icone: BatteryCharging,
    render: () => (
      <Conteudo
        tag="A bateria · 2"
        kicker="O que responder sobre a bateria"
        titulo="Lítio _LFP_: segura, durável e pronta para 10 anos."
      >
        <div className="mt-9 grid grid-cols-4 gap-5">
          {(
            [
              ["~6.000", "ciclos de vida"],
              ["10–15", "anos de uso"],
              ["90–95%", "utilizável (DoD)"],
              ["~80%", "menos risco de fogo que a de carro"],
            ] as const
          ).map(([v, l], k) => (
            <Item
              key={l}
              i={2 + k}
              className="rounded-3xl border border-apr-line/80 bg-apr-surface/70 p-7 text-center"
            >
              <div className="font-display text-[56px] font-semibold leading-none text-apr-glow">
                {v}
              </div>
              <div className="mt-3 text-[18px] text-apr-muted">{l}</div>
            </Item>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-6">
          <Cartao
            titulo="Segurança"
            i={6}
            tamanho={19}
            textos={[
              "LFP (LiFePO4) é a química padrão mundial em casa. Só entra em instabilidade acima de ~220 °C e tem BMS que corta em qualquer anomalia. *É por isso que é segura dentro de casa.*",
            ]}
          />
          <Cartao
            titulo={'Contra "dura pouco"'}
            i={7}
            tamanho={19}
            textos={[
              "Isso era a bateria de chumbo antiga (500–1.000 ciclos, metade utilizável). LFP é *outra categoria*: milhares de ciclos, garantia de 10 anos. Ler sempre a apólice real.",
            ]}
          />
        </div>
      </Conteudo>
    ),
  },
  {
    id: "hib-autonomia",
    titulo: "Autonomia e preço",
    icone: Gauge,
    render: () => (
      <Conteudo
        tag="A bateria · 3"
        kicker={'"E dura quanto? Quanto custa?"'}
        titulo="Autonomia = _tamanho da bateria ÷ consumo essencial._"
      >
        <Duas
          proporcao="0.9fr_1.1fr"
          esquerda={
            <Cartao
              titulo="Exemplo real (casa brasileira)"
              tom="ouro"
              tamanho={20}
              textos={[
                "Essenciais — geladeira, luzes, internet, portão — consomem cerca de *0,35 kW*. Uma bateria de *5 kWh* segura isso por perto de *8 a 10 horas*.",
                "E de dia o *sol recarrega* a bateria — em apagões longos, ela se repõe a cada manhã. É a vantagem sobre o gerador.",
              ]}
            />
          }
          direita={
            <>
              <Tabela
                i={4}
                tamanho={20}
                cabecalho={["Porte", "Preço instalado¹", "Uso"]}
                linhas={[
                  ["*5 kWh*", "R$ 12–20 mil", "Backup de essenciais"],
                  ["*10 kWh*", "R$ 25–35 mil", "Backup robusto"],
                  ["> 20 kWh", "> R$ 60 mil", "Nicho / rural"],
                ]}
              />
              <Item i={5} className="text-[16px] leading-snug text-apr-dim">
                <Rico t="¹ Faixas de mercado 2026 (com inversor híbrido). A venda padrão é *5–10 kWh de essenciais*. Começa pequeno e expande depois." />
              </Item>
            </>
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "hib-fiob",
    titulo: "Fugir do Fio B",
    icone: Landmark,
    render: () => (
      <Conteudo
        tag="O reforço que faz o valor crescer"
        kicker="A conta que você não paga com bateria"
        titulo="Cada kWh da bateria foge do _Fio B_ — e do _ICMS da transmissão._"
      >
        <div className="mt-8 grid grid-cols-[420px_1fr] items-end gap-12">
          <Item i={2}>
            <div className="text-[14px] font-semibold uppercase tracking-[0.2em] text-apr-dim">
              O Fio B só sobe (Lei 14.300)
            </div>
            <div className="mt-4 flex h-[260px] items-end gap-5">
              {(
                [
                  ["'25", 45],
                  ["'26", 60],
                  ["'27", 75],
                  ["'28", 90],
                ] as const
              ).map(([ano, v], k) => (
                <div key={ano} className="flex flex-1 flex-col items-center">
                  <span
                    className={
                      "mb-2 font-display text-[22px] font-semibold " +
                      (k === 3 ? "text-apr-gold" : "text-apr-text")
                    }
                  >
                    {v}%
                  </span>
                  <motion.div
                    className={
                      "w-full rounded-t-2xl " + (k === 3 ? "bg-apr-gold" : "bg-apr-signed/70")
                    }
                    initial={{ height: 0 }}
                    animate={{ height: v * 2.2 }}
                    transition={{ delay: 0.4 + k * 0.18, duration: 0.9, ease: EASE }}
                  />
                  <span className="mt-2 text-[16px] text-apr-muted">{ano}</span>
                </div>
              ))}
            </div>
          </Item>
          <div className="space-y-6">
            <Item i={3} className="text-[24px] leading-relaxed text-apr-muted">
              <Rico t="Na energia que você _injeta e puxa de volta_, a rede cobra _Fio B + ICMS sobre a transmissão._ O kWh que vem da _sua própria bateria_ não passa pela rede — logo, _não paga nenhum dos dois._" />
            </Item>
            <Item i={4} className="text-[24px] leading-relaxed text-apr-muted">
              <Rico t="É por isso que a bateria é uma _opção que fica mais valiosa a cada ano._ O cliente escolhe: só _backup_ (bateria menor), ou _backup + fugir do imposto_ (um pouco maior)." />
            </Item>
          </div>
        </div>
      </Conteudo>
    ),
  },
  {
    id: "hib-cliente",
    titulo: "O cliente ideal",
    icone: UserCheck,
    render: () => (
      <Conteudo
        tag="Venda · Qualificação"
        kicker="O cliente ideal do híbrido"
        titulo="Para quem o backup _faz mais sentido._"
      >
        <Duas
          esquerda={
            <Lista
              tamanho={21}
              itens={[
                "Quem sofre com *queda de luz frequente* (rural, litoral, áreas de temporal, rede instável).",
                "Quem tem *home office* e não pode parar.",
                "Quem tem *equipamento médico* (CPAP, etc.) ou sensível.",
                "Famílias com *crianças, idosos* ou geladeira/freezer cheios.",
                "Quem valoriza *segurança, independência e conforto.*",
              ]}
            />
          }
          direita={
            <Cartao
              titulo="Sempre qualifique antes"
              tom="ouro"
              tamanho={20}
              textos={[
                "Pergunte: *com que frequência falta luz na sua região? Por quanto tempo?* Tem algum equipamento que não pode parar? Trabalha de casa?",
                "Isso define o porte da bateria e mostra ao cliente que *você projeta, não empurra kit.*",
              ]}
            />
          }
        />
      </Conteudo>
    ),
  },
  {
    id: "hib-objecoes",
    titulo: "Perguntas que travam",
    icone: HelpCircle,
    render: () => (
      <Conteudo
        tag="Venda · Objeções"
        kicker="Responda com base técnica"
        titulo="As perguntas que _travam o vendedor._"
      >
        <div className="mt-8 grid grid-cols-2 gap-5">
          {(
            [
              [
                '"Bateria é cara / não compensa."',
                '"E é por isso que não te vendo um banco gigante. Projeto o *backup dos seus essenciais* — uma bateria menor que resolve o problema real: você não fica no escuro. É conforto e segurança, como um no-break."',
              ],
              [
                '"E se a bateria acabar no apagão?"',
                '"Dimensiono pra sua autonomia real e reservo um mínimo. E *enquanto houver sol, ela recarrega de dia* — numa queda de dias, a casa se re-energiza toda manhã."',
              ],
              [
                '"É perigoso ter bateria em casa?"',
                '"Usamos *LFP*, a química mais segura, ~80% menos propensa a fogo que a de carro elétrico. Tem gestão eletrônica que corta em qualquer anomalia."',
              ],
              [
                '"Não é melhor um gerador?"',
                '"Gerador precisa de *combustível, óleo, faz barulho* e só liga depois que você percebe o apagão. A bateria entra em *10–30 ms*, é silenciosa, sem manutenção e reabastece com o sol."',
              ],
            ] as const
          ).map(([p, r], k) => (
            <Cartao key={p} titulo={p} i={2 + k} tamanho={19} textos={[r]} />
          ))}
        </div>
      </Conteudo>
    ),
  },
  {
    id: "hib-pitch",
    titulo: "Os ângulos que fecham",
    icone: Sun,
    render: () => (
      <Conteudo
        tag="Venda · O pitch"
        kicker="Lidere sempre pelo backup — o resto é reforço"
        titulo="Os ângulos que _fecham_ a venda do híbrido."
        rodape="_Lidere pelo backup_ — é o que fecha na emoção. A ^fuga do imposto^ é o número que faz o valor crescer todo ano."
      >
        <div className="mt-8 grid grid-cols-2 gap-5">
          <Cartao
            titulo="① Segurança (PRINCIPAL)"
            tom="bom"
            i={2}
            tamanho={21}
            textos={['"Sua casa continua de pé quando a rua inteira apaga."']}
          />
          <Cartao
            titulo="② Conforto (PRINCIPAL)"
            tom="bom"
            i={3}
            tamanho={21}
            textos={['"Você nem vai perceber que faltou luz." Um no-break para a casa inteira.']}
          />
          <Cartao
            titulo="③ O sol que não dorme (reforço)"
            i={4}
            tamanho={21}
            textos={['"O solar comum apaga com a rede, mesmo com sol. O híbrido não."']}
          />
          <Cartao
            titulo="④ Fugir do imposto (opção que cresce)"
            tom="ouro"
            i={5}
            tamanho={21}
            textos={[
              '"Cada kWh da sua bateria não paga Fio B nem ICMS de transmissão — e o Fio B chega a 90% em 2028. Quanto maior a bateria, mais o senhor escapa."',
            ]}
          />
        </div>
      </Conteudo>
    ),
  },
  {
    id: "hib-fim",
    titulo: "O híbrido trabalha para você",
    icone: BatteryCharging,
    render: () => (
      <Fim
        linha1="On-grid trabalha quando a _rede deixa._"
        linha2="O híbrido trabalha para você — inclusive no apagão."
        texto="Entenda, explique com convicção, e venda segurança — o produto mais valioso da LZ7."
      />
    ),
  },
];
