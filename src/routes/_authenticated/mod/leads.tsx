import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/modules/shared/module-shell";
import { DsCard, DsCardHeader } from "@/components/ds/card";
import { DsBadge } from "@/components/ds/badge";
import { DsButton } from "@/components/ds/button";
import { DsSkeletonList } from "@/components/ds/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  consolidateDuplicates,
  getDuplicateReports,
  getLeadDetail,
  getLeadRulesFn,
  getLeadsDashboard,
  listLeads,
  listQueue,
  processQueueNow,
  retryLeadSync,
  runLeadReconciliation,
  saveLeadRules,
  traceLead,
} from "@/lib/leads/leads.functions";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, Search, Settings, Sparkles, Users, Zap, GitMerge } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/leads")({
  head: () => ({
    meta: [
      { title: "Central de Leads — Solar OS" },
      { name: "description", content: "Fonte oficial de leads: entrada, qualificação, fila e sincronização com o Ploomes." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LeadsPage,
});

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  em_qualificacao: "Em qualificação",
  pendente: "Pendências",
  qualificado: "Qualificado",
  humano: "Humano",
  desqualificado: "Desqualificado",
};
const STATUS_INTENT: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  novo: "neutral",
  em_qualificacao: "info",
  pendente: "warning",
  qualificado: "success",
  humano: "info",
  desqualificado: "danger",
};
const SYNC_LABEL: Record<string, string> = {
  nao_enviado: "Não enviado",
  pendente: "Na fila",
  sincronizado: "No Ploomes",
  erro: "Erro",
  revisao_manual: "Revisão manual",
};
const SYNC_INTENT: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  nao_enviado: "neutral",
  pendente: "info",
  sincronizado: "success",
  erro: "danger",
  revisao_manual: "warning",
};

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const fmtPhone = (e?: string | null) => {
  if (!e) return "—";
  const d = e.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return `(${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}`;
  return e;
};
const money = (v?: number | string | null) => (v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

type Tab = "painel" | "leads" | "fila" | "rastreio" | "reconciliacao" | "regras";

function LeadsPage() {
  const [tab, setTab] = useState<Tab>("painel");
  const [selected, setSelected] = useState<string | null>(null);
  const qc = useQueryClient();

  // Atualização confiável: Realtime em leads + fila
  useEffect(() => {
    const ch = supabase
      .channel("central-leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        qc.invalidateQueries({ queryKey: ["leads"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_sync_queue" }, () => {
        qc.invalidateQueries({ queryKey: ["leads"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const tabs: Array<{ k: Tab; label: string; Icon: typeof Users }> = [
    { k: "painel", label: "Painel", Icon: Zap },
    { k: "leads", label: "Leads", Icon: Users },
    { k: "fila", label: "Fila Ploomes", Icon: Clock },
    { k: "rastreio", label: "Rastreio", Icon: Search },
    { k: "reconciliacao", label: "Reconciliação", Icon: GitMerge },
    { k: "regras", label: "Regras", Icon: Settings },
  ];

  return (
    <ModuleShell active="leads" title="Central de Leads" subtitle="Fonte oficial: entrada → validação → qualificação → fila → Ploomes">
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map(({ k, label, Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm whitespace-nowrap border transition-colors",
              tab === k ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "painel" && <Painel onOpen={(id) => setSelected(id)} onFilter={() => setTab("leads")} />}
        {tab === "leads" && <LeadsList onOpen={(id) => setSelected(id)} />}
        {tab === "fila" && <Fila onOpen={(id) => setSelected(id)} />}
        {tab === "rastreio" && <Rastreio onOpen={(id) => setSelected(id)} />}
        {tab === "reconciliacao" && <Reconciliacao onOpen={(id) => setSelected(id)} />}
        {tab === "regras" && <Regras />}
      </div>

      <LeadDetail id={selected} onClose={() => setSelected(null)} />
    </ModuleShell>
  );
}

function Stat({ label, value, intent, onClick }: { label: string; value: number | string; intent?: "success" | "warning" | "danger" | "info"; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn("text-left rounded-xl border border-border bg-card p-3 hover:bg-accent/40 transition-colors", !onClick && "cursor-default")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-heading text-2xl font-semibold mt-0.5",
          intent === "success" && "text-success",
          intent === "warning" && "text-warning",
          intent === "danger" && "text-destructive",
          intent === "info" && "text-primary",
        )}
      >
        {value}
      </div>
    </button>
  );
}

function Painel({ onOpen, onFilter }: { onOpen: (id: string) => void; onFilter: () => void }) {
  const [days, setDays] = useState(30);
  const fn = useServerFn(getLeadsDashboard);
  const q = useQuery({ queryKey: ["leads", "dashboard", days], queryFn: () => fn({ data: { days } }), refetchInterval: 60_000 });
  const listFn = useServerFn(listLeads);
  const recent = useQuery({ queryKey: ["leads", "recent"], queryFn: () => listFn({ data: { pageSize: 8 } }) });
  const d = q.data;
  if (q.isLoading) return <DsSkeletonList rows={6} />;
  if (!d) return <p className="text-sm text-destructive">Não foi possível carregar o painel.</p>;
  const fila = d.fila ?? {};
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Período:</span>
        {[7, 30, 90, 365].map((n) => (
          <button key={n} onClick={() => setDays(n)} className={cn("rounded-md px-2 py-1 border", days === n ? "bg-primary text-primary-foreground border-primary" : "border-border")}>
            {n}d
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">Atualizado {fmtDate(d.atualizado_em)}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <Stat label="Leads recebidos" value={d.total} onClick={onFilter} />
        <Stat label="Novos" value={d.novos} />
        <Stat label="Em qualificação / pendências" value={d.em_qualificacao + d.com_pendencias} intent="warning" />
        <Stat label="Qualificados" value={d.qualificados} intent="success" />
        <Stat label="Qualificados pela Liz" value={d.qualificados_liz} intent="info" />
        <Stat label="Pediram humano" value={d.humano} intent="info" />
        <Stat label="Enviados ao Ploomes" value={d.ploomes_sincronizados} intent="success" />
        <Stat label="Na fila" value={d.ploomes_pendentes} intent="info" />
        <Stat label="Erros / revisão" value={d.ploomes_erro} intent={d.ploomes_erro ? "danger" : undefined} />
        <Stat label="Duplicados marcados" value={d.duplicados} />
        <Stat label="Desqualificados" value={d.desqualificados} />
      </div>

      <DsCard>
        <DsCardHeader title="Saúde da fila Ploomes" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-muted-foreground">Pendentes</span><div className="font-semibold">{fila.pendente ?? 0}</div></div>
          <div><span className="text-muted-foreground">Processando</span><div className="font-semibold">{fila.processando ?? 0}</div></div>
          <div><span className="text-muted-foreground">Revisão manual</span><div className={cn("font-semibold", fila.revisao_manual ? "text-warning" : "")}>{fila.revisao_manual ?? 0}</div></div>
          <div><span className="text-muted-foreground">Último sucesso</span><div className="font-semibold">{fmtDate(fila.ultimo_sucesso)}</div></div>
        </div>
        {fila.mais_antigo_pendente && <p className="text-xs text-muted-foreground mt-2">Item mais antigo aguardando desde {fmtDate(fila.mais_antigo_pendente)}</p>}
        {fila.ultimo_erro && <p className="text-xs text-destructive mt-1 break-all">Último erro: {fila.ultimo_erro}</p>}
      </DsCard>

      <div className="grid md:grid-cols-3 gap-3">
        {[
          ["Por origem", d.por_origem],
          ["Por status", (d.por_status ?? []).map((x: any) => ({ ...x, k: STATUS_LABEL[x.k] ?? x.k }))],
          ["Por cidade", d.por_cidade],
          ["Por etapa", d.por_etapa],
          ["Por responsável", d.por_responsavel],
        ].map(([title, rows]: any) => (
          <DsCard key={title}>
            <DsCardHeader title={title} />
            <ul className="text-sm space-y-1">
              {(rows ?? []).length === 0 && <li className="text-muted-foreground">Sem dados</li>}
              {(rows ?? []).map((r: any) => (
                <li key={r.k} className="flex justify-between gap-2">
                  <span className="truncate">{r.k}</span>
                  <span className="font-semibold tabular-nums">{r.n}</span>
                </li>
              ))}
            </ul>
          </DsCard>
        ))}
      </div>

      <DsCard>
        <DsCardHeader title="Últimos leads" />
        <LeadTable rows={recent.data?.rows ?? []} onOpen={onOpen} />
      </DsCard>
    </div>
  );
}

function LeadTable({ rows, onOpen }: { rows: any[]; onOpen: (id: string) => void }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nenhum lead encontrado.</p>;
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm min-w-[820px]">
        <thead className="text-xs text-muted-foreground">
          <tr className="text-left">
            <th className="px-2 py-1">Lead</th>
            <th className="px-2 py-1">Telefone</th>
            <th className="px-2 py-1">Cidade</th>
            <th className="px-2 py-1">Fatura</th>
            <th className="px-2 py-1">Origem</th>
            <th className="px-2 py-1">Qualificação</th>
            <th className="px-2 py-1">Ploomes</th>
            <th className="px-2 py-1">Entrada</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} onClick={() => onOpen(l.id)} className="border-t border-border hover:bg-accent/40 cursor-pointer">
              <td className="px-2 py-2">
                <div className="font-medium">{l.nome || <span className="text-muted-foreground">Não informado</span>}</div>
                {l.qualificado_por === "liz" && <span className="text-[11px] text-primary inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Liz</span>}
              </td>
              <td className="px-2 py-2 tabular-nums">{fmtPhone(l.telefone_e164) !== "—" ? fmtPhone(l.telefone_e164) : l.telefone || "—"}</td>
              <td className="px-2 py-2">{l.cidade || <span className="text-muted-foreground">—</span>}</td>
              <td className="px-2 py-2">{money(l.valor_conta_num ?? null)}</td>
              <td className="px-2 py-2"><span className="text-xs">{l.origem_principal || l.origem || "—"}</span></td>
              <td className="px-2 py-2">
                <DsBadge intent={STATUS_INTENT[l.qualificacao_status] ?? "neutral"} size="sm">{STATUS_LABEL[l.qualificacao_status] ?? l.qualificacao_status}</DsBadge>
                {Array.isArray(l.campos_pendentes) && l.campos_pendentes.length > 0 && <div className="text-[11px] text-muted-foreground mt-0.5">{l.campos_pendentes.length} pendência(s)</div>}
              </td>
              <td className="px-2 py-2">
                <DsBadge intent={SYNC_INTENT[l.ploomes_sync_status] ?? "neutral"} size="sm">{SYNC_LABEL[l.ploomes_sync_status] ?? l.ploomes_sync_status}</DsBadge>
                {l.ploomes_deal_id && <div className="text-[11px] text-muted-foreground">#{l.ploomes_deal_id}</div>}
              </td>
              <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(l.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeadsList({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sync, setSync] = useState("");
  const [origem, setOrigem] = useState("");
  const [onlyLiz, setOnlyLiz] = useState(false);
  const [page, setPage] = useState(1);
  const fn = useServerFn(listLeads);
  const query = useQuery({
    queryKey: ["leads", "list", { q, status, sync, origem, onlyLiz, page }],
    queryFn: () => fn({ data: { q, status: status || undefined, sync: sync || undefined, origem: origem || undefined, onlyLiz, page, pageSize: 25 } }),
  });
  const pages = Math.max(1, Math.ceil((query.data?.count ?? 0) / 25));
  const sel = "h-9 rounded-md border border-border bg-background px-2 text-sm";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Nome, telefone, e-mail, cidade ou ID" className="pl-8" />
        </div>
        <select className={sel} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Qualificação: todas</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={sel} value={sync} onChange={(e) => { setSync(e.target.value); setPage(1); }}>
          <option value="">Ploomes: todos</option>
          {Object.entries(SYNC_LABEL).filter(([k]) => k !== "revisao_manual").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={sel} value={origem} onChange={(e) => { setOrigem(e.target.value); setPage(1); }}>
          <option value="">Origem: todas</option>
          {["WhatsApp", "Meta Ads", "Site", "Tráfego Pago", "Indicação", "Prospecção", "Ploomes"].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyLiz} onChange={(e) => { setOnlyLiz(e.target.checked); setPage(1); }} /> Só Liz</label>
      </div>
      {query.isLoading ? <DsSkeletonList rows={8} /> : <LeadTable rows={query.data?.rows ?? []} onOpen={onOpen} />}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{query.data?.count ?? 0} lead(s)</span>
        <div className="flex gap-2 items-center">
          <DsButton emphasis="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</DsButton>
          <span>{page} / {pages}</span>
          <DsButton emphasis="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</DsButton>
        </div>
      </div>
    </div>
  );
}

function Fila({ onOpen }: { onOpen: (id: string) => void }) {
  const [status, setStatus] = useState("");
  const fn = useServerFn(listQueue);
  const proc = useServerFn(processQueueNow);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["leads", "queue", status], queryFn: () => fn({ data: { status: status || undefined } }), refetchInterval: 30_000 });
  const m = useMutation({
    mutationFn: () => proc(),
    onSuccess: (r) => { toast.success(`Fila processada: ${r.ok} ok, ${r.retry} para retentar, ${r.manual} revisão manual`); qc.invalidateQueries({ queryKey: ["leads"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        {["", "pendente", "processando", "sincronizado", "revisao_manual"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={cn("rounded-full px-3 py-1 text-sm border", status === s ? "bg-primary text-primary-foreground border-primary" : "border-border")}>
            {s ? SYNC_LABEL[s] ?? s : "Todos"}
          </button>
        ))}
        <DsButton size="sm" className="ml-auto" onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Processar agora
        </DsButton>
      </div>
      {q.isLoading ? <DsSkeletonList rows={6} /> : (
        <div className="space-y-2">
          {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Fila vazia.</p>}
          {(q.data ?? []).map((it: any) => (
            <DsCard key={it.id} interactive className="p-3" onClick={() => onOpen(it.lead_id)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-sm">{it.leads?.nome || "Não informado"} <span className="text-muted-foreground font-normal">· {fmtPhone(it.leads?.telefone_e164)}</span></div>
                  <div className="text-xs text-muted-foreground">Tentativas {it.attempts}/{it.max_attempts} · próxima {fmtDate(it.next_attempt_at)} · origem {it.leads?.origem_principal ?? "—"}</div>
                  {it.last_error && <div className="text-xs text-destructive mt-1 break-all">{it.last_error}</div>}
                </div>
                <DsBadge intent={SYNC_INTENT[it.status] ?? "neutral"} size="sm">{SYNC_LABEL[it.status] ?? it.status}</DsBadge>
              </div>
            </DsCard>
          ))}
        </div>
      )}
    </div>
  );
}

function Rastreio({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const fn = useServerFn(traceLead);
  const query = useQuery({ queryKey: ["leads", "trace", term], queryFn: () => fn({ data: { q: term } }), enabled: term.length >= 4 });
  const d = query.data;
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Telefone (qualquer formato) ou ID do lead" />
        <DsButton type="submit">Rastrear</DsButton>
      </form>
      {query.isFetching && <DsSkeletonList rows={4} />}
      {d && (
        <div className="grid md:grid-cols-2 gap-3">
          <DsCard>
            <DsCardHeader title={`Leads (${d.leads.length})`} />
            {d.leads.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lead com este telefone.</p>}
            {d.leads.map((l: any) => (
              <button key={l.id} onClick={() => onOpen(l.id)} className="block w-full text-left text-sm border-t border-border py-2 hover:bg-accent/40">
                <div className="font-medium">{l.nome || "Não informado"} {l.duplicado_de && <DsBadge intent="warning" size="sm">duplicado</DsBadge>}</div>
                <div className="text-xs text-muted-foreground">{l.origem_principal ?? l.origem} · {STATUS_LABEL[l.qualificacao_status] ?? l.qualificacao_status} · {SYNC_LABEL[l.ploomes_sync_status] ?? l.ploomes_sync_status} · {fmtDate(l.created_at)}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{l.id}</div>
              </button>
            ))}
          </DsCard>
          <DsCard>
            <DsCardHeader title={`WhatsApp: ${d.contacts.length} contato(s), ${d.conversations.length} conversa(s)`} />
            {d.contacts.map((c: any) => (
              <div key={c.id} className="text-sm border-t border-border py-2">
                <div className="font-medium">{c.profile_name || fmtPhone(c.phone_e164)}</div>
                <div className="text-xs text-muted-foreground">último recebido {fmtDate(c.last_inbound_at)} · lead {c.lead_id ? "vinculado" : "não vinculado"}</div>
              </div>
            ))}
            {d.lastMessages.slice(0, 5).map((m: any) => (
              <div key={m.id} className="text-xs border-t border-border py-1.5"><span className="text-muted-foreground">{fmtDate(m.occurred_at)} · {m.direction === "inbound" ? "Cliente" : m.ai_generated ? "Liz" : "Atendente"}:</span> {m.body?.slice(0, 120)}</div>
            ))}
          </DsCard>
          <DsCard>
            <DsCardHeader title={`Webhooks recebidos (${d.webhookEvents.length})`} />
            {d.webhookEvents.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento recente com este número.</p>}
            {d.webhookEvents.map((e: any) => (
              <div key={e.id} className="text-xs border-t border-border py-1.5 flex justify-between gap-2"><span>{fmtDate(e.received_at)} · {e.event_kind}</span><DsBadge size="sm" intent={e.process_status === "processed" ? "success" : e.error ? "danger" : "neutral"}>{e.process_status}</DsBadge></div>
            ))}
          </DsCard>
          <DsCard>
            <DsCardHeader title={`Fila e eventos (${d.queue.length} / ${d.events.length})`} />
            {d.queue.map((it: any) => <div key={it.id} className="text-xs border-t border-border py-1.5">Fila: <b>{it.status}</b> · tentativas {it.attempts} · {it.last_error ?? "sem erro"}</div>)}
            <EventList events={d.events} />
          </DsCard>
        </div>
      )}
    </div>
  );
}

function EventList({ events }: { events: any[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">Sem eventos.</p>;
  return (
    <ol className="text-xs space-y-1 mt-1">
      {events.map((e) => (
        <li key={e.id} className="border-t border-border py-1.5">
          <div className="flex justify-between gap-2"><span className="font-medium">{e.event}</span><span className="text-muted-foreground whitespace-nowrap">{fmtDate(e.created_at)}</span></div>
          <div className="text-muted-foreground">{e.step}{e.source ? ` · ${e.source}` : ""}{e.result ? ` · ${e.result}` : ""}</div>
          {e.external_ids && Object.keys(e.external_ids).length > 0 && <div className="font-mono text-[11px]">{JSON.stringify(e.external_ids)}</div>}
          {e.detail?.error && <div className="text-destructive break-all">{String(e.detail.error)}</div>}
        </li>
      ))}
    </ol>
  );
}

function Reconciliacao({ onOpen }: { onOpen: (id: string) => void }) {
  const run = useServerFn(runLeadReconciliation);
  const dupFn = useServerFn(getDuplicateReports);
  const consFn = useServerFn(consolidateDuplicates);
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<any>(null);
  const m = useMutation({
    mutationFn: (args: { dryRun: boolean; syncPloomes?: boolean }) => run({ data: { ...args, limit: 20, offset } }),
    onSuccess: (r) => { setResult(r); qc.invalidateQueries({ queryKey: ["leads"] }); toast.success(r.dryRun ? "Simulação concluída (nada foi gravado)" : "Reconciliação aplicada"); },
    onError: (e: any) => toast.error(e.message),
  });
  const dups = useQuery({ queryKey: ["leads", "dups"], queryFn: () => dupFn({ data: {} }), enabled: false });
  const cons = useMutation({
    mutationFn: (dryRun: boolean) => consFn({ data: { dryRun } }),
    onSuccess: (r) => { toast.success(r.dryRun ? `Simulação: ${r.groups} grupo(s), ${r.plan.reduce((a: number, p: any) => a + p.mark.length, 0)} seriam marcados` : `${r.merged} duplicado(s) marcados (nada apagado)`); qc.invalidateQueries({ queryKey: ["leads"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <DsCard>
        <DsCardHeader title="Conversas da Liz → leads" subtitle="Reprocessa conversas atendidas pela Liz e cria/atualiza leads só com o que o cliente informou. Simule primeiro." />
        <div className="flex flex-wrap gap-2 items-center">
          <Label className="text-xs">Lote a partir de</Label>
          <Input type="number" className="w-24" value={offset} onChange={(e) => setOffset(Math.max(0, Number(e.target.value)))} />
          <DsButton emphasis="outline" onClick={() => m.mutate({ dryRun: true })} disabled={m.isPending}>Simular 20</DsButton>
          <DsButton onClick={() => m.mutate({ dryRun: false })} disabled={m.isPending}>Aplicar (só CRM interno)</DsButton>
          <DsButton onClick={() => m.mutate({ dryRun: false, syncPloomes: true })} disabled={m.isPending}>Aplicar + enviar qualificados ao Ploomes</DsButton>
          {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        {result && (
          <div className="mt-3 space-y-2">
            <div className="text-sm flex flex-wrap gap-3">
              <span>Analisadas <b>{result.totals.analisadas}</b></span><span>Criar <b>{result.totals.criar}</b></span><span>Atualizar <b>{result.totals.atualizar}</b></span><span>Sem dados <b>{result.totals.sem_dados}</b></span><span>Ignoradas <b>{result.totals.ignorar}</b></span><span>Erros <b>{result.totals.erros}</b></span><span>Ploomes <b>{result.totals.enviados_ploomes}</b></span>
              {result.dryRun && <DsBadge intent="info" size="sm">simulação</DsBadge>}
            </div>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs min-w-[760px]">
                <thead className="text-muted-foreground"><tr className="text-left"><th className="px-2 py-1">Telefone</th><th className="px-2 py-1">Perfil</th><th className="px-2 py-1">Ação</th><th className="px-2 py-1">Status</th><th className="px-2 py-1">Preenchidos</th><th className="px-2 py-1">Pendentes</th><th className="px-2 py-1">Ploomes</th></tr></thead>
                <tbody>
                  {result.rows.map((r: any) => (
                    <tr key={r.conversation_id} className="border-t border-border hover:bg-accent/40 cursor-pointer" onClick={() => r.lead_id && onOpen(r.lead_id)}>
                      <td className="px-2 py-1 tabular-nums">{fmtPhone(r.phone)}</td>
                      <td className="px-2 py-1">{r.nome_perfil ?? "—"}</td>
                      <td className="px-2 py-1">{r.acao}</td>
                      <td className="px-2 py-1">{STATUS_LABEL[r.status_previsto] ?? r.status_previsto}</td>
                      <td className="px-2 py-1">{r.campos_preenchidos.join(", ") || "—"}</td>
                      <td className="px-2 py-1 text-warning">{r.pendentes.join("; ") || "—"}</td>
                      <td className="px-2 py-1">{r.ploomes}{r.erro ? ` · ${r.erro}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DsCard>

      <DsCard>
        <DsCardHeader title="Duplicados" subtitle="Nada é apagado. No CRM interno, os repetidos são marcados como duplicados do registro principal; no Ploomes só é gerado o relatório." />
        <div className="flex flex-wrap gap-2">
          <DsButton emphasis="outline" onClick={() => dups.refetch()} disabled={dups.isFetching}>Gerar relatório</DsButton>
          <DsButton emphasis="outline" onClick={() => cons.mutate(true)} disabled={cons.isPending}>Simular consolidação interna</DsButton>
          <DsButton onClick={() => { if (confirm("Marcar duplicados internos (sem apagar)?")) cons.mutate(false); }} disabled={cons.isPending}>Consolidar interno</DsButton>
        </div>
        {dups.data && (
          <div className="grid md:grid-cols-2 gap-3 mt-3 text-sm">
            <div>
              <div className="font-medium mb-1">CRM interno: {dups.data.internal.length} telefone(s) repetido(s)</div>
              <div className="max-h-72 overflow-auto space-y-1">
                {dups.data.internal.map((g: any) => (
                  <div key={g.phone} className="border border-border rounded p-2 text-xs">
                    <div className="font-medium">{fmtPhone(g.phone)} · {g.count} registros</div>
                    {g.leads.map((l: any) => <button key={l.id} onClick={() => onOpen(l.id)} className="block text-left text-muted-foreground hover:text-foreground">{fmtDate(l.created_at)} · {l.nome || "Não informado"} · {l.origem_principal ?? l.origem}{l.ploomes_deal_id ? ` · negócio #${l.ploomes_deal_id}` : ""}</button>)}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="font-medium mb-1">Ploomes: {dups.data.ploomes.groups?.length ?? 0} telefone(s) com contatos repetidos {dups.data.ploomes.error && <span className="text-destructive">({dups.data.ploomes.error})</span>}</div>
              <div className="max-h-72 overflow-auto space-y-1">
                {(dups.data.ploomes.groups ?? []).map((g: any) => (
                  <div key={g.phone_e164} className="border border-border rounded p-2 text-xs">
                    <div className="font-medium">{fmtPhone(g.phone_e164)}</div>
                    {g.contacts.map((c: any) => <div key={c.Id} className="text-muted-foreground">#{c.Id} · {c.Name} · {fmtDate(c.CreateDate)} · negócios abertos: {c.deals.length}</div>)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DsCard>
    </div>
  );
}

function Regras() {
  const get = useServerFn(getLeadRulesFn);
  const save = useServerFn(saveLeadRules);
  const q = useQuery({ queryKey: ["leads", "rules"], queryFn: () => get() });
  const [form, setForm] = useState<{ minFatura: number; exigirFatura: boolean; defaultOwnerId: string } | null>(null);
  const f = form ?? (q.data ? { minFatura: q.data.minFatura, exigirFatura: q.data.exigirFatura, defaultOwnerId: q.data.defaultOwnerId ? String(q.data.defaultOwnerId) : "" } : null);
  const m = useMutation({
    mutationFn: () => save({ data: { minFatura: f!.minFatura, exigirFatura: f!.exigirFatura, defaultOwnerId: f!.defaultOwnerId ? Number(f!.defaultOwnerId) : null } }),
    onSuccess: () => { toast.success("Regras salvas"); q.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  if (!f) return <DsSkeletonList rows={3} />;
  return (
    <DsCard className="max-w-xl">
      <DsCardHeader title="Regras de qualificação" subtitle="Editáveis sem código. Só administração/coordenação salva." />
      <div className="space-y-3">
        <div>
          <Label>Fatura mínima (R$)</Label>
          <Input type="number" value={f.minFatura} onChange={(e) => setForm({ ...f, minFatura: Number(e.target.value) })} />
          <p className="text-xs text-muted-foreground mt-1">Abaixo disso o lead é desqualificado e não vai ao Ploomes.</p>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.exigirFatura} onChange={(e) => setForm({ ...f, exigirFatura: e.target.checked })} /> Exigir foto/PDF da fatura para qualificar</label>
        <div>
          <Label>Responsável padrão no Ploomes (ID do usuário)</Label>
          <Input value={f.defaultOwnerId} onChange={(e) => setForm({ ...f, defaultOwnerId: e.target.value })} placeholder="ex.: 60022664" />
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Obrigatórios para qualificar: nome, telefone válido, cidade e valor médio da fatura. Tipo de ligação, interesse e consentimento ficam como pendências informativas quando não citados.</p>
          <p>Nada é presumido: campo não informado fica vazio e aparece como pendência.</p>
        </div>
        <DsButton onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Salvar</DsButton>
      </div>
    </DsCard>
  );
}

function LeadDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const fn = useServerFn(getLeadDetail);
  const retry = useServerFn(retryLeadSync);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["leads", "detail", id], queryFn: () => fn({ data: { id: id! } }), enabled: !!id });
  const m = useMutation({
    mutationFn: (dryRun: boolean) => retry({ data: { id: id!, dryRun } }),
    onSuccess: (r: any, dryRun) => {
      if (r.ok) toast.success(dryRun ? `Simulação: ${r.createdContact ? "criaria contato" : `reutilizaria contato #${r.contactId}`} · ${r.createdDeal ? "criaria negócio" : `atualizaria negócio #${r.dealId}`}` : `Enviado: contato #${r.contactId} · negócio #${r.dealId}`);
      else toast.error(r.error);
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const d = q.data;
  const L = d?.lead;
  const fields = useMemo(() => L ? [
    ["Nome", L.nome], ["Telefone", fmtPhone(L.telefone_e164) !== "—" ? fmtPhone(L.telefone_e164) : L.telefone], ["E-mail", L.email], ["CPF/CNPJ", L.cpf_cnpj], ["Cidade", L.cidade ? `${L.cidade}${L.estado ? `/${L.estado}` : ""}` : null],
    ["Fatura média", L.valor_conta_num != null ? money(L.valor_conta_num) : L.valor_conta], ["Tipo de ligação", L.padrao_eletrico], ["Segmento", L.segmento], ["Interesse", L.produto_interesse], ["Fatura anexada", L.fatura_url ? "Sim" : null],
    ["Origem", L.origem_principal || L.origem], ["Canal", L.canal], ["Sistema de entrada", L.sistema_entrada], ["Campanha", L.campanha || L.utm_campaign], ["Qualificado por", L.qualificado_por], ["Qualificado em", L.qualificado_em ? fmtDate(L.qualificado_em) : null],
    ["Consentimento LGPD", L.consent_lgpd == null ? null : L.consent_lgpd ? "Sim" : "Não"], ["Etapa", L.stage], ["Unidade", L.unit],
  ] : [], [L]);
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{L?.nome || "Lead sem nome informado"}</DialogTitle>
        </DialogHeader>
        {q.isLoading && <DsSkeletonList rows={6} />}
        {L && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <DsBadge intent={STATUS_INTENT[L.qualificacao_status] ?? "neutral"}>{STATUS_LABEL[L.qualificacao_status] ?? L.qualificacao_status}</DsBadge>
              <DsBadge intent={SYNC_INTENT[L.ploomes_sync_status] ?? "neutral"}>{SYNC_LABEL[L.ploomes_sync_status] ?? L.ploomes_sync_status}</DsBadge>
              {L.duplicado_de && <DsBadge intent="warning">duplicado</DsBadge>}
              <div className="ml-auto flex gap-2">
                <DsButton size="sm" emphasis="outline" onClick={() => m.mutate(true)} disabled={m.isPending}>Simular envio</DsButton>
                <DsButton size="sm" onClick={() => m.mutate(false)} disabled={m.isPending || !!L.duplicado_de}>{m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {L.ploomes_deal_id ? "Reenviar / atualizar" : "Enviar ao Ploomes"}</DsButton>
              </div>
            </div>
            {L.qualificacao_motivo && <p className="text-sm text-muted-foreground">{L.qualificacao_motivo}</p>}
            {Array.isArray(L.campos_pendentes) && L.campos_pendentes.length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <div className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" /> Pendências</div>
                <ul className="list-disc pl-5 mt-1">{L.campos_pendentes.map((p: string) => <li key={p}>{p}</li>)}</ul>
              </div>
            )}
            {L.ploomes_sync_error && <p className="text-sm text-destructive break-all">Erro Ploomes: {L.ploomes_sync_error}</p>}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
              {fields.map(([k, v]) => (
                <div key={k as string}><div className="text-xs text-muted-foreground">{k}</div><div className={cn(!v && "text-muted-foreground italic")}>{v || "Não informado"}</div></div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground font-mono grid md:grid-cols-2 gap-1">
              <div>ID interno: {L.id}</div>
              <div>Ploomes contato: {L.ploomes_contact_id ?? "—"} · negócio: {L.ploomes_deal_id ?? "—"}</div>
              <div>Contato WA: {L.wa_contact_id ?? "—"}</div>
              <div>Conversa: {L.wa_conversation_id ?? d?.conversationId ?? "—"}</div>
              {L.meta_lead_id && <div>Meta lead: {L.meta_lead_id}</div>}
              {L.external_id && <div>ID externo: {L.external_id}</div>}
              <div>Criado {fmtDate(L.created_at)} · atualizado {fmtDate(L.updated_at)}</div>
              <div>Tentativas Ploomes: {L.ploomes_sync_attempts ?? 0}</div>
            </div>

            {d!.duplicates.length > 0 && (
              <div className="text-sm"><div className="font-medium">Duplicados vinculados a este lead</div>{d!.duplicates.map((x: any) => <div key={x.id} className="text-xs text-muted-foreground">{fmtDate(x.created_at)} · {x.nome || "Não informado"} · {x.origem_principal ?? "—"}</div>)}</div>
            )}

            <div>
              <div className="font-medium text-sm mb-1">Conversa ({d!.messages.length} mensagens)</div>
              {d!.messages.length === 0 ? <p className="text-sm text-muted-foreground">Sem conversa vinculada.</p> : (
                <div className="max-h-80 overflow-y-auto rounded-lg border border-border p-2 space-y-1.5 bg-muted/30">
                  {d!.messages.map((m: any) => (
                    <div key={m.id} className={cn("max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm", m.direction === "inbound" ? "bg-card border border-border" : "ml-auto bg-primary/10")}>
                      <div className="text-[10px] text-muted-foreground">{m.direction === "inbound" ? "Cliente" : m.ai_generated ? "Liz" : "Atendente"} · {fmtDate(m.occurred_at)}</div>
                      <div className="whitespace-pre-wrap break-words">{m.body || `[${m.msg_type}]`}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="font-medium text-sm mb-1">Fila Ploomes</div>
              {d!.queue.length === 0 ? <p className="text-xs text-muted-foreground">Nunca enfileirado.</p> : d!.queue.map((it: any) => <div key={it.id} className="text-xs border-t border-border py-1"><b>{SYNC_LABEL[it.status] ?? it.status}</b> · tentativas {it.attempts}/{it.max_attempts} · próxima {fmtDate(it.next_attempt_at)} · {it.reason}{it.last_error ? ` · ${it.last_error}` : ""}</div>)}
            </div>

            <div>
              <div className="font-medium text-sm mb-1">Auditoria</div>
              <EventList events={d!.events} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
