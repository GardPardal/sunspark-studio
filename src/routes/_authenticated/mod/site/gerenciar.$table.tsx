import { useMemo, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ModuleShell } from "@/modules/shared/module-shell";
import { DsCard, DsCardHeader } from "@/components/ds/card";
import { DsButton } from "@/components/ds/button";
import { DsBadge } from "@/components/ds/badge";
import { DsEmpty } from "@/components/ds/empty";
import { DsSkeletonList } from "@/components/ds/skeleton";
import { cmsList, cmsSave, cmsDelete, CMS_TABLES } from "@/modules/site/admin.functions";
import { CMS_SCHEMA, type Field } from "@/modules/site/cms.schema";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/site/gerenciar/$table")({
  head: () => ({
    meta: [
      { title: "Gerenciar conteúdo — CMS LZ7" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const input =
  "w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function toInput(field: Field, v: any): string {
  if (v == null) return "";
  if (field.type === "json") return typeof v === "string" ? v : JSON.stringify(v, null, 2);
  if (field.type === "date") return String(v).slice(0, 10);
  return String(v);
}

function fromInput(field: Field, raw: string): any {
  const s = raw.trim();
  if (field.type === "number") return s === "" ? null : Number(s);
  if (field.type === "date") return s === "" ? null : s;
  if (field.type === "json") {
    if (s === "") return null;
    return JSON.parse(s);
  }
  return s === "" ? null : raw;
}

function Page() {
  const { table } = useParams({ from: "/_authenticated/mod/site/gerenciar/$table" });
  const valid = (CMS_TABLES as readonly string[]).includes(table);
  const schema = valid ? CMS_SCHEMA[table as keyof typeof CMS_SCHEMA] : null;

  const qc = useQueryClient();
  const listFn = useServerFn(cmsList);
  const saveFn = useServerFn(cmsSave);
  const delFn = useServerFn(cmsDelete);

  const q = useQuery({
    queryKey: ["cms", table],
    queryFn: () => listFn({ data: { table } }) as unknown as Promise<Array<Record<string, any>>>,
    enabled: valid,
  });

  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [bools, setBools] = useState<Record<string, boolean>>({});

  const openEditor = (row: Record<string, any> | null) => {
    if (!schema) return;
    const v: Record<string, string> = {};
    const b: Record<string, boolean> = {};
    for (const f of schema.fields) {
      if (f.type === "bool") b[f.key] = Boolean(row?.[f.key]);
      else v[f.key] = toInput(f, row?.[f.key]);
    }
    setValues(v);
    setBools(b);
    setEditing(row ?? {});
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!schema) return;
      const payload: Record<string, any> = {};
      for (const f of schema.fields) {
        if (f.type === "bool") payload[f.key] = bools[f.key] ?? false;
        else {
          try {
            payload[f.key] = fromInput(f, values[f.key] ?? "");
          } catch {
            throw new Error(`O campo "${f.label}" não está em formato JSON válido.`);
          }
        }
        if (f.required && !payload[f.key]) throw new Error(`Preencha o campo "${f.label}".`);
      }
      await saveFn({ data: { table, id: editing?.id ?? null, values: payload } });
    },
    onSuccess: () => {
      toast.success("Conteúdo salvo.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["cms", table] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await delFn({ data: { table, id } });
    },
    onSuccess: () => {
      toast.success("Registro removido.");
      qc.invalidateQueries({ queryKey: ["cms", table] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível remover."),
  });

  const rows = q.data ?? [];
  const columns = useMemo(() => schema?.columns ?? [], [schema]);

  if (!schema) {
    return (
      <ModuleShell title="CMS do Site" subtitle="Recurso não encontrado" active="admin">
        <DsEmpty title="Recurso inválido" description="Este conteúdo não existe no CMS." />
      </ModuleShell>
    );
  }

  return (
    <ModuleShell title={schema.label} subtitle={schema.description} active="admin">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link to="/mod/site" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> CMS do site
          </Link>
          <DsButton onClick={() => openEditor(null)}>
            <Plus className="h-4 w-4" /> Nova {schema.singular}
          </DsButton>
        </div>

        <DsCard>
          <DsCardHeader title={`${rows.length} registro(s)`} subtitle="Clique para editar" />
          <div className="p-3">
            {q.isLoading ? (
              <DsSkeletonList rows={4} />
            ) : rows.length === 0 ? (
              <DsEmpty title="Nada por aqui ainda" description={`Crie a primeira ${schema.singular}.`} />
            ) : (
              <div className="space-y-2">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background p-3"
                  >
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEditor(r)}>
                      <p className="truncate text-sm font-semibold">
                        {String(r[columns[0]] ?? r.title ?? r.name ?? r.id)}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {columns.slice(1).map((c) => {
                          const v = r[c];
                          if (v == null || v === "") return null;
                          if (typeof v === "boolean")
                            return (
                              <DsBadge key={c} size="sm" intent={v ? "success" : "neutral"}>
                                {c === "published" ? (v ? "publicado" : "rascunho") : `${c}: ${v}`}
                              </DsBadge>
                            );
                          return <span key={c}>{String(v).slice(0, 40)}</span>;
                        })}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label="Remover"
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        if (confirm("Remover este registro definitivamente?")) remove.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DsCard>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-card p-4 shadow-xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">
                {editing.id ? `Editar ${schema.singular}` : `Nova ${schema.singular}`}
              </h2>
              <button type="button" aria-label="Fechar" onClick={() => setEditing(null)} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {schema.fields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor={`f-${f.key}`}>
                    {f.label}
                    {f.required ? " *" : ""}
                  </label>
                  {f.type === "bool" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        id={`f-${f.key}`}
                        type="checkbox"
                        checked={bools[f.key] ?? false}
                        onChange={(e) => setBools((s) => ({ ...s, [f.key]: e.target.checked }))}
                        className="h-4 w-4 rounded border-border"
                      />
                      Ativo
                    </label>
                  ) : f.type === "select" ? (
                    <select
                      id={`f-${f.key}`}
                      className={input}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                    >
                      <option value="">—</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" || f.type === "long" || f.type === "json" ? (
                    <textarea
                      id={`f-${f.key}`}
                      className={`${input} font-${f.type === "json" ? "mono" : "sans"}`}
                      rows={f.type === "long" ? 6 : f.type === "json" ? 5 : 3}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      id={`f-${f.key}`}
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      className={input}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                    />
                  )}
                  {f.hint ? <p className="mt-1 text-[11px] text-muted-foreground">{f.hint}</p> : null}
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 mt-4 flex gap-2 bg-card pt-3">
              <DsButton onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">
                {save.isPending ? "Salvando..." : "Salvar"}
              </DsButton>
              <DsButton emphasis="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </DsButton>
            </div>
          </div>
        </div>
      ) : null}
    </ModuleShell>
  );
}
