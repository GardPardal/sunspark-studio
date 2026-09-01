import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { listRhQuestions } from "@/modules/site/public.functions";
import { Field, Honeypot, Consent, SuccessBox, useOrigin } from "@/components/site/site-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const rhQuestionsQuery = {
  queryKey: ["site_rh_questions"],
  queryFn: () => listRhQuestions(),
  staleTime: 5 * 60_000,
};

type Question = {
  id: string;
  label: string;
  help?: string | null;
  field_type: string;
  options?: unknown;
  required?: boolean | null;
  scope?: string | null;
};

function asOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((o) => String(o));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((o) => String(o)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Formulário de candidatura: campos fixos + perguntas configuradas pelo RH. */
export function ResumeForm({ job }: { job: Record<string, any> | null }) {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [submissionKey, setSubmissionKey] = useState(() => crypto.randomUUID());
  const origin = useOrigin();
  const { data: questions = [] } = useQuery(rhQuestionsQuery);

  const scope = job ? "vaga" : "talentos";
  const visible = (questions as Question[]).filter(
    (q) => !q.scope || q.scope === "ambos" || q.scope === scope,
  );

  if (done) {
    return (
      <SuccessBox
        title="Candidatura recebida!"
        description="Seus dados e o currículo foram salvos. Nosso time de gente e gestão vai analisar seu perfil e entrar em contato pelo WhatsApp ou e-mail informado."
      />
    );
  }

  return (
    <form
      className="relative space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const formEl = e.currentTarget;
        const fd = new FormData(formEl);
        if (fd.get("consent") !== "on") {
          toast.error("É necessário aceitar a política de privacidade.");
          return;
        }
        fd.set("consent", "true");
        fd.set("kind", job ? "vaga" : "talentos");
        fd.set("submission_key", submissionKey);
        if (job) {
          fd.set("job_id", String(job.id));
          fd.set("job_title", String(job.title));
        }

        const answers: Record<string, string> = {};
        for (const q of visible) {
          const raw = fd.get(`q_${q.id}`);
          const value = q.field_type === "bool" ? (raw ? "Sim" : "Não") : String(raw ?? "").trim();
          if (value) answers[q.label] = value;
          fd.delete(`q_${q.id}`);
        }
        fd.set("answers", JSON.stringify(answers));
        fd.set("origin", JSON.stringify(origin()));

        setSending(true);
        try {
          const res = await fetch("/api/public/candidatura", { method: "POST", body: fd });
          const json = (await res.json()) as { ok?: boolean; error?: string };
          if (!res.ok || !json.ok)
            throw new Error(json.error ?? "Não foi possível enviar sua candidatura.");
          setSubmissionKey(crypto.randomUUID());
          setDone(true);
        } catch (err) {
          // Mantém tudo preenchido: a pessoa só reenvia, sem digitar de novo.
          toast.error(
            err instanceof Error
              ? err.message
              : "Não foi possível enviar agora. Toque em enviar novamente.",
          );
        } finally {
          setSending(false);
        }
      }}
    >
      <Honeypot />

      <fieldset className="space-y-4">
        <legend className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Seus dados
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" htmlFor="a-nome" required>
            <Input id="a-nome" name="full_name" autoComplete="name" required minLength={2} />
          </Field>
          <Field label="WhatsApp" htmlFor="a-tel" required>
            <Input id="a-tel" name="phone" type="tel" autoComplete="tel" required />
          </Field>
          <Field label="E-mail" htmlFor="a-email" required>
            <Input id="a-email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Cidade" htmlFor="a-cidade">
            <Input id="a-cidade" name="city" autoComplete="address-level2" />
          </Field>
          <Field label="Estado" htmlFor="a-estado">
            <Input id="a-estado" name="state" />
          </Field>
          <Field label="LinkedIn" htmlFor="a-linkedin">
            <Input id="a-linkedin" name="linkedin" placeholder="https://linkedin.com/in/..." />
          </Field>
          {!job ? (
            <Field label="Área de interesse" htmlFor="a-area">
              <Input
                id="a-area"
                name="interest_area"
                placeholder="Ex.: vendas, instalação, administrativo"
              />
            </Field>
          ) : null}
          {job?.ask_salary ? (
            <Field label="Pretensão salarial" htmlFor="a-salario">
              <Input id="a-salario" name="salary_expectation" />
            </Field>
          ) : null}
        </div>
        {job?.ask_cnh ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="has_cnh" value="true" className="h-4 w-4" /> Possuo CNH
            válida
          </label>
        ) : null}
      </fieldset>

      {visible.length ? (
        <fieldset className="space-y-4 rounded-2xl border border-border bg-muted/30 p-5">
          <legend className="px-2 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sobre você
          </legend>
          {visible.map((q) => {
            const id = `q_${q.id}`;
            const options = asOptions(q.options);
            return (
              <Field
                key={q.id}
                label={q.label}
                htmlFor={id}
                required={Boolean(q.required)}
                hint={q.help ?? undefined}
              >
                {q.field_type === "textarea" ? (
                  <Textarea
                    id={id}
                    name={id}
                    rows={3}
                    maxLength={2000}
                    required={Boolean(q.required)}
                  />
                ) : q.field_type === "select" ? (
                  <select
                    id={id}
                    name={id}
                    required={Boolean(q.required)}
                    className={selectClass}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : q.field_type === "bool" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input id={id} name={id} type="checkbox" value="Sim" className="h-4 w-4" /> Sim
                  </label>
                ) : (
                  <Input
                    id={id}
                    name={id}
                    type={
                      q.field_type === "number"
                        ? "number"
                        : q.field_type === "date"
                          ? "date"
                          : "text"
                    }
                    required={Boolean(q.required)}
                  />
                )}
              </Field>
            );
          })}
        </fieldset>
      ) : null}

      <Field label="Resumo da sua experiência" htmlFor="a-exp">
        <Textarea id="a-exp" name="experience" rows={4} maxLength={4000} />
      </Field>

      <Field
        label="Currículo (PDF ou DOC, até 5 MB)"
        htmlFor="a-cv"
        required={Boolean(job?.require_resume)}
      >
        <input
          id="a-cv"
          name="resume"
          type="file"
          accept=".pdf,.doc,.docx"
          required={Boolean(job?.require_resume)}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-4 file:py-2 file:text-sm file:font-medium"
        />
      </Field>

      <Consent id="a-consent" />

      <Button
        type="submit"
        disabled={sending}
        className="w-full bg-lzgreen font-display font-semibold text-navy-deep hover:bg-lzgreen-strong hover:text-white"
      >
        {sending ? "Enviando..." : job ? "Enviar candidatura" : "Cadastrar currículo"}
      </Button>
    </form>
  );
}
