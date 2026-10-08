/**
 * Sons da geladeira, sintetizados na hora com Web Audio (nenhum arquivo).
 * O navegador só libera áudio depois de um clique: ligarSons() precisa vir de um clique.
 */

export type Som = "brrr" | "vacuo" | "rangido" | "festa" | "batida" | "plim";

let ctx: AudioContext | null = null;
let ligado = false;
const tocando = new Map<string, number>();

export function sonsLigados() {
  return ligado;
}

export async function ligarSons(on: boolean) {
  ligado = on;
  if (!on) return;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === "suspended") await ctx.resume();
  tocar("plim");
}

function ruido(c: AudioContext, seg: number) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seg), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = buf;
  return s;
}

function env(c: AudioContext, t0: number, ataque: number, dur: number, pico: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(pico, t0 + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(c.destination);
  return g;
}

/** Toca um som; a mesma chave não repete em menos de 700 ms (hover nervoso). */
export function tocar(som: Som, chave: string = som) {
  if (!ligado || !ctx) return;
  const agora = performance.now();
  if ((tocando.get(chave) ?? 0) > agora - 700) return;
  tocando.set(chave, agora);
  const c = ctx;
  const t = c.currentTime;

  if (som === "brrr") {
    // dentes batendo: cliques rápidos + vento gelado
    for (let i = 0; i < 14; i++) {
      const o = c.createOscillator();
      o.type = "square";
      o.frequency.value = 900 + Math.random() * 500;
      const g = env(c, t + i * 0.055, 0.003, 0.03, 0.05);
      o.connect(g);
      o.start(t + i * 0.055);
      o.stop(t + i * 0.055 + 0.04);
    }
    const n = ruido(c, 1);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(600, t);
    f.frequency.linearRampToValueAtTime(1400, t + 0.9);
    n.connect(f);
    f.connect(env(c, t, 0.15, 0.95, 0.12));
    n.start(t);
  } else if (som === "vacuo") {
    // aspirador puxando: ruído com filtro subindo
    const n = ruido(c, 1.3);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 6;
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 1.1);
    n.connect(f);
    f.connect(env(c, t, 0.25, 1.25, 0.22));
    n.start(t);
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 1.1);
    o.connect(env(c, t, 0.2, 1.2, 0.04));
    o.start(t);
    o.stop(t + 1.25);
  } else if (som === "rangido") {
    // porta velha rangendo
    const o = c.createOscillator();
    o.type = "sawtooth";
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 23;
    lg.gain.value = 60;
    lfo.connect(lg);
    lg.connect(o.frequency);
    o.frequency.setValueAtTime(320, t);
    o.frequency.linearRampToValueAtTime(520, t + 0.35);
    o.frequency.linearRampToValueAtTime(260, t + 0.7);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 900;
    f.Q.value = 4;
    o.connect(f);
    f.connect(env(c, t, 0.05, 0.75, 0.12));
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.75);
    lfo.stop(t + 0.75);
  } else if (som === "festa") {
    // arpejo animado + chimbal
    const notas = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notas.forEach((hz, i) => {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = hz;
      const g = env(c, t + i * 0.09, 0.01, 0.16, 0.14);
      o.connect(g);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.18);
      const h = ruido(c, 0.05);
      const hf = c.createBiquadFilter();
      hf.type = "highpass";
      hf.frequency.value = 7000;
      h.connect(hf);
      hf.connect(env(c, t + i * 0.09, 0.002, 0.04, 0.05));
      h.start(t + i * 0.09);
    });
  } else if (som === "batida") {
    // toc-toc na porta
    [0, 0.16].forEach((dt) => {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(180, t + dt);
      o.frequency.exponentialRampToValueAtTime(70, t + dt + 0.12);
      o.connect(env(c, t + dt, 0.004, 0.14, 0.5));
      o.start(t + dt);
      o.stop(t + dt + 0.15);
    });
  } else if (som === "plim") {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.12);
    o.connect(env(c, t, 0.005, 0.25, 0.15));
    o.start(t);
    o.stop(t + 0.26);
  }
}
