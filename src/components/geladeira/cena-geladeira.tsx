import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { EstadoGeladeira, VendedorGeladeira } from "@/lib/geladeira.functions";
import { tocar, type Som } from "./sons";

/** Rosto, frases (revezam) e som de cada estado. */
export const CENA: Record<
  EstadoGeladeira,
  { rosto: string; som: Som; frases: string[]; temperatura: (n: number) => number }
> = {
  geladeira: {
    rosto: "🥶",
    som: "brrr",
    temperatura: () => -18,
    frases: [
      "Brrrr… alguém liga pro cliente por mim?",
      "Aprendi: lead parado vira picolé.",
      "Tô conservado, mas sem comissão.",
      "Me descongela que eu registro tudo, juro!",
    ],
  },
  vai_entrar: {
    rosto: "😱",
    som: "vacuo",
    temperatura: () => -6,
    frases: [
      "Socorro! Eu ia ligar hoje, juro!",
      "Segura minha gravata!",
      "É só um lead parado… ou três.",
      "Não me puxa, tenho reunião!",
    ],
  },
  risco: {
    rosto: "😬",
    som: "rangido",
    temperatura: (n) => 12 - n * 4,
    frases: [
      "Tá ventando gelado aqui…",
      "Vou registrar… daqui a pouco.",
      "Esse lead aí ainda tá fresco, né?",
      "Eita, a porta abriu sozinha?",
    ],
  },
  livre: {
    rosto: "😎",
    som: "festa",
    temperatura: () => 26,
    frases: [
      "Manda lead que eu tô quente! 🔥",
      "Registro tudo, sou dessas pessoas.",
      "Geladeira? Só pra gelar o refri.",
      "Cliente respondeu em 5 min, e você?",
    ],
  },
};

const COMIDA = ["🥬", "🧀", "🥚", "🍗", "🥦", "🍅"];
const BEBIDA = ["🥤", "🧃", "🍉", "🧊"];

