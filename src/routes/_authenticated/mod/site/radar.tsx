import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ModuleShell } from "@/modules/shared/module-shell";
import { DsCard, DsCardHeader } from "@/components/ds/card";
import { DsBadge } from "@/components/ds/badge";
import { Button } from "@/components/ui/button";
import {
  radarApproveAllTopics,
  radarApproveTopic,
  radarIgnoreTopic,
  radarOverview,
  radarPublishAllPosts,
  radarPublishPost,
  radarSaveSettings,
  radarScanNow,
  radarSeedSources,
  radarToggleSource,
  radarWorkNow,
} from "@/modules/editorial/radar.functions";
import { Radar, RefreshCw, Play, Check, X, ExternalLink, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/site/radar")({
  head: () => ({
    meta: [
      { title: "Radar Editorial — Solar OS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const STATUS_TONE: Record<string, any> = {
  identificada: "neutral",
  coletando: "info",
  verificando: "info",
  gerando: "warning",
  revisao: "warning",
  publicado: "success",
  ignorado: "neutral",
  erro: "danger",
};

function Page() {
  const qc = useQueryClient();
  const overview = useServerFn(radarOverview);
  const scan = useServerFn(radarScanNow);
  const work = useServerFn(radarWorkNow);
  const approve = useServerFn(radarApproveTopic);
  const approveAll = useServerFn(radarApproveAllTopics);
  const ignore = useServerFn(radarIgnoreTopic);
  const publish = useServerFn(radarPublishPost);
  const publishAll = useServerFn(radarPublishAllPosts);
  const saveSettings = useServerFn(radarSaveSettings);
  const toggleSource = useServerFn(radarToggleSource);
  const seed = useServerFn(radarSeedSources);

  const [tab, setTab] = useState<"pautas" | "revisao" | "fontes" | "regras">("pautas");

  const q = useQuery({
    queryKey: ["radar_overview"],
    queryFn: () => overview() as any,
    refetchInterval: 60_000,
  });
  const d: any = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["radar_overview"] });

  const mScan = useMutation({
    mutationFn: () => scan({ data: {} }) as any,
    onSuccess: (r: any) =>
      toast.success(
        r?.paused
          ? "Descoberta pausada nas regras."
          : `${r.novos ?? 0} itens novos • ${r.relevantes ?? 0} pautas na fila`,
      ),
    onError: (e: any) => toast.error(String(e?.message ?? e)),
    onSettled: refresh,
  });
  const mWork = useMutation({
    mutationFn: () => work({ data: { max: 1 } }) as any,
    onSuccess: () => toast.success("Produção executada."),
    onError: (e: any) => toast.error(String(e?.message ?? e)),
    onSettled: refresh,
  });
  const mAction = useMutation({
    mutationFn: async (a: { kind: string; id: string; ativo?: boolean }) => {
      if (a.kind === "approve") return approve({ data: { topicId: a.id } });
      if (a.kind === "ignore") return ignore({ data: { topicId: a.id } });
      if (a.kind === "publish") return publish({ data: { postId: a.id } });
      if (a.kind === "source") return toggleSource({ data: { sourceId: a.id, ativo: !!a.ativo } });
      if (a.kind === "seed") return seed();
      return null;
    },
    onSuccess: () => toast.success("Feito."),
    onError: (e: any) => toast.error(String(e?.message ?? e)),
    onSettled: refresh,
  });
  const mApproveAll = useMutation({
    mutationFn: () => approveAll() as any,
    onSuccess: (r: any) => toast.success(`${r?.aprovadas ?? 0} pauta(s) aprovadas para produção.`),
    onError: (e: any) => toast.error(String(e?.message ?? e)),
    onSettled: refresh,
  });
  const mPublishAll = useMutation({
    mutationFn: () => publishAll() as any,
    onSuccess: (r: any) => toast.success(`${r?.publicados ?? 0} artigo(s) publicados.`),
    onError: (e: any) => toast.error(String(e?.message ?? e)),
    onSettled: refresh,
  });
  const mSettings = useMutation({
    mutationFn: (patch: Record<string, any>) => saveSettings({ data: patch }) as any,
    onSuccess: () => toast.success("Regras atualizadas."),
    onError: (e: any) => toast.error(String(e?.message ?? e)),
    onSettled: refresh,
  });

  const dg = d?.digest ?? {};
  const st = d?.settings ?? {};

  const stats = [
    { label: "Itens capturados hoje", value: dg.itens },
    { label: "Pautas detectadas", value: dg.pautas },
    { label: "Em produção", value: dg.emProducao },
    { label: "Publicados hoje", value: dg.publicados },
    { label: "Aguardando revisão", value: dg.revisao },
  ];

  return (
    <ModuleShell
      title="Radar Editorial"
      subtitle="A redação digital da LZ7: descobre pautas, apura e escreve"
      active="admin"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => mScan.mutate()} disabled={mScan.isPending} className="gap-2">
            <Radar className="h-4 w-4" />{" "}
            {mScan.isPending ? "Varrendo fontes..." : "Buscar pautas agora"}
          </Button>
          <Button
            variant="outline"
            onClick={() => mWork.mutate()}
            disabled={mWork.isPending}
            className="gap-2"
          >
            <Play className="h-4 w-4" />{" "}
            {mWork.isPending ? "Escrevendo..." : "Produzir próximo artigo"}
          </Button>
          <Button
            variant="outline"
            onClick={() => mApproveAll.mutate()}
            disabled={mApproveAll.isPending}
            className="gap-2"
          >
            <Check className="h-4 w-4" />{" "}
            {mApproveAll.isPending ? "Aprovando..." : "Aprovar todas as pautas"}
          </Button>
          <Button
            variant="outline"
            onClick={() => mPublishAll.mutate()}
            disabled={mPublishAll.isPending}
            className="gap-2"
          >
            <Check className="h-4 w-4" />{" "}
            {mPublishAll.isPending ? "Publicando..." : "Publicar todos os artigos"}
          </Button>
          <Button variant="ghost" onClick={refresh} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
            >
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-display text-2xl font-bold">
                {q.isLoading ? "—" : (s.value ?? 0)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card p-1">
          {(
            [
              ["pautas", "Pautas"],
              ["revisao", "Revisão"],
              ["fontes", "Fontes"],
              ["regras", "Regras"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === k
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "pautas" ? (
          <DsCard className="p-0">
            <div className="p-4">
              <DsCardHeader
                title="Pautas detectadas"
                subtitle="Ordenadas por relevância para o público da LZ7"
              />
            </div>
            <div className="divide-y divide-border/60">
              {(d?.topics ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Nenhuma pauta ainda. Cadastre as fontes na aba “Fontes” e clique em “Buscar pautas
                  agora”.
                </p>
              ) : null}
              {(d?.topics ?? []).map((t: any) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {t.breaking_news ? <DsBadge intent="danger">Urgente</DsBadge> : null}
                      <span className="truncate">{t.assunto}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <DsBadge intent={STATUS_TONE[t.status] ?? "neutral"} size="sm">
                        {t.status}
                      </DsBadge>
                      <span>{t.categoria}</span>
                      <span>• relevância {t.lz7_score}</span>
                      <span>• confiança {t.confidence_score}</span>
                      <span>• {t.quantidade_fontes} fonte(s)</span>
                    </p>
                    {t.motivo_bloqueio ? (
                      <p className="mt-1 flex items-start gap-1 text-xs text-amber-600">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {t.motivo_bloqueio}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {t.status === "identificada" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => mAction.mutate({ kind: "approve", id: t.id })}
                          className="gap-1"
                        >
                          <Check className="h-3.5 w-3.5" /> Produzir
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => mAction.mutate({ kind: "ignore", id: t.id })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </DsCard>
        ) : null}

        {tab === "revisao" ? (
          <DsCard className="p-0">
            <div className="p-4">
              <DsCardHeader
                title="Artigos aguardando revisão"
                subtitle="Leia, ajuste no CMS e publique"
              />
            </div>
            <div className="divide-y divide-border/60">
              {(d?.revisao ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nada pendente de revisão.</p>
              ) : null}
              {(d?.revisao ?? []).map((p: any) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      qualidade {p.quality_score ?? "—"} • {(p.sources ?? []).length} fonte(s)
                      citadas
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a
                      href={`/blog/${p.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Ler <ExternalLink className="h-3 w-3" />
                    </a>
                    <Button size="sm" onClick={() => mAction.mutate({ kind: "publish", id: p.id })}>
                      Publicar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DsCard>
        ) : null}

        {tab === "fontes" ? (
          <DsCard className="p-0">
            <div className="p-4">
              <DsCardHeader
                title="Fontes monitoradas"
                subtitle="Órgãos oficiais, entidades e imprensa especializada"
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mAction.mutate({ kind: "seed", id: "" })}
                  >
                    Carregar fontes padrão
                  </Button>
                }
              />
            </div>
            <div className="divide-y divide-border/60">
              {(d?.sources ?? []).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {s.nome}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({s.tipo} • autoridade {s.autoridade})
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.dominio} • verificada{" "}
                      {s.ultima_verificacao
                        ? new Date(s.ultima_verificacao).toLocaleString("pt-BR")
                        : "nunca"}
                      {s.ultimo_erro ? ` • erro: ${s.ultimo_erro}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={s.ativo ? "outline" : "default"}
                    onClick={() => mAction.mutate({ kind: "source", id: s.id, ativo: !s.ativo })}
                  >
                    {s.ativo ? "Pausar" : "Ativar"}
                  </Button>
                </div>
              ))}
              {(d?.sources ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Nenhuma fonte cadastrada. Clique em “Carregar fontes padrão”.
                </p>
              ) : null}
            </div>
          </DsCard>
        ) : null}

        {tab === "regras" ? (
          <DsCard>
            <DsCardHeader
              title="Regras da redação"
              subtitle="Controle o que o motor pode publicar sozinho"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Modo de publicação</span>
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={st.modo_publicacao ?? "semiautomatica"}
                  onChange={(e) => mSettings.mutate({ modo_publicacao: e.target.value })}
                >
                  <option value="manual">Manual (só rascunho)</option>
                  <option value="semiautomatica">Semiautomática (revisão antes de publicar)</option>
                  <option value="automatica">Automática (publica se passar no controle)</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Máximo de artigos por dia</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={st.max_artigos_dia ?? 4}
                  onBlur={(e) => mSettings.mutate({ max_artigos_dia: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">
                  Confiança mínima para publicar (0-100)
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={st.min_confidence ?? 90}
                  onBlur={(e) => mSettings.mutate({ min_confidence: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Relevância mínima da pauta (0-100)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={st.min_relevancia ?? 75}
                  onBlur={(e) => mSettings.mutate({ min_relevancia: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!st.pausar_descoberta}
                  onChange={(e) => mSettings.mutate({ pausar_descoberta: e.target.checked })}
                />
                Pausar descoberta de pautas
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!st.pausar_publicacao}
                  onChange={(e) => mSettings.mutate({ pausar_publicacao: e.target.checked })}
                />
                Pausar publicação automática
              </label>
            </div>
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Últimas execuções
              </p>
              <div className="space-y-1 text-xs text-muted-foreground">
                {(d?.runs ?? []).map((r: any, i: number) => (
                  <p key={i}>
                    {new Date(r.created_at).toLocaleString("pt-BR")} — {r.tipo}:{" "}
                    {r.itens_encontrados} itens, {r.pautas_novas} novos, {r.pautas_relevantes} na
                    fila, {r.erros} erro(s) em {Math.round((r.duracao_ms ?? 0) / 1000)}s
                  </p>
                ))}
              </div>
            </div>
          </DsCard>
        ) : null}
      </div>
    </ModuleShell>
  );
}
