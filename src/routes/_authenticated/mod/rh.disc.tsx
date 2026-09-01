import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteDiscQuestion,
  listDiscVersions,
  saveDiscQuestion,
  saveDiscVersion,
} from "@/modules/rh/rh.functions";
import { ModuleShell } from "@/modules/shared/module-shell";
import { DsCard, DsCardHeader } from "@/components/ds/card";
import { DsAlert } from "@/components/ds/alert";
import { DsSkeletonList } from "@/components/ds/skeleton";

export const Route = createFileRoute("/_authenticated/mod/rh/disc")({
  head: () => ({
    meta: [
      { title: "RH — Avaliação comportamental (DISC)" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const DIMS = ["D", "I", "S", "C"] as const;
type Draft = {
  id?: string;
  prompt: string;
  help: string;
  options: Array<{ id?: string; label: string; dimension: (typeof DIMS)[number]; weight: number }>;
};

const emptyDraft = (): Draft => ({
  prompt: "",
  help: "",
  options: DIMS.map((d) => ({ label: "", dimension: d, weight: 1 })),
});

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDiscVersions);
  const saveVersionFn = useServerFn(saveDiscVersion);
  const saveQuestionFn = useServerFn(saveDiscQuestion);
  const deleteQuestionFn = useServerFn(deleteDiscQuestion);

  const q = useQuery({ queryKey: ["disc_versions"], queryFn: () => listFn() as any });
  const [versionId, setVersionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const versions: any[] = q.data?.versions ?? [];
  const current = versions.find((v) => v.id === versionId) ?? versions[0] ?? null;
  const questions = (q.data?.questions ?? []).filter((x: any) => x.version_id === current?.id);
  const options = q.data?.options ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["disc_versions"] });
  const mut = (fn: Promise<any>, ok: string) =>
    fn.then(() => {
      toast.success(ok);
      refresh();
    }).catch((e: Error) => toast.error(e.message));

  const createVersion = useMutation({
    mutationFn: () =>
      saveVersionFn({
        data: {
          name: `Questionário LZ7 ${new Date().getFullYear()}`,
          version: (versions[0]?.version ?? 0) + 1,
          status: "draft",
        },
      }) as any,
    onSuccess: () => {
      toast.success("Nova versão criada em rascunho.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ModuleShell title="Avaliação comportamental" subtitle="Questionário interno baseado no modelo DISC" active="rh">
      <DsAlert tone="warning" title="Uso responsável">
        Avaliação comportamental interna, de uso complementar. Não é teste psicológico validado nem diagnóstico, e o
        resultado não pode aprovar, reprovar ou classificar candidatos automaticamente — a decisão continua com o RH.
      </DsAlert>

      <DsCard>
        <DsCardHeader
          title="Versões do questionário"
          subtitle="Respostas antigas ficam congeladas na versão usada"
          right={
            <button
              onClick={() => createVersion.mutate()}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              Nova versão
            </button>
          }
        />
        <div className="p-3">
          {q.isLoading ? (
            <DsSkeletonList rows={2} />
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma versão criada. Comece por “Nova versão”, cadastre as perguntas e depois ative.
            </p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 p-3">
                  <button
                    onClick={() => setVersionId(v.id)}
                    className={`flex-1 text-left text-sm font-semibold ${current?.id === v.id ? "text-primary" : ""}`}
                  >
                    {v.name} · v{v.version}
                  </button>
                  <select
                    className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
                    value={v.status}
                    onChange={(e) =>
                      mut(
                        saveVersionFn({ data: { id: v.id, name: v.name, status: e.target.value as any } }) as any,
                        "Status atualizado.",
                      )
                    }
                  >
                    <option value="draft">Rascunho</option>
                    <option value="active">Ativa</option>
                    <option value="archived">Arquivada</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </DsCard>

      {current ? (
        <DsCard>
          <DsCardHeader
            title={`Perguntas — ${current.name} v${current.version}`}
            subtitle={current.scoring_rule}
          />
          <div className="space-y-3 p-3">
            <textarea
              defaultValue={current.instructions ?? ""}
              placeholder="Instruções mostradas ao candidato (opcional)"
              rows={2}
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
              onBlur={(e) =>
                mut(
                  saveVersionFn({
                    data: { id: current.id, name: current.name, instructions: e.target.value || null },
                  }) as any,
                  "Instruções salvas.",
                )
              }
            />

            {questions.map((question: any, idx: number) => (
              <div key={question.id} className="rounded-xl border border-border/60 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">
                    {idx + 1}. {question.prompt}
                  </p>
                  <button
                    onClick={() =>
                      mut(
                        deleteQuestionFn({ data: { id: question.id, version_id: current.id } }) as any,
                        "Pergunta removida.",
                      )
                    }
                    className="text-xs font-semibold text-destructive"
                  >
                    remover
                  </button>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {options
                    .filter((o: any) => o.question_id === question.id)
                    .map((o: any) => (
                      <li key={o.id}>
                        <strong>{o.dimension}</strong> · peso {o.weight} — {o.label}
                      </li>
                    ))}
                </ul>
              </div>
            ))}

            <div className="rounded-xl border border-dashed border-border p-3">
              <p className="mb-2 text-sm font-semibold">Nova pergunta</p>
              <input
                value={draft.prompt}
                onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                placeholder="Enunciado"
                className="mb-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              />
              <input
                value={draft.help}
                onChange={(e) => setDraft((d) => ({ ...d, help: e.target.value }))}
                placeholder="Ajuda (opcional)"
                className="mb-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              />
              {draft.options.map((o, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <select
                    value={o.dimension}
                    onChange={(e) =>
                      setDraft((d) => {
                        const options = [...d.options];
                        options[i] = { ...options[i], dimension: e.target.value as any };
                        return { ...d, options };
                      })
                    }
                    className="h-9 w-16 rounded-lg border border-border bg-background px-1 text-sm"
                  >
                    {DIMS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                  <input
                    value={o.label}
                    onChange={(e) =>
                      setDraft((d) => {
                        const options = [...d.options];
                        options[i] = { ...options[i], label: e.target.value };
                        return { ...d, options };
                      })
                    }
                    placeholder={`Alternativa ${o.dimension}`}
                    className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={o.weight}
                    onChange={(e) =>
                      setDraft((d) => {
                        const options = [...d.options];
                        options[i] = { ...options[i], weight: Number(e.target.value) };
                        return { ...d, options };
                      })
                    }
                    className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-sm"
                  />
                </div>
              ))}
              <button
                onClick={() => {
                  const options = draft.options.filter((o) => o.label.trim());
                  if (draft.prompt.trim().length < 3 || options.length < 2) {
                    toast.error("Escreva o enunciado e ao menos duas alternativas.");
                    return;
                  }
                  mut(
                    saveQuestionFn({
                      data: {
                        version_id: current.id,
                        prompt: draft.prompt,
                        help: draft.help || null,
                        ordem: questions.length,
                        options,
                      },
                    }) as any,
                    "Pergunta cadastrada.",
                  ).then(() => setDraft(emptyDraft()));
                }}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                Adicionar pergunta
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Regra de pontuação: {current.scoring_rule}
            </p>
            <Link to="/mod/rh" className="inline-block text-xs font-semibold text-primary">
              ← Voltar às candidaturas
            </Link>
          </div>
        </DsCard>
      ) : null}
    </ModuleShell>
  );
}