export function CenaGeladeira({ v }: { v: VendedorGeladeira }) {
  const cena = CENA[v.estado];
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [boing, setBoing] = useState(0);
  const [linha, setLinha] = useState(v.id % cena.frases.length);

  useEffect(() => {
    const t = setInterval(() => setLinha((l) => (l + 1) % cena.frases.length), 3800);
    return () => clearInterval(t);
  }, [cena.frases.length]);

  const mexe = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${x * 26}deg`);
    el.style.setProperty("--rx", `${-y * 14}deg`);
  };
  const sai = () => {
    setHover(false);
    ref.current?.style.setProperty("--ry", "0deg");
    ref.current?.style.setProperty("--rx", "0deg");
  };
  const clica = () => {
    tocar("batida", `batida-${v.id}`);
    setTimeout(() => tocar(cena.som, `${cena.som}-${v.id}-c`), 260);
    setBoing((b) => b + 1);
    setLinha((l) => (l + 1) % cena.frases.length);
  };

  const n = v.parados.length;
  const itens = n
    ? v.parados.slice(0, 4).map((p, i) => ({
        k: p.dealId,
        emoji: COMIDA[(p.dealId + i) % COMIDA.length],
        rotulo: `${p.nome.split(" ")[0]} · ${p.dias}d`,
        podre: true,
      }))
    : BEBIDA.map((b, i) => ({ k: i, emoji: b, rotulo: "", podre: false }));
  const validade = v.ate
    ? new Date(v.ate).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      ref={ref}
      className={`g3 g3-${v.estado}${hover ? " g3-hover" : ""}`}
      onPointerMove={mexe}
      onPointerEnter={() => {
        setHover(true);
        tocar(cena.som, `${cena.som}-${v.id}`);
      }}
      onPointerLeave={sai}
      onClick={clica}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && clica()}
      role="button"
      tabIndex={0}
      aria-label={`${v.nome}: ${cena.frases[linha]}`}
    >
      <div className="g3-fala" key={linha}>
        {cena.frases[linha]}
      </div>
      <div className="g3-palco">
        <div className="g3-mundo" key={boing} data-boing={boing > 0 || undefined}>
          <div className="g3-chao" />
          <div className="g3-gel">
            <div className="g3-face g3-fundo">
              <div className="g3-luz" />
              {[0, 1].map((p) => (
                <div key={p} className="g3-prateleira">
                  {itens
                    .filter((_, i) => i % 2 === p)
                    .map((it) => (
                      <span key={it.k} className={`g3-item${it.podre ? " g3-podre" : ""}`}>
                        <span className="g3-item-e">{it.emoji}</span>
                        {it.rotulo && <span className="g3-item-r">{it.rotulo}</span>}
                      </span>
                    ))}
                </div>
              ))}
              {v.estado === "vai_entrar" && <div className="g3-redemoinho" />}
            </div>
            <div className="g3-face g3-esq" />
            <div className="g3-face g3-dir" />
            <div className="g3-face g3-topo" />
            {v.estado === "geladeira" && (
              <div className="g3-preso">
                <Boneco rosto={cena.rosto} nome={v.nome} />
                <div className="g3-bloco" />
              </div>
            )}
            <div className="g3-porta">
              <div className="g3-porta-fora">
                <span className="g3-visor">{cena.temperatura(n)}°C</span>
                <span className="g3-puxador" />
                <span className="g3-ima">Registrar é amar ❤️</span>
                {v.estado === "geladeira" && (
                  <span className="g3-etiqueta">
                    <b>CONGELADO</b>
                    <span>Lote: {n} leads parados</span>
                    {validade && <span>Validade: {validade}</span>}
                  </span>
                )}
                {v.estado === "vai_entrar" && (
                  <span className="g3-etiqueta g3-etiqueta-alerta">
                    <b>PRÉ-CONGELAMENTO</b>
                    <span>Próximo lead = geladeira</span>
                  </span>
                )}
              </div>
              {v.estado === "geladeira" && <span className="g3-janela" />}
              <div className="g3-porta-dentro">
                <span>🧴</span>
                <span>🥫</span>
              </div>
            </div>
            {v.estado === "geladeira" && (
              <div className="g3-nevoa" aria-hidden>
                <i />
                <i />
                <i />
              </div>
            )}
          </div>
          {v.estado !== "geladeira" && (
            <div className="g3-fora">
              <Boneco rosto={cena.rosto} nome={v.nome} suor={v.estado !== "livre"} />
            </div>
          )}
          <div className="g3-particulas" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <i
                key={i}
                style={{
                  left: `${4 + ((i * 37) % 92)}%`,
                  animationDelay: `${(i * 0.29) % 2.6}s`,
                }}
              >
                {v.estado === "livre" ? "" : "❄"}
              </i>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Boneco({ rosto, nome, suor }: { rosto: string; nome: string; suor?: boolean }) {
  return (
    <div className="g3-boneco">
      <div className="g3-cabeca">{rosto}</div>
      <div className="g3-tronco">
        <span className="g3-gravata" />
        <span className="g3-cracha">{nome}</span>
      </div>
      <div className="g3-braco g3-be" />
      <div className="g3-braco g3-bd">
        <span className="g3-celular">📱</span>
      </div>
      <div className="g3-perna g3-pe" />
      <div className="g3-perna g3-pd" />
      {suor && <span className="g3-suor">💦</span>}
    </div>
  );
}

/* Medidas da geladeira: L=86 A=144 P=58 (px). */
export const CSS_GELADEIRA = `
.g3 { position: relative; height: 250px; border-radius: var(--radius-lg); overflow: hidden; cursor: pointer;
  outline: none; --rx: 0deg; --ry: 0deg; isolation: isolate;
  background:
    radial-gradient(120% 80% at 50% 0%, color-mix(in oklch, var(--card) 70%, transparent), transparent 70%),
    linear-gradient(180deg, var(--surface-2), var(--surface-3)); }
.g3:focus-visible { box-shadow: 0 0 0 3px var(--ring); }
.g3-geladeira { background:
    radial-gradient(120% 80% at 50% 0%, color-mix(in oklch, var(--info) 30%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in oklch, var(--info) 18%, var(--surface-2)), color-mix(in oklch, var(--info) 28%, var(--surface-3))); }
.g3-vai_entrar { background:
    radial-gradient(90% 70% at 60% 55%, color-mix(in oklch, var(--danger) 18%, transparent), transparent 70%),
    linear-gradient(180deg, var(--surface-2), var(--surface-3)); }
.g3-livre { background:
    radial-gradient(90% 70% at 30% 20%, color-mix(in oklch, var(--warning) 28%, transparent), transparent 70%),
    linear-gradient(180deg, var(--surface-2), var(--surface-3)); }

.g3-fala { position: absolute; z-index: 20; top: 10px; left: 50%; max-width: 92%; transform: translateX(-50%);
  background: var(--card); color: var(--foreground); border: 1px solid var(--border); box-shadow: var(--shadow-sm);
  font-size: 11.5px; font-weight: 700; line-height: 1.25; text-align: center; padding: 5px 10px; border-radius: 12px;
  animation: g3-pop .35s cubic-bezier(.2,1.6,.4,1) both; pointer-events: none; }
.g3-fala::after { content: ""; position: absolute; bottom: -6px; left: 50%; margin-left: -6px; width: 10px; height: 10px;
  background: var(--card); border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); transform: rotate(45deg); }

