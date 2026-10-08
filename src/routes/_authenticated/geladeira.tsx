import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { RefreshCw, Snowflake } from "lucide-react";
import { DsBadge, DsButton, DsCard, DsPageHeader, DsSkeletonList } from "@/components/ds";
import type { Intent } from "@/components/ds";
import {
  getGeladeira,
  type EstadoGeladeira,
  type VendedorGeladeira,
} from "@/lib/geladeira.functions";

export const Route = createFileRoute("/_authenticated/geladeira")({
  head: () => ({
    meta: [
      { title: "Geladeira da roleta · LZ7 Solar" },
      {
        name: "description",
        content:
          "Quem está na geladeira (sem receber leads do quiz) por deixar leads parados, quem vai entrar e quem está livre.",
      },
      { property: "og:title", content: "Geladeira da roleta · LZ7 Solar" },
      {
        property: "og:description",
        content: "Penalidades da roleta de leads do quiz por unidade.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: GeladeiraPage,
});

const ESTADO: Record<
  EstadoGeladeira,
  { rosto: string; fala: string; rotulo: string; intent: Intent }
> = {
  geladeira: { rosto: "🥶", fala: "Brrrr! Me tira daqui!", rotulo: "Na geladeira", intent: "info" },
  vai_entrar: {
    rosto: "😱",
    fala: "Nããão! Só mais um dia!",
    rotulo: "Entra no próximo lead",
    intent: "danger",
  },
  risco: { rosto: "😬", fala: "Eita… tá esfriando aqui", rotulo: "Em risco", intent: "warning" },
  livre: { rosto: "😎", fala: "Tô de boa, manda lead!", rotulo: "Livre", intent: "success" },
};

/** Ordem na tela: quem está em pior situação primeiro. */
const PESO: Record<EstadoGeladeira, number> = { geladeira: 0, vai_entrar: 1, risco: 2, livre: 3 };

function faltaPara(ate: string, agora: number) {
  const ms = Math.max(0, Date.parse(ate) - agora);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d ? `${d}d ${h}h` : `${h}h ${m}min`;
}

function GeladeiraPage() {
  const fn = useServerFn(getGeladeira);
  const q = useQuery({
    queryKey: ["geladeira"],
    queryFn: () => fn(),
    refetchInterval: 120_000,
  });
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const regra = q.data?.regra;
  const todos = q.data?.unidades.flatMap((u) => u.vendedores) ?? [];
  const conta = (e: EstadoGeladeira) => todos.filter((v) => v.estado === e).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4">
      <style>{CSS}</style>
      <DsPageHeader
        title={
          <span className="inline-flex items-center gap-2">
            Geladeira da roleta <Snowflake className="h-6 w-6 text-info" />
          </span>
        }
        subtitle={
          regra
            ? `Quem tem ${regra.abandonados} ou mais leads de tráfego pago parados em "Qualificação do Lead" sem interação há mais de ${regra.diasParado} dias vai para a geladeira: fica ${regra.diasFora} dias sem receber leads do quiz.`
            : "Penalidades da roleta de leads do quiz."
        }
        primary={
          <DsButton intent="neutral" emphasis="outline" onClick={() => q.refetch()}>
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </DsButton>
        }
      />

      {q.isLoading ? (
        <DsSkeletonList />
      ) : q.error ? (
        <p className="text-sm text-destructive">
          Não consegui ler o Ploomes agora: {(q.error as Error).message}
        </p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {(Object.keys(ESTADO) as EstadoGeladeira[]).map((e) => (
              <DsBadge key={e} intent={ESTADO[e].intent}>
                {ESTADO[e].rosto} {ESTADO[e].rotulo}: {conta(e)}
              </DsBadge>
            ))}
          </div>

          {q.data!.unidades.map((u) => (
            <section key={u.base} className="mb-10">
              <h2 className="mb-3 font-display text-lg font-semibold text-foreground">{u.nome}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[...u.vendedores]
                  .sort((a, b) => PESO[a.estado] - PESO[b.estado])
                  .map((v) => (
                    <CartaoVendedor key={v.id} v={v} limite={regra!.abandonados} agora={agora} />
                  ))}
              </div>
            </section>
          ))}

          <p className="text-xs text-muted-foreground">
            Dados do Ploomes lidos às{" "}
            {new Date(q.data!.lidoEm).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Interação = qualquer registro no negócio (ligação, mensagem, anotação). A penalidade é
            aplicada quando chega o próximo lead da unidade; "Entra no próximo lead" mostra quem já
            passou do limite.
          </p>
        </>
      )}
    </div>
  );
}

function CartaoVendedor({
  v,
  limite,
  agora,
}: {
  v: VendedorGeladeira;
  limite: number;
  agora: number;
}) {
  const e = ESTADO[v.estado];
  const nivel = Math.min(v.parados.length, limite);
  return (
    <DsCard className="flex flex-col gap-3 !p-4">
      <Geladeira estado={v.estado} rosto={e.rosto} fala={e.fala} />
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-base font-semibold text-foreground">{v.nome}</span>
        <DsBadge intent={e.intent} size="sm">
          {e.rotulo}
        </DsBadge>
      </div>
      {v.daVez && (
        <DsBadge intent="primary" size="sm" className="self-start">
          🎯 Próximo a receber lead
        </DsBadge>
      )}
      {v.estado === "geladeira" && v.ate && (
        <p className="text-sm text-info">
          Sai da geladeira em <b>{faltaPara(v.ate, agora)}</b> (
          {new Date(v.ate).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
          )
        </p>
      )}
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Leads parados</span>
          <span className="font-semibold text-foreground">
            {v.parados.length} / {limite}
          </span>
        </div>
        <div className="gel-termo">
          <div
            className={`gel-termo-fill gel-n${nivel}`}
            style={{ width: `${(nivel / limite) * 100}%` }}
          />
        </div>
      </div>
      {v.parados.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Ver leads parados</summary>
          <ul className="mt-2 space-y-1">
            {v.parados.map((p) => (
              <li key={p.dealId} className="flex justify-between gap-2">
                <span className="truncate text-foreground">{p.nome}</span>
                <span className="shrink-0 text-muted-foreground">{p.dias} dias</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </DsCard>
  );
}

/** A geladeira animada: cada estado tem a sua cena. */
function Geladeira({
  estado,
  rosto,
  fala,
}: {
  estado: EstadoGeladeira;
  rosto: string;
  fala: string;
}) {
  return (
    <div className={`gel-cena gel-${estado}`} aria-label={fala} role="img">
      <div className="gel-fala">{fala}</div>
      {estado === "geladeira" && (
        <div className="gel-neve" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} style={{ left: `${8 + i * 11}%`, animationDelay: `${i * 0.37}s` }}>
              ❄
            </span>
          ))}
        </div>
      )}
      <div className="gel-movel">
        <div className="gel-corpo">
          <div className="gel-freezer" />
          <div className="gel-dentro">
            {estado === "geladeira" && (
              <div className="gel-preso">
                <span className="gel-rosto">{rosto}</span>
                <span className="gel-gelo" />
              </div>
            )}
          </div>
          <div className="gel-porta">
            <span className="gel-puxador" />
            {estado === "geladeira" && <span className="gel-janela">{rosto}</span>}
          </div>
        </div>
      </div>
      {estado !== "geladeira" && (
        <div className="gel-boneco">
          <span className="gel-rosto">{rosto}</span>
          <span className="gel-corpinho" />
          {estado !== "livre" && (
            <span className="gel-suor" aria-hidden>
              💧
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const CSS = `
.gel-cena { position: relative; height: 190px; border-radius: var(--radius-lg); overflow: hidden;
  background: var(--surface-2); }
.gel-geladeira { background: color-mix(in oklch, var(--info) 14%, var(--surface-2)); }
.gel-fala { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); z-index: 5;
  background: var(--card); color: var(--foreground); border: 1px solid var(--border);
  font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap;
  animation: gel-flutua 2.4s ease-in-out infinite; }
.gel-movel { position: absolute; bottom: 10px; left: 50%; width: 78px; height: 132px; margin-left: -39px;
  perspective: 500px; }
.gel-risco .gel-movel, .gel-vai_entrar .gel-movel, .gel-livre .gel-movel { margin-left: -6px; }
.gel-corpo { position: absolute; inset: 0; border-radius: 12px; background: var(--card);
  border: 2px solid var(--border); box-shadow: var(--shadow-md); transform-style: preserve-3d; }
.gel-freezer { position: absolute; left: 0; right: 0; top: 36%; height: 2px; background: var(--border); z-index: 3; }
.gel-dentro { position: absolute; inset: 6px; border-radius: 8px;
  background: color-mix(in oklch, var(--info) 22%, var(--card)); overflow: hidden; }
.gel-porta { position: absolute; inset: -2px; border-radius: 12px; background: var(--card);
  border: 2px solid var(--border); transform-origin: right center; z-index: 4;
  transition: transform var(--dur-slow) var(--ease-out); }
.gel-puxador { position: absolute; left: 8px; top: 44%; width: 5px; height: 26px; border-radius: 3px;
  background: var(--muted-foreground); }
.gel-janela { position: absolute; left: 50%; margin-left: -18px; top: 46px; width: 44px; height: 44px; border-radius: 50%;
  display: grid; place-items: center; font-size: 26px;
  background: color-mix(in oklch, var(--info) 35%, var(--card)); border: 2px solid var(--info);
  box-shadow: inset 0 0 12px color-mix(in oklch, var(--info) 60%, transparent); }
.gel-rosto { font-size: 30px; line-height: 1; display: block; }
.gel-boneco { position: absolute; bottom: 12px; left: 50%; margin-left: -62px; width: 44px; z-index: 6;
  display: flex; flex-direction: column; align-items: center; }
.gel-corpinho { width: 22px; height: 30px; margin-top: -2px; border-radius: 10px 10px 6px 6px;
  background: var(--primary); }
.gel-suor { position: absolute; right: -2px; top: -4px; font-size: 13px; animation: gel-pinga 1.1s ease-in infinite; }
.gel-preso { position: absolute; inset: 0; display: grid; place-items: center; }
.gel-gelo { position: absolute; width: 46px; height: 46px; border-radius: 8px;
  background: color-mix(in oklch, var(--info) 30%, transparent); border: 1px solid var(--info); }

/* Na geladeira: porta fechada, tremendo, nevando */
.gel-geladeira .gel-movel { animation: gel-treme .18s linear infinite; }
.gel-neve span { position: absolute; top: -16px; color: var(--info); font-size: 14px;
  animation: gel-cai 2.8s linear infinite; }

/* Entra no próximo lead: porta escancarada sugando o vendedor */
.gel-vai_entrar .gel-porta { transform: rotateY(110deg); }
.gel-vai_entrar .gel-boneco { animation: gel-sugado 2.2s ease-in-out infinite; }

/* Em risco: porta rangendo, vendedor espiando */
.gel-risco .gel-porta { animation: gel-range 1.8s ease-in-out infinite; }
.gel-risco .gel-boneco { animation: gel-espia 2.6s ease-in-out infinite; }

/* Livre: dancinha */
.gel-livre .gel-boneco { animation: gel-danca .9s ease-in-out infinite; }

.gel-termo { height: 8px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.gel-termo-fill { height: 100%; border-radius: 999px; transition: width var(--dur-slow) var(--ease-out); }
.gel-n1 { background: var(--warning); } .gel-n2 { background: var(--warning); } .gel-n3 { background: var(--danger); }

@keyframes gel-flutua { 0%,100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -4px); } }
@keyframes gel-treme { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
@keyframes gel-cai { from { transform: translateY(0) rotate(0); opacity: 1; } to { transform: translateY(210px) rotate(220deg); opacity: .2; } }
@keyframes gel-sugado {
  0%, 100% { transform: translateX(0) rotate(0) scale(1); }
  45% { transform: translateX(46px) rotate(-18deg) scale(.82); }
  55% { transform: translateX(42px) rotate(14deg) scale(.86); }
  75% { transform: translateX(-6px) rotate(-6deg) scale(1.02); } }
@keyframes gel-range { 0%,100% { transform: rotateY(14deg); } 50% { transform: rotateY(42deg); } }
@keyframes gel-espia { 0%,100% { transform: translateX(0) rotate(0); } 30% { transform: translateX(10px) rotate(8deg); }
  60% { transform: translateX(-4px) rotate(-6deg); } }
@keyframes gel-danca { 0%,100% { transform: translateY(0) rotate(-8deg); } 50% { transform: translateY(-9px) rotate(8deg); } }
@keyframes gel-pinga { from { transform: translateY(0); opacity: 1; } to { transform: translateY(14px); opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .gel-cena *, .gel-cena { animation: none !important; }
}
`;
