import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Download,
  Printer,
  RefreshCw,
  FileText,
  MessageCircle,
  ExternalLink,
  User,
  MapPin,
  GitBranch,
  Database,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DsBadge,
  DsButton,
  DsCard,
  DsEmpty,
  DsPageHeader,
  DsSkeletonList,
  DsStat,
  type Intent,
} from "@/components/ds";
import {
  gerarRelatorioAgora,
  getAlertasParados,
  getFichaLead,
  getRelatorio,
  listarQuiz,
  listarRelatorios,
  type AlertaLead,
  type ItemLinha,
  type LinhaQuiz,
  type ResultadoAlertas,
  type Relatorio,
} from "@/lib/auditoria-quiz.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria do quiz · LZ7 Energia" },
      {
        name: "description",
        content:
          "Todos os leads captados pelo quiz do site (tráfego interno), com responsável, regional, interações e relatório diário das 15h.",
      },
      { property: "og:title", content: "Auditoria do quiz · LZ7 Energia" },
      {
        property: "og:description",
        content: "Auditoria completa dos leads do tráfego interno (quiz) da LZ7 Energia.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuditoriaQuizPage,
});

/* ---------------- utilidades ---------------- */

const fmtData = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const fmtDia = (s: string) =>
  new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const brl = (v: unknown) =>
  typeof v === "number"
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : "—";

/** Início do dia em Brasília (UTC-3), `dias` atrás. */
function inicioDia(dias = 0) {
  const brt = new Date(Date.now() - 3 * 3600_000 - dias * 86400_000);
  return new Date(`${brt.toISOString().slice(0, 10)}T03:00:00.000Z`);
}
function periodoDe(p: string, de: string, ate: string) {
  const fim = new Date(Date.now() + 60_000).toISOString();
  if (p === "hoje") return { de: inicioDia(0).toISOString(), ate: fim };
  if (p === "7d") return { de: inicioDia(6).toISOString(), ate: fim };
  if (p === "30d") return { de: inicioDia(29).toISOString(), ate: fim };
  if (p === "mes") {
    const brt = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7);
    return { de: new Date(`${brt}-01T03:00:00.000Z`).toISOString(), ate: fim };
  }
  const d = de ? new Date(`${de}T03:00:00.000Z`) : inicioDia(29);
  const a = ate ? new Date(new Date(`${ate}T03:00:00.000Z`).getTime() + 86400_000) : new Date(fim);
  return { de: d.toISOString(), ate: a.toISOString() };
}

function intentSync(s: string): Intent {
  if (s === "No Ploomes") return "success";
  if (s === "Erro no envio") return "danger";
  if (s === "Revisão manual") return "warning";
  return "neutral";
}