.g3-palco { position: absolute; inset: 0; perspective: 760px; perspective-origin: 50% 35%; }
.g3-mundo { position: absolute; inset: 0; transform-style: preserve-3d;
  transform: rotateX(calc(-6deg + var(--rx))) rotateY(calc(-24deg + var(--ry)));
  transition: transform .35s cubic-bezier(.2,.8,.2,1); }
.g3-mundo[data-boing] { animation: g3-boing .5s cubic-bezier(.3,1.8,.4,1); }
.g3-chao { position: absolute; left: 50%; bottom: 16px; width: 300px; height: 220px; margin-left: -150px;
  transform-origin: 50% 100%; transform: rotateX(90deg);
  background: radial-gradient(closest-side, color-mix(in oklch, var(--foreground) 22%, transparent), transparent); }

/* caixa da geladeira */
.g3-gel { position: absolute; left: 50%; bottom: 16px; width: 86px; height: 144px; margin-left: -18px;
  transform-style: preserve-3d; transform: translateZ(0); }
.g3-face { position: absolute; border-radius: 10px; backface-visibility: visible; }
.g3-fundo { inset: 0; transform: translateZ(-29px); border-radius: 8px; overflow: hidden;
  background: linear-gradient(180deg, color-mix(in oklch, var(--info) 14%, var(--card)), color-mix(in oklch, var(--info) 26%, var(--surface-3)));
  display: flex; flex-direction: column; justify-content: space-evenly; padding: 30px 4px 6px; }
.g3-luz { position: absolute; top: 4px; left: 50%; width: 30px; height: 6px; margin-left: -15px; border-radius: 4px;
  background: var(--warning); box-shadow: 0 0 18px 6px color-mix(in oklch, var(--warning) 55%, transparent); }
.g3-prateleira { position: relative; display: flex; justify-content: center; gap: 2px; padding-bottom: 3px;
  border-bottom: 2px solid color-mix(in oklch, var(--info) 45%, var(--border)); }
.g3-item { display: flex; flex-direction: column; align-items: center; position: relative; }
.g3-item-e { font-size: 15px; line-height: 1; }
.g3-item-r { font-size: 6.5px; font-weight: 800; color: var(--foreground); background: var(--card); border-radius: 3px;
  padding: 0 2px; white-space: nowrap; max-width: 40px; overflow: hidden; text-overflow: ellipsis; }
