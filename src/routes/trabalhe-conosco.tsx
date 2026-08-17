import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { listJobs } from "@/modules/site/public.functions";
import { PublicLayout, PageHero, Section, EmptyState } from "@/components/site/public-layout";
import { Field, Honeypot, Consent, SuccessBox, useOrigin } from "@/components/site/site-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const TITLE = "Trabalhe conosco — vagas na LZ7 Energia";
const DESCRIPTION =
  "Veja as vagas abertas na LZ7 Energia e cadastre seu currículo no nosso banco de talentos.";
const URL = "https://lz7energia.com.br/trabalhe-conosco";

const jobsQuery = { queryKey: ["site_jobs"], queryFn: () => listJobs(), staleTime: 5 * 60_000 };

export const Route = createFileRoute("/trabalhe-conosco")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(jobsQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: Page,
});

function Page() {
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Carreiras"
        title="Trabalhe conosco"
        subtitle="Faça parte de um time que leva energia limpa para milhares de famílias e empresas."
        breadcrumbs={[{ label: "Trabalhe conosco" }]}
      />

      <Section title="Vagas abertas">
        {jobs.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {jobs.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => {
                  setSelected(j);
                  document.getElementById("candidatura")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`rounded-2xl border p-6 text-left transition ${
                  selected?.id === j.id ? "border-lzgreen bg-lzgreen/5" : "border-border bg-white hover:shadow-md"
                }`}
              >
                <h3 className="font-display text-lg font-semibold">{j.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[j.department, [j.city, j.state].filter(Boolean).join(" - "), j.work_model, j.contract_type]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {j.status === "pausada" ? (
                  <p className="mt-2 text-xs font-semibold uppercase text-amber-600">Processo pausado</p>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhuma vaga aberta no momento"
            description="Cadastre seu currículo no banco de talentos e avisaremos quando surgir uma oportunidade."
          />
        )}
      </Section>

      <Section tone="muted" id="candidatura">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold">
            {selected ? `Candidatar-se: ${selected.title}` : "Banco de talentos"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected
              ? "Preencha seus dados e anexe seu currículo."
              : "Não encontrou uma vaga? Cadastre seu currículo e entraremos em contato quando abrir uma oportunidade."}
          </p>
          {selected ? (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-2 text-xs font-semibold text-lzgreen-strong hover:underline"
            >
              Cadastrar no banco de talentos
            </button>
          ) : null}
          <div className="mt-5">
            <ApplicationForm job={selected} />
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}

function ApplicationForm({ job }: { job: Record<string, any> | null }) {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const origin = useOrigin();

  if (done) {
    return (
      <SuccessBox
        title="Candidatura enviada!"
        description="Nosso time de gente e gestão vai analisar seu perfil. Boa sorte!"
      />
    );
  }

  return (
    <form
      className="relative space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (fd.get("consent") !== "on") {
          toast.error("É necessário aceitar a política de privacidade.");
          return;
        }
        fd.set("consent", "true");
        fd.set("kind", job ? "vaga" : "talentos");
        if (job) {
          fd.set("job_id", String(job.id));
          fd.set("job_title", String(job.title));
        }
        fd.set("origin", JSON.stringify(origin()));
        setSending(true);
        try {
          const res = await fetch("/api/public/candidatura", { method: "POST", body: fd });
          const json = (await res.json()) as { ok?: boolean; error?: string };
          if (!res.ok || !json.ok) throw new Error(json.error ?? "Não foi possível enviar sua candidatura.");
          setDone(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Não foi possível enviar agora.");
        } finally {
          setSending(false);
        }
      }}
    >
      <Honeypot />
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
          <Input id="a-linkedin" name="linkedin" />
        </Field>
        {!job ? (
          <Field label="Área de interesse" htmlFor="a-area">
            <Input id="a-area" name="interest_area" placeholder="Ex.: vendas, instalação, administrativo" />
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
          <input type="checkbox" name="has_cnh" value="true" className="h-4 w-4" /> Possuo CNH válida
        </label>
      ) : null}
      <Field label="Resumo da sua experiência" htmlFor="a-exp">
        <Textarea id="a-exp" name="experience" rows={4} maxLength={4000} />
      </Field>
      <Field label="Currículo (PDF ou DOC, até 5 MB)" htmlFor="a-cv" required={job?.require_resume}>
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
        {sending ? "Enviando..." : "Enviar candidatura"}
      </Button>
    </form>
  );
}
