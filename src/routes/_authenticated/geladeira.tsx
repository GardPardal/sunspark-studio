import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { RefreshCw, Snowflake, Volume2, VolumeX } from "lucide-react";
import { DsBadge, DsButton, DsCard, DsPageHeader, DsSkeletonList } from "@/components/ds";
import type { Intent } from "@/components/ds";
import {
  getGeladeira,
  type EstadoGeladeira,
  type VendedorGeladeira,
} from "@/lib/geladeira.functions";
import { CENA, CSS_GELADEIRA, CenaGeladeira } from "@/components/geladeira/cena-geladeira";
import { ligarSons } from "@/components/geladeira/sons";

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

const ESTADO: Record<EstadoGeladeira, { rotulo: string; intent: Intent }> = {
  geladeira: { rotulo: "Na geladeira", intent: "info" },
  vai_entrar: { rotulo: "Entra no próximo lead", intent: "danger" },
  risco: { rotulo: "Em risco", intent: "warning" },
  livre: { rotulo: "Livre", intent: "success" },
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
  const [som, setSom] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const regra = q.data?.regra;
  const todos = q.data?.unidades.flatMap((u) => u.vendedores) ?? [];
  const conta = (e: EstadoGeladeira) => todos.filter((v) => v.estado === e).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4">
      <style>{CSS_GELADEIRA}</style>
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
          <DsButton
            intent={som ? "primary" : "neutral"}
            emphasis={som ? "solid" : "outline"}
            onClick={() => {
              void ligarSons(!som);
              setSom(!som);
            }}
          >
            {som ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {som ? "Som ligado" : "Ligar som"}
          </DsButton>
        }
        secondary={
          <DsButton intent="neutral" emphasis="ghost" onClick={() => q.refetch()}>
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
                {CENA[e].rosto} {ESTADO[e].rotulo}: {conta(e)}
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
            Passe o mouse e clique nas geladeiras. Dados do Ploomes lidos às{" "}
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
      <CenaGeladeira v={v} />
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