.g3-podre .g3-item-e { filter: saturate(.55) hue-rotate(40deg); }
.g3-podre::before { content: "〰"; position: absolute; top: -9px; font-size: 9px; color: var(--success);
  animation: g3-fedor 1.4s ease-in-out infinite; }
.g3-esq, .g3-dir { top: 0; height: 144px; width: 58px; left: 14px;
  background: linear-gradient(90deg, var(--surface-3), var(--card)); border: 1px solid var(--border); }
.g3-esq { transform: rotateY(-90deg) translateZ(43px); }
.g3-dir { transform: rotateY(90deg) translateZ(43px); background: linear-gradient(90deg, var(--card), var(--surface-3)); }
.g3-topo { left: 0; top: 43px; width: 86px; height: 58px; transform: rotateX(90deg) translateZ(72px);
  background: var(--card); border: 1px solid var(--border); }

/* porta: dobradiça à direita, abre na direção de quem olha */
.g3-porta { position: absolute; inset: 0; transform-style: preserve-3d; transform-origin: 100% 50%;
  transform: translateZ(29px); transition: transform .5s cubic-bezier(.3,1.4,.5,1); }
.g3-porta-fora, .g3-porta-dentro { position: absolute; inset: 0; border-radius: 10px; backface-visibility: hidden; }
.g3-porta-fora { background: linear-gradient(135deg, var(--card) 0%, var(--surface-2) 60%, var(--card) 100%);
  border: 2px solid var(--border); box-shadow: inset -6px 0 12px color-mix(in oklch, var(--foreground) 8%, transparent); }
.g3-porta-fora::before { content: ""; position: absolute; left: 0; right: 0; top: 34%; height: 2px; background: var(--border); }
.g3-porta-dentro { transform: rotateY(180deg); background: var(--surface-3); border: 2px solid var(--border);
  display: flex; flex-direction: column; justify-content: space-around; align-items: center; font-size: 14px; }
.g3-visor { position: absolute; top: 6px; left: 8px; font-size: 8px; font-weight: 800; line-height: 1; letter-spacing: .04em;
  padding: 2px 4px; border-radius: 3px; background: var(--foreground); color: var(--info); }
.g3-livre .g3-visor { color: var(--warning); } .g3-risco .g3-visor { color: var(--warning); }
.g3-puxador { position: absolute; left: 6px; top: 40%; width: 5px; height: 30px; border-radius: 3px; background: var(--muted-foreground); }
.g3-ima { position: absolute; right: 4px; top: 58px; font-size: 6.5px; font-weight: 800; padding: 2px 3px; border-radius: 3px;
  background: var(--danger); color: var(--card); transform: rotate(8deg); }
.g3-etiqueta { position: absolute; left: 14px; right: 6px; bottom: 10px; display: flex; flex-direction: column; gap: 1px;
  font-size: 6.5px; line-height: 1.15; padding: 3px 4px; border-radius: 3px; transform: rotate(-4deg);
  background: var(--card); color: var(--foreground); border: 1px dashed var(--info); }
.g3-etiqueta b { color: var(--info); font-size: 8px; letter-spacing: .06em; }
.g3-etiqueta-alerta { border-color: var(--danger); } .g3-etiqueta-alerta b { color: var(--danger); }

