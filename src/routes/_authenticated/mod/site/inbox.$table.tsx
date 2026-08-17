import { useState } from "react";
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
import { inboxList, inboxUpdate, resumeSignedUrl, INBOX_TABLES } from "@/modules/site/admin.functions";
import { INBOX_SCHEMA } from "@/modules/site/cms.schema";
import { ArrowLeft, FileText, MessageCircle, Phone, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/site/inbox/$table")({
  head: () => ({
    meta: [
      { title: "Caixa de entrada do site — Solar OS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const HIDDEN = ["id", "created_at", "updated_at", "resume_path"];

function Page() {
  const { table } = useParams({ from: "/_authenticated/mod/site/inbox/$table" });
  const valid = (INBOX_TABLES as readonly string[]).includes(table);
  const schema = valid ? INBOX_SCHEMA[table as keyof typeof INBOX_SCHEMA] : null;

  const qc = useQueryClient();
  const listFn = useServerFn(inboxList);
  const updateFn = useServerFn(inboxUpdate);
  const resumeFn = useServerFn(resumeSignedUrl);

  const q = useQuery({
    queryKey: ["inbox", table],
    queryFn: () => listFn({ data: { table } }) as unknown as Promise<Array<Record<string, any>>>,
    enabled: valid,
  });

  const [open, setOpen] = useState<Record<string, any> | null>(null);
  const [notes, setNotes] = useState("");

  const update = useMutation({
    mutationFn: async (p: { id: string; values: Record<string, any> }) => {
      await updateFn({ data: { table, id: p.id, values: p.values } });
    },
    onSuccess: () => {
      toast.success("Atualizado.");
      qc.invalidateQueries({ queryKey: ["inbox", table] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar."),
  });

  const openResume = async (path: string) => {
    try {
      const r = (await resumeFn({ data: { path } })) as unknown as { url: string };
      window.open(r.url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível abrir o currículo.");
    }
  };

  if (!schema) {
    return (
      <ModuleShell title="Caixa de entrada" subtitle="Recurso não encontrado" active="admin">
        <DsEmpty title="Recurso inválido" description="Esta caixa de entrada não existe." />
      </ModuleShell>
    );
  }

  const rows = q.data ?? [];

  return (
    <ModuleShell title={schema.label} subtitle={schema.description} active="admin">
      <div className="space-y-4">
        <Link to="/mod/site" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> CMS do site
        </Link>

        <DsCard>
          <DsCardHeader title={`${rows.length} envio(s)`} subtitle="Mais recentes primeiro" />
          <div className="p-3">
            {q.isLoading ? (
              <DsSkeletonList rows={4} />
            ) : rows.length === 0 ? (
              <DsEmpty title="Nenhum envio ainda" description="Assim que o site receber envios, eles aparecem aqui." />
            ) : (
              <div className="space-y-2">
                {rows.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setOpen(r);
                      setNotes(r.internal_notes ?? "");
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-background p-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {String(r[schema.columns[0]] ?? r.email ?? r.id)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {schema.columns
                          .slice(1, 4)
                          .map((c) => r[c])
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <DsBadge size="sm" intent={r.status === "novo" ? "danger" : "neutral"}>
                      {String(r.status ?? "—")}
                    </DsBadge>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DsCard>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-card p-4 shadow-xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Detalhes do envio</h2>
              <button type="button" aria-label="Fechar" onClick={() => setOpen(null)} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="space-y-1.5 text-sm">
              {Object.entries(open)
                .filter(([k, v]) => !HIDDEN.includes(k) && v != null && v !== "" && k !== "internal_notes")
                .map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-40 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 flex-1 break-words">
                      {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </dd>
                  </div>
                ))}
            </dl>

            <div className="mt-3 flex flex-wrap gap-2">
              {open.phone ? (
                <>
                  <a
                    href={`tel:${String(open.phone).replace(/\D/g, "")}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 px-3 py-2 text-sm"
                  >
                    <Phone className="h-4 w-4" /> Ligar
                  </a>
                  <a
                    href={`https://wa.me/55${String(open.phone).replace(/\D/g, "").replace(/^55/, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 px-3 py-2 text-sm"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                </>
              ) : null}
              {open.resume_path ? (
                <button
                  type="button"
                  onClick={() => openResume(open.resume_path)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 px-3 py-2 text-sm"
                >
                  <FileText className="h-4 w-4" /> Abrir currículo
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground" htmlFor="inbox-status">
                Situação
              </label>
              <select
                id="inbox-status"
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm"
                value={open.status ?? ""}
                onChange={(e) => {
                  const status = e.target.value;
                  setOpen({ ...open, status });
                  update.mutate({ id: open.id, values: { status } });
                }}
              >
                {schema.statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <label className="block text-xs font-semibold text-muted-foreground" htmlFor="inbox-notes">
                Notas internas
              </label>
              <textarea
                id="inbox-notes"
                rows={3}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <DsButton
                fullWidth
                disabled={update.isPending}
                onClick={() => update.mutate({ id: open.id, values: { internal_notes: notes } })}
              >
                {update.isPending ? "Salvando..." : "Salvar notas"}
              </DsButton>
            </div>
          </div>
        </div>
      ) : null}
    </ModuleShell>
  );
}