function baixarCsv(nome: string, linhas: LinhaQuiz[]) {
  const cab = [
    "Data",
    "Nome",
    "Telefone",
    "Cidade",
    "UF",
    "Unidade",
    "Responsável",
    "Etapa no Ploomes",
    "Etapa no CRM",
    "Sincronização",
    "Negócio Ploomes",
    "Valor da conta",
    "Campanha",
  ];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const corpo = linhas.map((l) =>
    [
      fmtData(l.criadoEm),
      l.nome,
      l.telefone,
      l.cidade,
      l.estado,
      l.unidade,
      l.responsavel,
      l.etapaPloomes,
      l.etapa,
      l.sincronizacao,
      l.ploomesDealId,
      l.valorConta,
      l.campanha,
    ]
      .map(esc)
      .join(";"),
  );
  const blob = new Blob(["﻿" + [cab.map(esc).join(";"), ...corpo].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const selectCls =
  "h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

/* ---------------- página ---------------- */

function AuditoriaQuizPage() {
  const [aberto, setAberto] = useState<string | null>(null);
  const [dias, setDias] = useState(2);
  const alertasFn = useServerFn(getAlertasParados);
  const alertas = useQuery({
    queryKey: ["auditoria-parados", dias],
    queryFn: () => alertasFn({ data: { dias } }),
    staleTime: 5 * 60_000,
  });
  const qtdAlertas = alertas.data?.alertas.length ?? 0;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-24 pt-4">
      <DsPageHeader
        title="Auditoria do quiz"
        subtitle="Cada lead que entrou pelo quiz do site (tráfego interno): quem atende, de qual regional, em que etapa está e tudo o que aconteceu com ele."
      />
      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Leads do quiz</TabsTrigger>
          <TabsTrigger value="parados" className="gap-1.5">
            Leads parados
            {qtdAlertas > 0 && (
              <DsBadge size="sm" intent="danger">
                {qtdAlertas}
              </DsBadge>
            )}
          </TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios diários (15h)</TabsTrigger>
        </TabsList>
        <TabsContent value="leads" className="mt-4">
          <ListaLeads onAbrir={setAberto} />
        </TabsContent>
        <TabsContent value="parados" className="mt-4">
          <LeadsParados
            dias={dias}
            onDias={setDias}
            carregando={alertas.isLoading || alertas.isFetching}
            erro={alertas.error ? (alertas.error as Error).message : null}
            r={alertas.data}
            onAtualizar={() =>
              alertasFn({ data: { dias, forcar: true } }).then(() => alertas.refetch())
            }
            onAbrir={setAberto}
          />
        </TabsContent>
        <TabsContent value="relatorios" className="mt-4">
          <Relatorios onAbrir={setAberto} />
        </TabsContent>
      </Tabs>
      <FichaSheet id={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}

/* ---------------- lista ---------------- */

function ListaLeads({ onAbrir }: { onAbrir: (id: string) => void }) {
  const listar = useServerFn(listarQuiz);
  const [periodo, setPeriodo] = useState("7d");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [resp, setResp] = useState("");
  const [unid, setUnid] = useState("");
  const [sinc, setSinc] = useState("");
  const [busca, setBusca] = useState("");
  const intervalo = useMemo(() => periodoDe(periodo, de, ate), [periodo, de, ate]);

  const q = useQuery({
    queryKey: ["auditoria-quiz", intervalo.de.slice(0, 13), intervalo.ate.slice(0, 13)],
    queryFn: () => listar({ data: intervalo }),
    staleTime: 60_000,
  });
  const todos = useMemo(() => q.data ?? [], [q.data]);
  const opcoes = (k: (l: LinhaQuiz) => string) =>
    Array.from(new Set(todos.map(k))).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const linhas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const dig = t.replace(/\D/g, "");
    return todos.filter(
      (l) =>
        (!resp || l.responsavel === resp) &&
        (!unid || l.unidade === unid) &&
        (!sinc || l.sincronizacao === sinc) &&
        (!t ||
          l.nome.toLowerCase().includes(t) ||
          (l.cidade ?? "").toLowerCase().includes(t) ||
          (dig.length >= 4 && (l.telefone ?? "").replace(/\D/g, "").includes(dig))),
    );
  }, [todos, resp, unid, sinc, busca]);

  const unicos = linhas.filter((l) => !l.duplicado);
  const porUnidade = opcoes((l) => l.unidade).map((u) => ({
    u,
    n: unicos.filter((l) => l.unidade === u).length,
  }));

  return (
    <div className="space-y-4">
      <DsCard className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Campo rotulo="Período">
            <select
              className={selectCls}
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
            >
              <option value="hoje">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="mes">Este mês</option>
              <option value="custom">Escolher datas</option>
            </select>
          </Campo>
          {periodo === "custom" && (
            <>
              <Campo rotulo="De">
                <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
              </Campo>
              <Campo rotulo="Até">
                <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
              </Campo>
            </>
          )}
          <Campo rotulo="Responsável">
            <select className={selectCls} value={resp} onChange={(e) => setResp(e.target.value)}>
              <option value="">Todos</option>
              {opcoes((l) => l.responsavel).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Regional">
            <select className={selectCls} value={unid} onChange={(e) => setUnid(e.target.value)}>
              <option value="">Todas</option>
              {opcoes((l) => l.unidade).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Ploomes">
            <select className={selectCls} value={sinc} onChange={(e) => setSinc(e.target.value)}>
              <option value="">Todos</option>
              {opcoes((l) => l.sincronizacao).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Buscar" className="min-w-[220px] flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Nome, cidade ou telefone"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </Campo>
          <DsButton
            emphasis="outline"
            leadingIcon={<Download className="h-4 w-4" />}
            disabled={!linhas.length}
            onClick={() => baixarCsv(`leads-quiz-${intervalo.de.slice(0, 10)}.csv`, linhas)}
          >
            CSV
          </DsButton>
        </div>
      </DsCard>

      {q.isLoading ? (
        <DsSkeletonList rows={6} />
      ) : q.error ? (
        <DsEmpty
          title="Não foi possível carregar"
          description={(q.error as Error).message}
          actionLabel="Tentar de novo"
          onAction={() => q.refetch()}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <DsStat label="Leads do quiz" value={unicos.length} hint="sem contar duplicados" />
            <DsStat
              label="Sem responsável"
              value={unicos.filter((l) => l.responsavel === "Sem responsável").length}
            />
            <DsStat
              label="Fora do Ploomes"
              value={unicos.filter((l) => l.sincronizacao !== "No Ploomes").length}
              hint="não enviados, com erro ou em revisão"
            />
            <DsStat
              label="Por regional"
              value={
                <span className="text-base font-semibold">
                  {porUnidade.map((p) => `${p.u.split(" ")[0]} ${p.n}`).join(" · ") || "—"}
                </span>
              }
            />
          </div>

          {!linhas.length ? (
            <DsEmpty
              title="Nenhum lead do quiz no período"
              description="Troque o período ou os filtros."
            />
          ) : (
            <DsCard className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Entrada</th>
                      <th className="px-4 py-3">Lead</th>
                      <th className="px-4 py-3">Regional</th>
                      <th className="px-4 py-3">Responsável</th>
                      <th className="px-4 py-3">Etapa</th>
                      <th className="px-4 py-3">Ploomes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => (
                      <tr
                        key={l.id}
                        tabIndex={0}
                        onClick={() => onAbrir(l.id)}
                        onKeyDown={(e) => e.key === "Enter" && onAbrir(l.id)}
                        className="cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {fmtData(l.criadoEm)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {l.nome}
                            {l.duplicado && (
                              <DsBadge size="sm" className="ml-2">
                                duplicado
                              </DsBadge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {[l.cidade, l.estado].filter(Boolean).join(" / ") ||
                              "cidade não informada"}
                            {l.valorConta ? ` · conta ${l.valorConta}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3">{l.unidade}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(l.responsavel === "Sem responsável" && "text-danger")}
                          >
                            {l.responsavel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {l.etapaPloomes ?? l.etapa ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <DsBadge size="sm" intent={intentSync(l.sincronizacao)} dot>
                            {l.sincronizacao}
                          </DsBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DsCard>
          )}
        </>
      )}
    </div>
  );
}

function Campo({
  rotulo,
  children,
  className,
}: {
  rotulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </span>
      {children}
    </label>
  );
}

/* ---------------- ficha completa ---------------- */

function FichaSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const ficha = useServerFn(getFichaLead);
  const q = useQuery({
    queryKey: ["auditoria-ficha", id],
    queryFn: () => ficha({ data: { id: id! } }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
  const f = q.data;
  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">
            {f?.lead?.nome ?? (q.isLoading ? "Carregando…" : "Lead")}
          </SheetTitle>
          <SheetDescription>
            {f
              ? `Entrou em ${fmtData(f.lead.created_at)} · ${f.lead.origem ?? "origem não informada"}`
              : "Ficha completa do lead"}
          </SheetDescription>
        </SheetHeader>
        {q.isLoading && <DsSkeletonList rows={8} />}
        {q.error && <p className="mt-4 text-sm text-danger">{(q.error as Error).message}</p>}
        {f && <Ficha f={f} />}
      </SheetContent>
    </Sheet>
  );
}

function Bloco({
  titulo,
  icone,
  children,
}: {
  titulo: string;
  icone?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
        {icone}
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Pares({ itens }: { itens: [string, ReactNode][] }) {
  const vis = itens.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== "—");
  if (!vis.length) return <p className="text-sm text-muted-foreground">Nada registrado.</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-border/60 p-3 text-sm sm:grid-cols-2">
      {vis.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
          <dd className="break-words text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const ORIGEM_INTENT: Record<ItemLinha["origem"], Intent> = {
  "Solar OS": "primary",
  Ploomes: "info",
  WhatsApp: "success",
};

function valorCampo(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Ficha({ f }: { f: any }) {
  const l = f.lead;
  const p = f.ploomes;
  const [verTudo, setVerTudo] = useState(false);
  const linha: ItemLinha[] = f.linhaDoTempo ?? [];
  const conversa: any[] = f.conversa ?? [];
  const msgs = verTudo ? conversa : conversa.slice(-60);

  return (
    <div className="pb-10">
      {/* resumo */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Resumo
          icone={<User className="h-4 w-4" />}
          rotulo="Responsável"
          valor={f.resumo.responsavel}
        />
        <Resumo icone={<MapPin className="h-4 w-4" />} rotulo="Regional" valor={f.resumo.unidade} />
        <Resumo
          icone={<GitBranch className="h-4 w-4" />}
          rotulo="Etapa"
          valor={p?.negocio?.etapa ?? f.resumo.etapaPloomes ?? l.stage ?? "—"}
        />
        <Resumo
          icone={<MessageCircle className="h-4 w-4" />}
          rotulo="Interações"
          valor={`${linha.length} registros · ${f.contagens.mensagens} msgs`}
        />
      </div>

      <Bloco titulo="Contato">
        <Pares
          itens={[
            ["Nome", l.nome],
            ["Telefone", l.telefone],
            ["E-mail", l.email],
            ["Cidade", [l.cidade, l.estado].filter(Boolean).join(" / ")],
            ["Endereço", [l.endereco, l.bairro, l.cep].filter(Boolean).join(" · ")],
            ["Tipo", l.tipo_pessoa ?? l.tipo_cliente],
            ["Documento", l.cpf_cnpj ?? l.documento],
            ["Valor da conta", l.valor_conta],
            ["Consumo", l.consumo_kwh ? `${l.consumo_kwh} kWh` : null],
          ]}
        />
      </Bloco>

      <Bloco titulo="Respostas do quiz" icone={<FileText className="h-4 w-4" />}>
        {f.quiz.length ? (
          <Pares itens={f.quiz.map((r: any) => [r.pergunta, r.resposta])} />
        ) : f.quizData ? (
          <Pares
            itens={Object.entries(f.quizData as Record<string, unknown>).map(([k, v]) => [
              k,
              valorCampo(v),
            ])}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {l.mensagem ? l.mensagem : "Sem respostas registradas."}
          </p>
        )}
      </Bloco>

      <Bloco titulo="Atendimento no Solar OS">
        <Pares
          itens={[
            ["Responsável", f.resumo.responsavel],
            ["Dono no Ploomes", f.resumo.responsavelPloomes],
            ["Regional", f.resumo.unidade],
            ["Etapa no CRM", l.stage],
            ["Etapa atualizada em", l.stage_updated_at ? fmtData(l.stage_updated_at) : null],
            ["Qualificação", l.qualificacao_status],
            ["Qualidade do lead", l.lead_quality],
            ["Prioridade", l.prioridade],
            ["Motivo de perda", l.motivo_perda ?? l.lost_reason],
            ["Duplicado de", l.duplicado_de],
            [
              "Registros",
              `${f.contagens.eventos} eventos · ${f.contagens.tarefas} tarefas · ${f.contagens.agenda} agendamentos · ${f.contagens.transferencias} transferências`,
            ],
          ]}
        />
      </Bloco>

      <Bloco titulo="Origem e campanha">
        <Pares
          itens={[
            ["Origem", l.origem],
            ["Origem principal", l.origem_principal],
            ["Captação", l.captacao_metodo],
            ["Canal", l.canal],
            ["UTM source", l.utm_source],
            ["UTM medium", l.utm_medium],
            ["UTM campaign", l.utm_campaign],
            ["UTM content", l.utm_content],
            ["UTM term", l.utm_term],
            ["Campanha", l.campanha],
            ["Anúncio", l.ad_name ?? l.anuncio],
            ["fbclid", l.fbclid],
            ["gclid", l.gclid],
            ["Página", l.page_url ?? l.landing_page],
            ["Referência", l.referrer],
            ["Dispositivo", l.user_agent],
          ]}
        />
      </Bloco>

      <Bloco titulo="Ploomes (somente leitura)" icone={<Database className="h-4 w-4" />}>
        {!p ? (
          <p className="text-sm text-muted-foreground">
            Este lead ainda não tem negócio nem contato no Ploomes.
            {l.ploomes_sync_error ? ` Último erro: ${l.ploomes_sync_error}` : ""}
          </p>
        ) : !p.disponivel ? (
          <p className="text-sm text-muted-foreground">
            Não foi possível ler o Ploomes agora (negócio {l.ploomes_deal_id ?? "—"}).
          </p>
        ) : (
          <div className="space-y-3">
            {p.negocio && (
              <Pares
                itens={[
                  ["Negócio", `#${p.negocio.id} · ${p.negocio.titulo}`],
                  ["Funil", p.negocio.funil],
                  ["Etapa", p.negocio.etapa],
                  ["Status", p.negocio.status],
                  ["Responsável", p.negocio.responsavel],
                  ["Criado por", p.negocio.criadoPor],
                  ["Valor", p.negocio.valor ? brl(p.negocio.valor) : null],
                  ["Criado em", fmtData(p.negocio.criadoEm)],
                  ["Atualizado em", fmtData(p.negocio.atualizadoEm)],
                  ["Fechado em", p.negocio.fechadoEm ? fmtData(p.negocio.fechadoEm) : null],
                  ["Etiquetas", (p.negocio.etiquetas ?? []).join(", ")],
                ]}
              />
            )}
            {p.negocio?.campos?.length > 0 && (
              <details className="rounded-xl border border-border/60 p-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  Campos do negócio ({p.negocio.campos.length})
                </summary>
                <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {p.negocio.campos.map((c: any) => (
                    <div key={c.id ?? c.campo}>
                      <dt className="text-[11px] text-muted-foreground">{c.campo ?? c.id}</dt>
                      <dd className="break-words">{valorCampo(c.valor)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            {p.contato && (
              <Pares
                itens={[
                  ["Contato", `#${p.contato.id} · ${p.contato.nome}`],
                  ["Telefones", (p.contato.telefones ?? []).join(", ")],
                  ["E-mail", p.contato.email],
                  ["Cidade", p.contato.cidade],
                  ["Dono do contato", p.contato.responsavel],
                  ["Criado por", p.contato.criadoPor],
                  ["Criado em", fmtData(p.contato.criadoEm)],
                  ["Observação", p.contato.observacao],
                ]}
              />
            )}
            {p.negocios?.length > 1 && (
              <div className="rounded-xl border border-border/60 p-3 text-sm">
                <p className="mb-2 font-medium">Todos os negócios deste contato</p>
                <ul className="space-y-1">
                  {p.negocios.map((d: any) => (
                    <li key={d.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                      <span className="text-foreground">#{d.id}</span>
                      <span>{d.funil}</span>·<span>{d.etapa}</span>·<span>{d.status}</span>·
                      <span>{d.responsavel}</span>·<span>{fmtDia(d.criadoEm)}</span>
                      {d.valor ? <span>· {brl(d.valor)}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {p.propostas?.length > 0 && (
              <div className="rounded-xl border border-border/60 p-3 text-sm">
                <p className="mb-2 font-medium">Propostas</p>
                <ul className="space-y-1 text-muted-foreground">
                  {p.propostas.map((q: any, i: number) => (
                    <li key={i}>
                      Nº {q.numero}
                      {q.revisao ? ` rev. ${q.revisao}` : ""} · {brl(q.valor)} · {fmtDia(q.data)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(!p.leituraInteracoes || !p.leituraTarefas) && (
              <p className="text-xs text-muted-foreground">
                Algumas interações/tarefas do Ploomes não puderam ser lidas agora.
              </p>
            )}
          </div>
        )}
      </Bloco>

      <Bloco titulo={`Linha do tempo (${linha.length})`}>
        {!linha.length ? (
          <p className="text-sm text-muted-foreground">Sem registros.</p>
        ) : (
          <ol className="relative space-y-3 border-l border-border pl-4">
            {linha.map((it, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{fmtData(it.quando)}</span>
                  <DsBadge size="sm" intent={ORIGEM_INTENT[it.origem]}>
                    {it.origem}
                  </DsBadge>
                  <span>{it.tipo}</span>
                  {it.quem && <span>· {it.quem}</span>}
                </div>
                <p className="text-sm font-medium text-foreground">{it.titulo}</p>
                {it.detalhe && (
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{it.detalhe}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Bloco>

      <Bloco
        titulo={`Conversa no WhatsApp (${conversa.length})`}
        icone={<MessageCircle className="h-4 w-4" />}
      >
        {f.conversas?.length > 0 && (
          <p className="mb-2 text-xs text-muted-foreground">
            {f.conversas
              .map(
                (c: any) =>
                  `Status ${c.status}${c.handoff_at ? ` · passada ao humano em ${fmtData(c.handoff_at)}` : ""}${c.summary ? ` · resumo: ${c.summary}` : ""}`,
              )
              .join(" | ")}
          </p>
        )}
        {!conversa.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma mensagem registrada.</p>
        ) : (
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            {conversa.length > msgs.length && (
              <button
                className="text-xs font-medium text-primary underline"
                onClick={() => setVerTudo(true)}
              >
                Ver as {conversa.length - msgs.length} mensagens anteriores
              </button>
            )}
            {msgs.map((m: any, i: number) => {
              const entrada = m.direction === "inbound" || m.direction === "in";
              return (
                <div
                  key={m.id ?? i}
                  className={cn("flex", entrada ? "justify-start" : "justify-end")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      entrada ? "bg-card text-foreground" : "bg-primary/10 text-foreground",
                    )}
                  >
                    {m.body ? (
                      <p className="whitespace-pre-line break-words">{m.body}</p>
                    ) : (
                      <p className="italic text-muted-foreground">[{m.msg_type ?? "mídia"}]</p>
                    )}
                    {m.media_url && (
                      <a
                        href={m.media_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary underline"
                      >
                        {m.media_filename ?? "abrir mídia"} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {fmtData(m.occurred_at)}
                      {m.ai_generated ? " · IA" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Bloco>

      {f.filaPloomes?.length > 0 && (
        <Bloco titulo="Envios ao Ploomes (fila)">
          <ul className="space-y-1 text-sm text-muted-foreground">
            {f.filaPloomes.map((s: any) => (
              <li key={s.id}>
                {fmtData(s.created_at)} · {s.action} · {s.status} · {s.attempts} tentativa(s)
                {s.last_error ? ` · erro: ${s.last_error}` : ""}
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {f.duplicados?.length > 0 && (
        <Bloco titulo="Cadastros duplicados deste lead">
          <ul className="space-y-1 text-sm text-muted-foreground">
            {f.duplicados.map((d: any) => (
              <li key={d.id}>
                {fmtData(d.created_at)} · {d.nome} · {d.telefone} · {d.origem}
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      <Bloco titulo="Todos os campos do cadastro">
        <details className="rounded-xl border border-border/60 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Abrir ficha bruta</summary>
          <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(l)
              .filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length))
              .map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[11px] text-muted-foreground">{k}</dt>
                  <dd className="whitespace-pre-line break-words">{valorCampo(v)}</dd>
                </div>
              ))}
          </dl>
        </details>
      </Bloco>
    </div>
  );
}

function Resumo({ icone, rotulo, valor }: { icone: ReactNode; rotulo: string; valor: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icone}
        {rotulo}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{valor}</p>
    </div>
  );
}

/* ---------------- relatórios diários ---------------- */

function Relatorios({ onAbrir }: { onAbrir: (id: string) => void }) {
  const listar = useServerFn(listarRelatorios);
  const ler = useServerFn(getRelatorio);
  const gerar = useServerFn(gerarRelatorioAgora);
  const qc = useQueryClient();
  const [sel, setSel] = useState<string | null>(null);

  const lista = useQuery({
    queryKey: ["relatorios-quiz"],
    queryFn: () => listar(),
    staleTime: 60_000,
  });
  const atual = sel ?? lista.data?.[0]?.id ?? null;
  const rel = useQuery({
    queryKey: ["relatorio-quiz", atual],
    queryFn: () => ler({ data: { id: atual! } }),
    enabled: Boolean(atual),
    staleTime: Infinity,
  });
  const gerarAgora = useMutation({
    mutationFn: () => gerar(),
    onSuccess: (r) => {
      setSel(r.id);
      qc.invalidateQueries({ queryKey: ["relatorios-quiz"] });
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <DsCard className="h-fit p-3 print:hidden">
        <DsButton
          fullWidth
          intent="primary"
          leadingIcon={<RefreshCw className="h-4 w-4" />}
          loading={gerarAgora.isPending}
          onClick={() => gerarAgora.mutate()}
        >
          Gerar agora
        </DsButton>
        {gerarAgora.error && (
          <p className="mt-2 text-xs text-danger">{(gerarAgora.error as Error).message}</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Todo dia às 15h o sistema gera sozinho o relatório das últimas 24 horas (15h → 15h).
        </p>
        <ul className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto">
          {lista.isLoading && <DsSkeletonList rows={4} />}
          {lista.error && <li className="text-xs text-danger">{(lista.error as Error).message}</li>}
          {(lista.data ?? []).map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSel(r.id)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  atual === r.id && "bg-muted font-semibold",
                )}
              >
                {fmtDia(r.periodo_ate)} · {r.total} lead{r.total === 1 ? "" : "s"}
                <span className="block text-[11px] font-normal text-muted-foreground">
                  {r.origem === "manual" ? "gerado manualmente" : "automático"} às{" "}
                  {fmtData(r.gerado_em).slice(-5)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DsCard>

      <div>
        {!atual ? (
          <DsEmpty
            title="Nenhum relatório ainda"
            description="O primeiro sai hoje às 15h. Se quiser ver agora, gere manualmente."
            actionLabel="Gerar agora"
            onAction={() => gerarAgora.mutate()}
          />
        ) : rel.isLoading ? (
          <DsSkeletonList rows={6} />
        ) : rel.error ? (
          <DsEmpty
            title="Não foi possível abrir o relatório"
            description={(rel.error as Error).message}
          />
        ) : rel.data ? (
          <RelatorioView r={rel.data} onAbrir={onAbrir} />
        ) : null}
      </div>
    </div>
  );
}

function Contagem({ titulo, itens }: { titulo: string; itens: { chave: string; qtd: number }[] }) {
  return (
    <DsCard className="p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      {!itens.length ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {itens.map((i) => (
            <li key={i.chave} className="flex justify-between gap-3">
              <span className="truncate">{i.chave}</span>
              <span className="font-semibold tabular-nums">{i.qtd}</span>
            </li>
          ))}
        </ul>
      )}
    </DsCard>
  );
}

function RelatorioView({
  r,
  onAbrir,
}: {
  r: Relatorio & { geradoEm: string };
  onAbrir: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">
            Relatório do quiz · {fmtDia(r.periodo.ate)}
          </h2>
          <p className="text-sm text-muted-foreground">
            De {fmtData(r.periodo.de)} até {fmtData(r.periodo.ate)} · gerado em{" "}
            {fmtData(r.geradoEm)}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <DsButton
            emphasis="outline"
            size="sm"
            leadingIcon={<Download className="h-4 w-4" />}
            onClick={() => baixarCsv(`relatorio-quiz-${r.periodo.ate.slice(0, 10)}.csv`, r.linhas)}
          >
            CSV
          </DsButton>
          <DsButton
            emphasis="outline"
            size="sm"
            leadingIcon={<Printer className="h-4 w-4" />}
            onClick={() => window.print()}
          >
            Imprimir / PDF
          </DsButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DsStat label="Leads nas 24h" value={r.total} />
        <DsStat label="Acumulado do mês" value={r.totalMes} />
        <DsStat label="Sem responsável" value={r.semResponsavel} />
        <DsStat label="Fora do Ploomes" value={r.foraDoPloomes} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Contagem titulo="Por responsável (24h)" itens={r.porResponsavel} />
        <Contagem titulo="Por regional" itens={r.porUnidade} />
        <Contagem titulo="Por etapa" itens={r.porEtapa} />
        <Contagem titulo="Situação no Ploomes" itens={r.porSincronizacao} />
        <Contagem titulo="Por responsável (mês)" itens={r.mesPorResponsavel} />
      </div>

      {r.parados && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <AlertTriangle className="h-4 w-4 text-danger" />
            Leads parados ({r.parados.alertas.length}) · sem interação há {r.parados.dias}+ dias
          </h3>
          <TabelaParados r={r.parados} onAbrir={onAbrir} />
        </div>
      )}

      <DsCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Regional</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Ploomes</th>
              </tr>
            </thead>
            <tbody>
              {r.linhas.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => onAbrir(l.id)}
                  className="cursor-pointer border-t border-border/60 hover:bg-muted/40"
                >
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                    {fmtData(l.criadoEm)}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-medium">{l.nome}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[l.cidade, l.estado].filter(Boolean).join(" / ")}
                    </span>
                  </td>
                  <td className="px-4 py-2">{l.unidade}</td>
                  <td className="px-4 py-2">{l.responsavel}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {l.etapaPloomes ?? l.etapa ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <DsBadge size="sm" intent={intentSync(l.sincronizacao)}>
                      {l.sincronizacao}
                    </DsBadge>
                  </td>
                </tr>
              ))}
              {!r.linhas.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhum lead do quiz neste período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DsCard>
    </div>
  );
}

/* ---------------- leads parados ---------------- */

const SITUACAO: Record<AlertaLead["situacao"], { rotulo: string; intent: Intent }> = {
  nunca_interagiu: { rotulo: "Vendedor nunca registrou interação", intent: "danger" },
  parou: { rotulo: "Vendedor parou de interagir", intent: "warning" },
  parado_com_sdr: { rotulo: "Ainda com a Stephany", intent: "info" },
};

function LeadsParados({
  dias,
  onDias,
  carregando,
  erro,
  r,
  onAtualizar,
  onAbrir,
}: {
  dias: number;
  onDias: (d: number) => void;
  carregando: boolean;
  erro: string | null;
  r: ResultadoAlertas | undefined;
  onAtualizar: () => void;
  onAbrir: (id: string) => void;
}) {
  const [vend, setVend] = useState("");
  const [sit, setSit] = useState("");
  const todos = useMemo(() => r?.alertas ?? [], [r]);
  const vendedores = Array.from(new Set(todos.map((a) => a.vendedor))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const filtrados = todos.filter(
    (a) => (!vend || a.vendedor === vend) && (!sit || a.situacao === sit),
  );
  const conta = (s: AlertaLead["situacao"]) => todos.filter((a) => a.situacao === s).length;

  return (
    <div className="space-y-4">
      <DsCard className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Campo rotulo="Sem interação há">
            <select
              className={selectCls}
              value={dias}
              onChange={(e) => onDias(Number(e.target.value))}
            >
              {[1, 2, 3, 5, 7, 15].map((d) => (
                <option key={d} value={d}>
                  {d} dia{d > 1 ? "s" : ""} ou mais
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Vendedor">
            <select className={selectCls} value={vend} onChange={(e) => setVend(e.target.value)}>
              <option value="">Todos</option>
              {vendedores.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Situação">
            <select className={selectCls} value={sit} onChange={(e) => setSit(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(SITUACAO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <DsButton
            emphasis="outline"
            leadingIcon={<RefreshCw className="h-4 w-4" />}
            loading={carregando}
            onClick={onAtualizar}
          >
            Atualizar do Ploomes
          </DsButton>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Leads do quiz dos últimos 60 dias com card <b>aberto</b> no Ploomes (não ganho nem
          perdido) em que o dono do card não registrou interação nem concluiu tarefa no período.
          Registros automáticos do sistema e da Stephany não contam como contato do vendedor.
        </p>
      </DsCard>

      {carregando && !r ? (
        <DsSkeletonList rows={6} />
      ) : erro ? (
        <DsEmpty title="Não foi possível calcular os alertas" description={erro} />
      ) : r && !r.leituraOk ? (
        <DsEmpty
          title="Não deu para ler o Ploomes agora"
          description={`${r.erro ?? ""} Nenhum lead foi marcado como parado para não gerar alarme falso.`}
          actionLabel="Tentar de novo"
          onAction={onAtualizar}
        />
      ) : r ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <DsStat
              label="Leads parados"
              value={todos.length}
              hint={`de ${r.abertos} cards abertos`}
            />
            <DsStat label="Nunca teve interação" value={conta("nunca_interagiu")} />
            <DsStat label="Parou de interagir" value={conta("parou")} />
            <DsStat label="Ainda com a Stephany" value={conta("parado_com_sdr")} />
          </div>
          <TabelaParados r={{ ...r, alertas: filtrados }} onAbrir={onAbrir} />
          <p className="text-xs text-muted-foreground">
            Calculado em {fmtData(r.geradoEm)} · {r.analisados} leads do quiz com card no Ploomes
            analisados.
          </p>
        </>
      ) : null}
    </div>
  );
}

function TabelaParados({ r, onAbrir }: { r: ResultadoAlertas; onAbrir: (id: string) => void }) {
  if (!r.leituraOk)
    return (
      <p className="text-sm text-muted-foreground">
        Não foi possível ler o Ploomes ao gerar ({r.erro ?? "erro desconhecido"}).
      </p>
    );
  if (!r.alertas.length)
    return (
      <DsEmpty
        title="Nenhum lead parado"
        description={`Todos os cards abertos tiveram interação do vendedor nos últimos ${r.dias} dias.`}
      />
    );
  return (
    <DsCard className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Parado há</th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Com quem está</th>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3">Última interação do vendedor</th>
            </tr>
          </thead>
          <tbody>
            {r.alertas.map((a) => (
              <tr
                key={a.id}
                tabIndex={0}
                onClick={() => onAbrir(a.id)}
                onKeyDown={(e) => e.key === "Enter" && onAbrir(a.id)}
                className="cursor-pointer border-t border-border/60 align-top transition-colors hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={cn(
                      "font-display text-lg font-semibold tabular-nums",
                      a.diasParado >= 7 ? "text-danger" : "text-foreground",
                    )}
                  >
                    {a.diasParado}d
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{a.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {[a.cidade, a.unidade].filter(Boolean).join(" · ")} · quiz em{" "}
                    {fmtDia(a.entradaQuiz)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{a.vendedor}</div>
                  <div className="text-xs text-muted-foreground">desde {fmtData(a.desde)}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {a.etapa ?? "—"}
                  {a.funil && <span className="block text-xs">{a.funil}</span>}
                </td>
                <td className="px-4 py-3">
                  <DsBadge size="sm" intent={SITUACAO[a.situacao].intent} dot>
                    {SITUACAO[a.situacao].rotulo}
                  </DsBadge>
                </td>
                <td className="max-w-[280px] px-4 py-3 text-muted-foreground">
                  {a.ultimaInteracao ? (
                    <>
                      <span className="text-foreground">
                        {fmtData(a.ultimaInteracao.data)} · {a.ultimaInteracao.tipo}
                      </span>
                      {a.ultimaInteracao.texto && (
                        <span className="line-clamp-2 block text-xs">
                          {a.ultimaInteracao.texto}
                        </span>
                      )}
                    </>
                  ) : (
                    "Nenhuma"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DsCard>
  );
}