/* janela da geladeira com o vendedor congelado */
.g3-geladeira .g3-porta-fora { -webkit-mask: radial-gradient(circle at 50% 33%, transparent 21px, #000 22px);
  mask: radial-gradient(circle at 50% 33%, transparent 21px, #000 22px); }
.g3-janela { position: absolute; left: 50%; top: 33%; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
  border: 3px solid var(--info); backface-visibility: hidden;
  background: radial-gradient(circle at 35% 30%, color-mix(in oklch, var(--card) 55%, transparent), color-mix(in oklch, var(--info) 22%, transparent) 70%);
  box-shadow: inset 0 0 10px color-mix(in oklch, var(--info) 70%, transparent), 0 0 12px color-mix(in oklch, var(--info) 50%, transparent); }
.g3-preso { position: absolute; left: 50%; top: 30px; transform: translateZ(22px) translateX(-50%) scale(.8); transform-origin: 50% 0; }
.g3-bloco { position: absolute; inset: -6px -10px 0; border-radius: 8px; border: 1px solid var(--info);
  background: linear-gradient(135deg, color-mix(in oklch, var(--card) 45%, transparent), color-mix(in oklch, var(--info) 30%, transparent)); }

/* vendedor */
.g3-fora { position: absolute; left: 50%; bottom: 16px; margin-left: -96px; transform: translateZ(46px); transform-style: preserve-3d; }
.g3-boneco { position: relative; width: 46px; height: 98px; }
.g3-cabeca { position: absolute; left: 50%; top: 0; margin-left: -17px; font-size: 34px; line-height: 1; z-index: 3;
  transform-origin: 50% 90%; filter: drop-shadow(0 2px 2px color-mix(in oklch, var(--foreground) 25%, transparent)); }
.g3-tronco { position: absolute; left: 50%; top: 34px; width: 28px; height: 32px; margin-left: -14px; border-radius: 10px 10px 6px 6px;
  background: var(--primary); z-index: 2; }
.g3-gravata { position: absolute; left: 50%; top: 2px; width: 6px; height: 18px; margin-left: -3px; background: var(--danger);
  clip-path: polygon(30% 0, 70% 0, 100% 25%, 65% 100%, 35% 100%, 0 25%); transform-origin: 50% 0; }
.g3-cracha { position: absolute; left: -2px; bottom: 3px; max-width: 32px; font-size: 6px; font-weight: 800; padding: 1px 2px;
  border-radius: 2px; background: var(--card); color: var(--foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g3-braco { position: absolute; top: 36px; width: 7px; height: 26px; border-radius: 4px; background: var(--primary); transform-origin: 50% 3px; z-index: 1; }
.g3-be { left: 3px; transform: rotate(18deg); } .g3-bd { right: 3px; transform: rotate(-18deg); }
.g3-celular { position: absolute; bottom: -8px; left: -4px; font-size: 11px; }
.g3-perna { position: absolute; top: 64px; width: 8px; height: 30px; border-radius: 4px; background: var(--foreground); transform-origin: 50% 0; }
.g3-pe { left: 13px; } .g3-pd { right: 13px; }
.g3-suor { position: absolute; right: -4px; top: 0; font-size: 12px; animation: g3-pinga 1s ease-in infinite; z-index: 4; }

/* partículas */
.g3-particulas { position: absolute; inset: 0; transform: translateZ(70px); pointer-events: none; }
.g3-particulas i { position: absolute; display: block; top: -14px; font-style: normal; font-size: 11px; color: var(--info); opacity: 0; }
.g3-geladeira .g3-particulas i { animation: g3-neve 2.6s linear infinite; }
.g3-livre.g3-hover .g3-particulas i { width: 6px; height: 9px; border-radius: 1px; animation: g3-confete 1.6s ease-in infinite; }
.g3-livre .g3-particulas i:nth-child(3n) { background: var(--danger); }
.g3-livre .g3-particulas i:nth-child(3n+1) { background: var(--warning); }
.g3-livre .g3-particulas i:nth-child(3n+2) { background: var(--success); }

/* ===== NA GELADEIRA ===== */
.g3-geladeira .g3-gel { animation: g3-treme .16s linear infinite; }
.g3-geladeira .g3-cabeca { animation: g3-bate-dente .12s linear infinite; }
.g3-geladeira .g3-be { transform: rotate(150deg); } .g3-geladeira .g3-bd { transform: rotate(-150deg); }
.g3-geladeira.g3-hover .g3-porta { transform: translateZ(29px) rotateY(28deg); }
.g3-nevoa { position: absolute; left: -10px; top: 20px; transform: translateZ(34px); pointer-events: none; }
.g3-nevoa i { position: absolute; width: 38px; height: 38px; border-radius: 50%; opacity: 0;
  background: radial-gradient(closest-side, color-mix(in oklch, var(--card) 90%, transparent), transparent); }
.g3-geladeira.g3-hover .g3-nevoa i { animation: g3-fumaca 1.6s ease-out infinite; }
.g3-nevoa i:nth-child(2) { animation-delay: .5s !important; top: 30px; } .g3-nevoa i:nth-child(3) { animation-delay: 1s !important; top: 60px; }

/* ===== ENTRA NO PRÓXIMO LEAD ===== */
.g3-vai_entrar .g3-porta { transform: translateZ(29px) rotateY(118deg); }
.g3-redemoinho { position: absolute; left: 50%; top: 50%; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%;
  background: repeating-conic-gradient(color-mix(in oklch, var(--info) 45%, transparent) 0 18deg, transparent 18deg 36deg);
  animation: g3-gira 1.1s linear infinite; mix-blend-mode: multiply; }
.g3-vai_entrar .g3-fora { animation: g3-sugado 2s cubic-bezier(.5,0,.5,1) infinite; }
.g3-vai_entrar .g3-be { animation: g3-agita .25s ease-in-out infinite alternate; }
.g3-vai_entrar .g3-bd { animation: g3-agita2 .3s ease-in-out infinite alternate; }
.g3-vai_entrar .g3-pe { animation: g3-chuta .2s ease-in-out infinite alternate; }
.g3-vai_entrar .g3-pd { animation: g3-chuta .2s ease-in-out infinite alternate-reverse; }
.g3-vai_entrar .g3-gravata { animation: g3-gravata .3s ease-in-out infinite alternate; }
.g3-vai_entrar.g3-hover .g3-fora { animation-duration: .9s; }
.g3-vai_entrar.g3-hover .g3-redemoinho { animation-duration: .35s; }

/* ===== EM RISCO ===== */
.g3-risco .g3-porta { animation: g3-range 2.2s ease-in-out infinite; }
.g3-risco .g3-fora { animation: g3-espia 2.8s ease-in-out infinite; }
.g3-risco .g3-cabeca { animation: g3-olha 2.8s ease-in-out infinite; }
.g3-risco.g3-hover .g3-porta { animation: g3-bate-porta .7s cubic-bezier(.3,1.6,.5,1) 1 both; }
.g3-risco.g3-hover .g3-fora { animation: g3-susto .6s cubic-bezier(.3,1.8,.4,1) 1 both; }

/* ===== LIVRE ===== */
.g3-livre .g3-fora { animation: g3-danca .8s ease-in-out infinite; }
.g3-livre .g3-be { animation: g3-braco-festa .4s ease-in-out infinite alternate; }
.g3-livre .g3-bd { animation: g3-braco-festa2 .4s ease-in-out infinite alternate; }
.g3-livre .g3-pe { animation: g3-chuta .4s ease-in-out infinite alternate; }
.g3-livre .g3-pd { animation: g3-chuta .4s ease-in-out infinite alternate-reverse; }
.g3-livre.g3-hover .g3-fora { animation: g3-giro .9s cubic-bezier(.4,0,.2,1) infinite; }
.g3-livre.g3-hover .g3-porta { transform: translateZ(29px) rotateY(70deg); }

@keyframes g3-pop { from { transform: translateX(-50%) scale(.6); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }
@keyframes g3-boing { 0% { scale: 1 1; } 30% { scale: 1.08 .9; } 60% { scale: .95 1.06; } 100% { scale: 1 1; } }
@keyframes g3-treme { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-1.5px) rotateZ(-.4deg); } 75% { transform: translateX(1.5px) rotateZ(.4deg); } }
@keyframes g3-bate-dente { 0%,100% { transform: translateY(0); } 50% { transform: translateY(1.5px) rotate(2deg); } }
@keyframes g3-neve { 0% { transform: translateY(0) rotate(0); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(260px) rotate(300deg); opacity: .2; } }
@keyframes g3-confete { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(260px) rotate(720deg); opacity: .6; } }
@keyframes g3-fumaca { 0% { transform: translate(0,0) scale(.4); opacity: 0; } 20% { opacity: .9; } 100% { transform: translate(-40px,-10px) scale(2.2); opacity: 0; } }
@keyframes g3-gira { to { transform: rotate(360deg); } }
@keyframes g3-sugado {
  0%,100% { transform: translateZ(46px) translateX(0) rotateZ(0) scale(1); }
  40% { transform: translateZ(30px) translateX(52px) rotateZ(-24deg) scale(.78); }
  50% { transform: translateZ(28px) translateX(48px) rotateZ(16deg) scale(.8); }
  70% { transform: translateZ(46px) translateX(-6px) rotateZ(-8deg) scale(1.04); } }
@keyframes g3-agita { from { transform: rotate(120deg); } to { transform: rotate(170deg); } }
@keyframes g3-agita2 { from { transform: rotate(-110deg); } to { transform: rotate(-165deg); } }
@keyframes g3-chuta { from { transform: rotate(-22deg); } to { transform: rotate(22deg); } }
@keyframes g3-gravata { from { transform: rotate(-30deg); } to { transform: rotate(-80deg); } }
@keyframes g3-range { 0%,100% { transform: translateZ(29px) rotateY(8deg); } 50% { transform: translateZ(29px) rotateY(40deg); } }
@keyframes g3-espia { 0%,100% { transform: translateZ(46px) translateX(0) rotateZ(0); } 35% { transform: translateZ(46px) translateX(16px) rotateZ(12deg); } 65% { transform: translateZ(46px) translateX(-4px) rotateZ(-5deg); } }
@keyframes g3-olha { 0%,100% { transform: rotate(0); } 35% { transform: rotate(14deg); } 65% { transform: rotate(-10deg); } }
@keyframes g3-bate-porta { 0% { transform: translateZ(29px) rotateY(75deg); } 100% { transform: translateZ(29px) rotateY(0); } }
@keyframes g3-susto { 0% { transform: translateZ(46px) translateY(0); } 40% { transform: translateZ(46px) translateY(-26px) scale(1.1, .92); } 100% { transform: translateZ(46px) translateY(0); } }
@keyframes g3-danca { 0%,100% { transform: translateZ(46px) translateY(0) rotateZ(-7deg); } 50% { transform: translateZ(46px) translateY(-10px) rotateZ(7deg); } }
@keyframes g3-braco-festa { from { transform: rotate(140deg); } to { transform: rotate(175deg); } }
@keyframes g3-braco-festa2 { from { transform: rotate(-140deg); } to { transform: rotate(-175deg); } }
@keyframes g3-giro { 0% { transform: translateZ(46px) rotateY(0) translateY(0); } 50% { transform: translateZ(46px) rotateY(180deg) translateY(-16px); } 100% { transform: translateZ(46px) rotateY(360deg) translateY(0); } }
@keyframes g3-fedor { 0%,100% { transform: translateY(0); opacity: .3; } 50% { transform: translateY(-3px); opacity: 1; } }
@keyframes g3-pinga { from { transform: translateY(0); opacity: 1; } to { transform: translateY(14px); opacity: 0; } }

.gel-termo { height: 8px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.gel-termo-fill { height: 100%; border-radius: 999px; transition: width var(--dur-slow) var(--ease-out); }
.gel-n1, .gel-n2 { background: var(--warning); } .gel-n3 { background: var(--danger); }

@media (prefers-reduced-motion: reduce) {
  .g3, .g3 * { animation: none !important; transition: none !important; }
}
`;
