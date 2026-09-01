import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getDiscInvite, submitDiscInvite } from "@/modules/rh/disc-public.functions";

export const Route = createFileRoute("/avaliacao/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Avaliação comportamental — LZ7 Energia" },
      { name: "description", content: "Avaliação comportamental interna do processo seletivo da LZ7 Energia." },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Avaliação comportamental — LZ7 Energia" },
      { property: "og:description", content: "Link individual do processo seletivo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => <Shell><p>Não foi possível abrir a avaliação agora.</p></Shell>,
  notFoundComponent: () => <Shell><p>Link inválido.</p></Shell>,
  component: Page,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl bg-background px-4 py-8">
      <p className="font-display text-lg font-bold">☀️ LZ7 Energia</p>
      <div className="mt-6 text-sm text-muted-foreground">{children}</div>
    </main>
  );
}

function Page() {
  const { token } = Route.useParams();
  const getFn = useServerFn(getDiscInvite);
  const sendFn = useServerFn(submitDiscInvite);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const q = useQuery({ queryKey: ["disc_invite", token], queryFn: () => getFn({ data: { token } }) as any, retry: false });
  const submit = useMutation({
    mutationFn: () => sendFn({ data: { token, answers } }) as any,
    onSuccess: () => setDone(true),
  });

  if (q.isLoading) return <Shell><p>Carregando…</p></Shell>;
  if (done) {
    return (
      <Shell>
        <h1 className="font-display text-xl font-bold text-foreground">Respostas enviadas!</h1>
        <p className="mt-2">Obrigado. O time de gente e gestão da LZ7 vai seguir com o processo e falar com você.</p>
      </Shell>
    );
  }
  const state = q.data?.state;
  if (state === "invalido") return <Shell><p>Este link não existe. Confira o e-mail que você recebeu.</p></Shell>;
  if (state === "expirado")
    return <Shell><p>Este link expirou. Responda o e-mail do RH pedindo um novo convite.</p></Shell>;
  if (state === "concluido")
    return <Shell><p>Esta avaliação já foi respondida. Não é preciso fazer de novo.</p></Shell>;

  const questions: any[] = q.data?.questions ?? [];
  const answered = questions.filter((x) => answers[x.id]).length;
  const progress = questions.length ? Math.round((answered / questions.length) * 100) : 0;

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl bg-background px-4 pb-28 pt-8">
      <p className="font-display text-lg font-bold">☀️ LZ7 Energia</p>
      <h1 className="mt-3 font-display text-2xl font-bold">Avaliação comportamental</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {q.data?.candidate ? `${q.data.candidate}, ` : ""}
        esta é uma avaliação comportamental interna baseada no modelo DISC, de uso complementar no processo
        {q.data?.jobTitle ? ` da vaga ${q.data.jobTitle}` : ""}. Não é teste psicológico validado e não decide sozinha
        o resultado. Não existe resposta certa: escolha a alternativa mais parecida com você.
      </p>
      {q.data?.version?.instructions ? (
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{q.data.version.instructions}</p>
      ) : null}

      <div className="mt-6 space-y-5">
        {questions.map((question, idx) => (
          <fieldset key={question.id} className="rounded-2xl border border-border p-4">
            <legend className="px-1 text-xs font-bold uppercase text-muted-foreground">
              {idx + 1} de {questions.length}
            </legend>
            <p className="font-semibold">{question.prompt}</p>
            {question.help ? <p className="mt-1 text-xs text-muted-foreground">{question.help}</p> : null}
            <div className="mt-3 space-y-2">
              {question.options.map((o: any) => (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${
                    answers[question.id] === o.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    checked={answers[question.id] === o.id}
                    onChange={() => setAnswers((a) => ({ ...a, [question.id]: o.id }))}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {submit.error ? (
        <p className="mt-4 text-sm text-destructive">{(submit.error as Error).message}</p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <div className="mb-2 h-1.5 rounded bg-muted">
            <div className="h-1.5 rounded bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <button
            disabled={answered < questions.length || submit.isPending}
            onClick={() => submit.mutate()}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            {submit.isPending
              ? "Enviando…"
              : answered < questions.length
                ? `Faltam ${questions.length - answered} respostas`
                : "Enviar respostas"}
          </button>
        </div>
      </div>
    </main>
  );
}
