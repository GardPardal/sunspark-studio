import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  addApplicationNote,
  assignApplication,
  createDiscInvite,
  createJob,
  getApplication,
  getResumeUrl,
  listApplications,
  listDiscVersions,
  resendApplicationEmail,
  saveJobProcess,
  setApplicationStage,
} from "@/modules/rh/rh.functions";
import { ModuleShell } from "@/modules/shared/module-shell";
import { DsCard, DsCardHeader } from "@/components/ds/card";
import { DsBadge } from "@/components/ds/badge";
import { DsEmpty } from "@/components/ds/empty";
import { DsSkeletonList } from "@/components/ds/skeleton";
import { Users, FileText, Mail, RefreshCw, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/rh")({
  validateSearch: (s: Record<string, unknown>): { candidatura?: string } =>
    typeof s.candidatura === "string" ? { candidatura: s.candidatura } : {},
  head: () => ({
    meta: [{ title: "RH — Recrutamento e Seleção" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: Page,
});

const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

function Page() {
  const search = useSearch({ from: "/_authenticated/mod/rh" });
  const [selected, setSelected] = useState<string | null>(search.candidatura ?? null);
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [filters, setFilters] = useState<{ job_id?: string; stage?: string; q?: string; include_test: boolean }>({
    include_test: false,
  });

  const listFn = useServerFn(listApplications);
  const list = useQuery({
    queryKey: ["rh_applications", filters],
    queryFn: () =>
      listFn({
        data: {
          job_id: filters.job_id ?? null,
          stage: filters.stage ?? null,
          q: filters.q ?? null,
          include_test: filters.include_test,
        },
      }) as any,
  });

  const jobs: any[] = list.data?.jobs ?? [];
  const apps: any[] = list.data?.applications ?? [];
  const stages: string[] = useMemo(() => {
    const job = jobs.find((j) => j.id === filters.job_id);
    return (job?.stages as string[]) ?? (list.data?.defaultStages ?? []);
  }, [jobs, filters.job_id, list.data]);

  return (
    <ModuleShell title="RH" subtitle="Vagas, candidaturas e processo seletivo" active="rh">
      <DsCard>
        <DsCardHeader
          title="Candidaturas"
          subtitle="Cada mudança de etapa fica registrada com autor e horário"
          action={
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {(["lista", "kanban"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize ${
                    view === v ? "bg-card shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          }
        />
        <div className="flex flex-wrap gap-2 border-b border-border/60 p-3">
          <input
            placeholder="Buscar nome ou e-mail"
            className="h-9 min-w-[180px] flex-1 rounded-lg border border-border bg-background px-3 text-sm"
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value || undefined }))}
          />
          <select
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
            value={filters.job_id ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, job_id: e.target.value || undefined }))}
          >
            <option value="">Todas as vagas</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
            value={filters.stage ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value || undefined }))}
          >
            <option value="">Todas as etapas</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={filters.include_test}
              onChange={(e) => setFilters((f) => ({ ...f, include_test: e.target.checked }))}
            />
            Mostrar registros de teste
          </label>
          <Link to="/mod/rh-disc" className="ml-auto rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
            Avaliação comportamental
          </Link>
        </div>

        <div className="p-3">
          {list.isLoading ? (
            <DsSkeletonList rows={4} />
          ) : list.error ? (
            <p className="p-4 text-sm text-destructive">{(list.error as Error).message}</p>
          ) : apps.length === 0 ? (
            <DsEmpty
              icon={<Users className="h-5 w-5" />}
              title="Nenhuma candidatura por aqui"
              description="Assim que alguém se candidatar por uma vaga publicada, ela aparece nesta lista."
            />
          ) : view === "lista" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">Candidato</th>
                    <th className="p-2">Vaga</th>
                    <th className="p-2">Etapa</th>
                    <th className="p-2">Inscrição</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a) => (
                    <tr key={a.id} className="border-t border-border/60">
                      <td className="p-2">
                        <div className="font-semibold">
                          {a.full_name} {a.is_test ? <DsBadge intent="warning">teste</DsBadge> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </td>
                      <td className="p-2 text-xs">{a.job_title ?? "Banco de talentos"}</td>
                      <td className="p-2 text-xs">{a.stage}</td>
                      <td className="p-2 text-xs text-muted-foreground">{fmt(a.created_at)}</td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => setSelected(a.id)}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {stages.map((s) => {
                const col = apps.filter((a) => a.stage === s);
                return (
                  <div key={s} className="w-64 shrink-0 rounded-xl bg-muted/50 p-2">
                    <div className="mb-2 flex items-center justify-between px-1 text-xs font-bold">
                      <span>{s}</span>
                      <span className="text-muted-foreground">{col.length}</span>
                    </div>
                    <div className="space-y-2">
                      {col.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setSelected(a.id)}
                          className="w-full rounded-lg border border-border bg-card p-2 text-left text-xs shadow-sm"
                        >
                          <div className="font-semibold">{a.full_name}</div>
                          <div className="text-muted-foreground">{a.job_title ?? "Banco de talentos"}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DsCard>

      <JobsProcessCard jobs={jobs} onSaved={() => list.refetch()} />

      {selected ? <Detail id={selected} onClose={() => setSelected(null)} onChanged={() => list.refetch()} /> : null}
    </ModuleShell>
  );
}

function JobsProcessCard({ jobs, onSaved }: { jobs: any[]; onSaved: () => void }) {
  const saveFn = useServerFn(saveJobProcess);
  const [creating, setCreating] = useState(false);
  const save = useMutation({
    mutationFn: (v: any) => saveFn({ data: v }) as any,
    onSuccess: () => {
      toast.success("Vaga atualizada.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DsCard>
      <DsCardHeader
        title="Vagas e etapas"
        subtitle="Publicação, etapas do processo e avaliação comportamental"
        action={
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            + Nova vaga
          </button>
        }
      />
      <div className="divide-y divide-border/60">
        {jobs.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhuma vaga cadastrada ainda. Clique em <strong>+ Nova vaga</strong> para criar a primeira.
          </p>
        ) : (
          jobs.map((j) => (
            <div key={j.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="min-w-[180px] flex-1">
                <div className="font-semibold">{j.title}</div>
                <Link
                  to="/vagas/$slug"
                  params={{ slug: j.slug }}
                  target="_blank"
                  className="text-xs text-primary hover:underline"
                >
                  /vagas/{j.slug}
                </Link>
              </div>
              <select
                className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                value={j.status}
                onChange={(e) => save.mutate({ id: j.id, status: e.target.value })}
              >
                {["rascunho", "aberta", "pausada", "encerrada"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(j.disc_enabled)}
                  onChange={(e) => save.mutate({ id: j.id, disc_enabled: e.target.checked })}
                />
                Avaliação DISC
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(j.is_test)}
                  onChange={(e) => save.mutate({ id: j.id, is_test: e.target.checked })}
                />
                Vaga de teste
              </label>
            </div>
          ))
        )}
      </div>
      {creating ? (
        <CreateJobDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            onSaved();
          }}
        />
      ) : null}
    </DsCard>
  );
}

function CreateJobDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createFn = useServerFn(createJob);
  const [form, setForm] = useState({
    title: "",
    department: "",
    city: "",
    state: "",
    work_model: "Presencial",
    contract_type: "CLT",
    schedule: "",
    description: "",
    requirements: "",
    benefits: "",
    ask_salary: false,
    ask_cnh: false,
    require_resume: true,
    disc_enabled: true,
    status: "rascunho" as "rascunho" | "aberta",
  });
  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          ...form,
          department: form.department || null,
          city: form.city || null,
          state: form.state || null,
          schedule: form.schedule || null,
          description: form.description || null,
          requirements: form.requirements || null,
          benefits: form.benefits || null,
        },
      }) as any,
    onSuccess: (r: any) => {
      toast.success(`Vaga criada: /vagas/${r?.slug ?? ""}`);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const input = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";
  const area = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-card p-4 shadow-xl sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Nova vaga</h2>
            <p className="text-sm text-muted-foreground">
              O link público é gerado a partir do título. Você pode publicar agora ou deixar em rascunho.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold">Título da vaga *</span>
            <input className={input} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Consultor Comercial" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold">Área / departamento</span>
            <input className={input} value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="Ex.: Comercial" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold">Modelo</span>
            <select className={input} value={form.work_model} onChange={(e) => set("work_model", e.target.value)}>
              {["Presencial", "Híbrido", "Remoto"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold">Cidade</span>
            <input className={input} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Londrina" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold">UF</span>
            <input className={input} maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} placeholder="PR" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold">Contratação</span>
            <select className={input} value={form.contract_type} onChange={(e) => set("contract_type", e.target.value)}>
              {["CLT", "PJ", "Estágio", "Temporário", "Freelance"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold">Horário</span>
            <input className={input} value={form.schedule} onChange={(e) => set("schedule", e.target.value)} placeholder="Ex.: Seg a Sex, 8h às 18h" />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold">Descrição</span>
            <textarea className={area} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold">Requisitos</span>
            <textarea className={area} rows={3} value={form.requirements} onChange={(e) => set("requirements", e.target.value)} />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold">Benefícios</span>
            <textarea className={area} rows={2} value={form.benefits} onChange={(e) => set("benefits", e.target.value)} />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs font-medium">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.require_resume} onChange={(e) => set("require_resume", e.target.checked)} />
            Exigir currículo
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.ask_salary} onChange={(e) => set("ask_salary", e.target.checked)} />
            Perguntar pretensão salarial
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.ask_cnh} onChange={(e) => set("ask_cnh", e.target.checked)} />
            Perguntar CNH
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.disc_enabled} onChange={(e) => set("disc_enabled", e.target.checked)} />
            Avaliação comportamental (DISC)
          </label>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
            Cancelar
          </button>
          <button
            disabled={create.isPending || form.title.trim().length < 3}
            onClick={() => create.mutate()}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Salvar rascunho
          </button>
          <button
            disabled={create.isPending || form.title.trim().length < 3}
            onClick={() => {
              set("status", "aberta");
              setTimeout(() => create.mutate(), 0);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {create.isPending ? "Salvando…" : "Criar e publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Detail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getApplication);
  const stageFn = useServerFn(setApplicationStage);
  const noteFn = useServerFn(addApplicationNote);
  const assignFn = useServerFn(assignApplication);
  const resumeFn = useServerFn(getResumeUrl);
  const resendFn = useServerFn(resendApplicationEmail);
  const inviteFn = useServerFn(createDiscInvite);
  const versionsFn = useServerFn(listDiscVersions);

  const q = useQuery({ queryKey: ["rh_application", id], queryFn: () => getFn({ data: { id } }) as any });
  const versions = useQuery({ queryKey: ["disc_versions"], queryFn: () => versionsFn() as any });
  const [note, setNote] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["rh_application", id] });
    onChanged();
  };
  const run = (p: Promise<any>, ok: string) =>
    p.then(() => {
      toast.success(ok);
      refresh();
    }).catch((e: Error) => toast.error(e.message));

  const a = q.data?.application;
  const activeVersions = (versions.data?.versions ?? []).filter((v: any) => v.status === "active");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto bg-card p-4 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">{a?.full_name ?? "Candidatura"}</h2>
            <p className="text-sm text-muted-foreground">{a?.job_title ?? "Banco de talentos"}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {q.isLoading || !a ? (
          <DsSkeletonList rows={5} />
        ) : (
          <div className="space-y-5 text-sm">
            <section className="rounded-xl border border-border/60 p-3">
              <Row label="E-mail" value={a.email} />
              <Row label="WhatsApp" value={a.phone} />
              <Row label="Cidade" value={[a.city, a.state].filter(Boolean).join(" - ")} />
              <Row label="LinkedIn" value={a.linkedin} />
              <Row label="Inscrição" value={fmt(a.created_at)} />
              <Row label="Origem" value={JSON.stringify(a.origin ?? {})} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={!a.resume_path}
                  onClick={() =>
                    resumeFn({ data: { id } })
                      .then((r: any) => window.open(r.url, "_blank", "noopener"))
                      .catch((e: Error) => toast.error(e.message))
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                >
                  <FileText className="h-3.5 w-3.5" /> {a.resume_path ? "Abrir currículo" : "Sem currículo"}
                </button>
                <button
                  disabled={!a.resume_path}
                  onClick={() =>
                    resumeFn({ data: { id, download: true } })
                      .then((r: any) => window.open(r.url, "_blank", "noopener"))
                      .catch((e: Error) => toast.error(e.message))
                  }
                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  Baixar
                </button>
                <button
                  onClick={() => run(resendFn({ data: { id } }) as any, "Aviso reenviado ao RH.")}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                >
                  <Mail className="h-3.5 w-3.5" /> Reenviar aviso
                </button>
              </div>
            </section>

            <section>
              <h3 className="mb-2 font-semibold">Etapa do processo</h3>
              <select
                className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                value={a.stage}
                onChange={(e) => run(stageFn({ data: { id, stage: e.target.value } }) as any, "Etapa atualizada.")}
              >
                {(q.data?.stages ?? []).map((s: string) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                value={a.assigned_to ?? ""}
                onChange={(e) =>
                  run(assignFn({ data: { id, user_id: e.target.value || null } }) as any, "Responsável definido.")
                }
              >
                <option value="">Sem responsável</option>
                {(qc.getQueryData<any>(["rh_applications", { include_test: false }])?.people ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Mudar de etapa não envia nenhuma mensagem ao candidato.
              </p>
            </section>

            {Object.keys(a.answers ?? {}).length ? (
              <section>
                <h3 className="mb-2 font-semibold">Respostas do formulário</h3>
                {Object.entries(a.answers as Record<string, string>).map(([k, v]) => (
                  <Row key={k} label={k} value={v} />
                ))}
              </section>
            ) : null}

            <section>
              <h3 className="mb-2 font-semibold">Avaliação comportamental (interna, modelo DISC)</h3>
              {(q.data?.responses ?? []).map((r: any) => (
                <div key={r.id} className="mb-2 rounded-xl border border-border/60 p-3">
                  <div className="text-xs text-muted-foreground">
                    Concluída em {fmt(r.completed_at)} · versão {r.snapshot?.version?.name} v
                    {r.snapshot?.version?.version}
                  </div>
                  <div className="mt-2 space-y-1">
                    {["D", "I", "S", "C"].map((k) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="w-4 font-bold">{k}</span>
                        <div className="h-2 flex-1 rounded bg-muted">
                          <div className="h-2 rounded bg-primary" style={{ width: `${r.scores?.percent?.[k] ?? 0}%` }} />
                        </div>
                        <span className="w-14 text-right text-xs">{r.scores?.percent?.[k] ?? 0}%</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Perfil predominante: <strong>{r.scores?.dominant}</strong>. Uso complementar — não substitui a
                    decisão do time de RH.
                  </p>
                </div>
              ))}
              {(q.data?.invites ?? []).map((i: any) => (
                <div key={i.id} className="mb-1 text-xs text-muted-foreground">
                  Convite {i.status} · vence {fmt(i.expires_at)}
                </div>
              ))}
              {activeVersions.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeVersions.map((v: any) => (
                    <button
                      key={v.id}
                      onClick={() =>
                        run(
                          inviteFn({ data: { application_id: id, version_id: v.id, send_email: true } }) as any,
                          "Convite enviado ao candidato.",
                        )
                      }
                      className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                    >
                      Enviar “{v.name}”
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nenhuma versão ativa do questionário.{" "}
                  <Link to="/mod/rh-disc" className="font-semibold text-primary">
                    Configurar
                  </Link>
                  .
                </p>
              )}
            </section>

            <section>
              <h3 className="mb-2 font-semibold">Observações internas</h3>
              <p className="mb-2 text-xs text-muted-foreground">Nunca visíveis ao candidato.</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background p-2 text-sm"
                placeholder="Parecer, combinado, próxima ação..."
              />
              <button
                onClick={() => {
                  if (!note.trim()) return;
                  run(noteFn({ data: { id, body: note } }) as any, "Observação salva.");
                  setNote("");
                }}
                className="mt-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                Salvar observação
              </button>
              <div className="mt-3 space-y-2">
                {(q.data?.notes ?? []).map((n: any) => (
                  <div key={n.id} className="rounded-lg bg-muted/50 p-2 text-xs">
                    <div className="text-muted-foreground">{fmt(n.created_at)}</div>
                    <div className="whitespace-pre-line">{n.body}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 font-semibold">Histórico</h3>
              <div className="space-y-1 text-xs text-muted-foreground">
                {(q.data?.events ?? []).map((e: any) => (
                  <div key={e.id}>
                    {fmt(e.created_at)} — {e.from_stage ?? "início"} → <strong>{e.to_stage}</strong>
                  </div>
                ))}
                {(q.data?.emails ?? []).map((e: any) => (
                  <div key={e.id} className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> {fmt(e.created_at)} — {e.kind} para {e.to_email}:{" "}
                    <strong>{e.status}</strong>
                    {e.error ? ` (${e.error})` : ""}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 border-b border-border/40 py-1 last:border-0">
      <span className="w-28 shrink-0 text-xs uppercase text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-words text-sm">{value}</span>
    </div>
  );
}
