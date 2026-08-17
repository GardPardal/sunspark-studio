import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPersistedAttribution, trackLeadConversion } from "@/lib/tracking";
import { trackEvent } from "./whatsapp-gate";
import {
  submitContact,
  submitPartner,
  submitQuote,
  subscribeNewsletter,
} from "@/modules/site/public.functions";
import { BILL_RANGES, CONTACT_SUBJECTS, PARTNERSHIP_TYPES } from "@/modules/site/site.shared";

export function useOrigin() {
  return () => {
    const a = getPersistedAttribution();
    return {
      page: typeof window !== "undefined" ? window.location.pathname : "",
      url: typeof window !== "undefined" ? window.location.href : "",
      referrer: a.referrer ?? "",
      utm_source: a.utm_source ?? "",
      utm_medium: a.utm_medium ?? "",
      utm_campaign: a.utm_campaign ?? "",
      utm_content: a.utm_content ?? "",
      utm_term: a.utm_term ?? "",
      gclid: a.gclid ?? "",
      fbclid: a.fbclid ?? "",
      fbp: a.fbp ?? "",
      fbc: a.fbc ?? "",
    };
  };
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="text-sm">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
      <label htmlFor="company_website">Não preencha</label>
      <input id="company_website" name="hp" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

export function Consent({ id = "consent" }: { id?: string }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
      <input id={id} name="consent" type="checkbox" required className="mt-0.5 h-4 w-4 accent-[oklch(0.7_0.19_145)]" />
      <span>
        Autorizo o contato da LZ7 Energia e o tratamento dos meus dados conforme a{" "}
        <a href="/politica-de-privacidade" className="underline hover:text-foreground">
          Política de Privacidade
        </a>
        .
      </span>
    </label>
  );
}

export function SuccessBox({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-lzgreen/40 bg-lzgreen/10 p-6 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-lzgreen-strong" aria-hidden="true" />
      <p className="mt-3 font-display text-lg font-semibold">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

const nativeSelect =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function readForm(e: React.FormEvent<HTMLFormElement>) {
  const fd = new FormData(e.currentTarget);
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  return { fd, get, consent: fd.get("consent") === "on", hp: get("hp") };
}

/* ----------------------------- ORÇAMENTO --------------------------------- */

export function QuoteForm({
  origem,
  produto,
  compact,
}: {
  origem: string;
  produto?: string;
  compact?: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const origin = useOrigin();

  if (done) {
    return (
      <SuccessBox
        title="Solicitação enviada!"
        description="Um especialista da LZ7 vai entrar em contato em breve pelo WhatsApp."
      />
    );
  }

  return (
    <form
      className="relative space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const { get, consent, hp } = readForm(e);
        if (!consent) return toast.error("É necessário aceitar a política de privacidade.");
        setSending(true);
        try {
          await submitQuote({
            data: {
              nome: get("nome"),
              telefone: get("telefone"),
              email: get("email"),
              cidade: get("cidade"),
              estado: get("estado"),
              valor_conta: get("valor_conta"),
              mensagem: get("mensagem"),
              produto_interesse: produto ?? "",
              origem,
              consent: true,
              hp,
              origin: origin(),
            },
          });
          trackLeadConversion({ value: 50, currency: "BRL" });
          trackEvent("generate_lead", { location: origem });
          setDone(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Não foi possível enviar agora.");
        } finally {
          setSending(false);
        }
      }}
    >
      <Honeypot />
      <div className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>
        <Field label="Nome" htmlFor="q-nome" required>
          <Input id="q-nome" name="nome" autoComplete="name" required minLength={2} maxLength={120} />
        </Field>
        <Field label="WhatsApp" htmlFor="q-tel" required>
          <Input id="q-tel" name="telefone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="(43) 99999-9999" />
        </Field>
        <Field label="E-mail" htmlFor="q-email">
          <Input id="q-email" name="email" type="email" autoComplete="email" maxLength={160} />
        </Field>
        <Field label="Cidade" htmlFor="q-cidade">
          <Input id="q-cidade" name="cidade" autoComplete="address-level2" maxLength={120} />
        </Field>
        <Field label="Estado" htmlFor="q-estado">
          <select id="q-estado" name="estado" className={nativeSelect} defaultValue="">
            <option value="">Selecione</option>
            <option value="PR">Paraná</option>
            <option value="SP">São Paulo</option>
            <option value="Outro">Outro</option>
          </select>
        </Field>
        <Field label="Média da conta de luz" htmlFor="q-conta">
          <select id="q-conta" name="valor_conta" className={nativeSelect} defaultValue="">
            <option value="">Selecione</option>
            {BILL_RANGES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Mensagem" htmlFor="q-msg">
        <Textarea id="q-msg" name="mensagem" rows={3} maxLength={2000} placeholder="Conte um pouco sobre o seu projeto (opcional)" />
      </Field>
      <Consent id="q-consent" />
      <Button
        type="submit"
        disabled={sending}
        className="w-full bg-lzgreen font-display font-semibold text-navy-deep hover:bg-lzgreen-strong hover:text-white"
      >
        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Quero meu orçamento
      </Button>
    </form>
  );
}

/* ------------------------------ CONTATO ---------------------------------- */

export function ContactForm({ defaultSubject }: { defaultSubject?: string }) {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [subject, setSubject] = useState(defaultSubject ?? "orcamento");
  const origin = useOrigin();

  if (done) {
    return <SuccessBox title="Mensagem enviada!" description="Nossa equipe responde em até 1 dia útil." />;
  }

  return (
    <form
      className="relative space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const { get, consent, hp } = readForm(e);
        if (!consent) return toast.error("É necessário aceitar a política de privacidade.");
        setSending(true);
        try {
          const routed = CONTACT_SUBJECTS.find((s) => s.value === subject)?.routed_to;
          await submitContact({
            data: {
              subject_type: subject,
              routed_to: routed,
              nome: get("nome"),
              telefone: get("telefone"),
              email: get("email"),
              cidade: get("cidade"),
              mensagem: get("mensagem"),
              consent: true,
              hp,
              origin: origin(),
            },
          });
          trackEvent("contact_submit", { subject });
          setDone(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Não foi possível enviar agora.");
        } finally {
          setSending(false);
        }
      }}
    >
      <Honeypot />
      <Field label="Assunto" htmlFor="c-assunto" required>
        <select
          id="c-assunto"
          className={nativeSelect}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          {CONTACT_SUBJECTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="c-nome" required>
          <Input id="c-nome" name="nome" autoComplete="name" required minLength={2} />
        </Field>
        <Field label="WhatsApp" htmlFor="c-tel" required>
          <Input id="c-tel" name="telefone" type="tel" autoComplete="tel" required />
        </Field>
        <Field label="E-mail" htmlFor="c-email">
          <Input id="c-email" name="email" type="email" autoComplete="email" />
        </Field>
        <Field label="Cidade" htmlFor="c-cidade">
          <Input id="c-cidade" name="cidade" autoComplete="address-level2" />
        </Field>
      </div>
      <Field label="Mensagem" htmlFor="c-msg" required>
        <Textarea id="c-msg" name="mensagem" rows={4} required maxLength={3000} />
      </Field>
      <Consent id="c-consent" />
      <Button
        type="submit"
        disabled={sending}
        className="w-full bg-lzgreen font-display font-semibold text-navy-deep hover:bg-lzgreen-strong hover:text-white"
      >
        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Enviar mensagem
      </Button>
    </form>
  );
}

/* ------------------------------ PARCEIRO --------------------------------- */

export function PartnerForm() {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const origin = useOrigin();

  if (done) {
    return (
      <SuccessBox
        title="Proposta recebida!"
        description="Nosso time de parcerias vai analisar e entrar em contato com você."
      />
    );
  }

  return (
    <form
      className="relative space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const { get, consent, hp } = readForm(e);
        if (!consent) return toast.error("É necessário aceitar a política de privacidade.");
        setSending(true);
        try {
          await submitPartner({
            data: {
              nome: get("nome"),
              telefone: get("telefone"),
              email: get("email"),
              company: get("company"),
              cnpj: get("cnpj"),
              cidade: get("cidade"),
              estado: get("estado"),
              website: get("website"),
              partnership_type: get("partnership_type"),
              proposal: get("proposal"),
              consent: true,
              hp,
              origin: origin(),
            },
          });
          trackEvent("partner_submit");
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
        <Field label="Nome" htmlFor="p-nome" required>
          <Input id="p-nome" name="nome" autoComplete="name" required minLength={2} />
        </Field>
        <Field label="WhatsApp" htmlFor="p-tel" required>
          <Input id="p-tel" name="telefone" type="tel" autoComplete="tel" required />
        </Field>
        <Field label="Empresa" htmlFor="p-empresa">
          <Input id="p-empresa" name="company" autoComplete="organization" />
        </Field>
        <Field label="CNPJ" htmlFor="p-cnpj">
          <Input id="p-cnpj" name="cnpj" inputMode="numeric" />
        </Field>
        <Field label="E-mail" htmlFor="p-email">
          <Input id="p-email" name="email" type="email" autoComplete="email" />
        </Field>
        <Field label="Site / Instagram" htmlFor="p-site">
          <Input id="p-site" name="website" />
        </Field>
        <Field label="Cidade" htmlFor="p-cidade">
          <Input id="p-cidade" name="cidade" />
        </Field>
        <Field label="Estado" htmlFor="p-estado">
          <Input id="p-estado" name="estado" />
        </Field>
      </div>
      <Field label="Tipo de parceria" htmlFor="p-tipo">
        <select id="p-tipo" name="partnership_type" className={nativeSelect} defaultValue="">
          <option value="">Selecione</option>
          {PARTNERSHIP_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Sua proposta" htmlFor="p-proposta" required>
        <Textarea id="p-proposta" name="proposal" rows={4} required maxLength={3000} placeholder="Conte como podemos trabalhar juntos" />
      </Field>
      <Consent id="p-consent" />
      <Button
        type="submit"
        disabled={sending}
        className="w-full bg-lzgreen font-display font-semibold text-navy-deep hover:bg-lzgreen-strong hover:text-white"
      >
        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Enviar proposta
      </Button>
    </form>
  );
}

/* ---------------------------- NEWSLETTER --------------------------------- */

export function NewsletterForm({ dark }: { dark?: boolean }) {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const origin = useOrigin();

  if (done) {
    return <p className={dark ? "text-sm text-lzgreen" : "text-sm text-lzgreen-strong"}>Inscrição confirmada. Obrigado!</p>;
  }

  return (
    <form
      className="relative flex flex-col gap-2 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        const { get, consent, hp } = readForm(e);
        if (!consent) return toast.error("Confirme o aceite para receber os conteúdos.");
        setSending(true);
        try {
          await subscribeNewsletter({
            data: { name: get("name"), email: get("email"), consent: true, hp, origin: origin() },
          });
          setDone(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Não foi possível inscrever agora.");
        } finally {
          setSending(false);
        }
      }}
    >
      <Honeypot />
      <input
        name="email"
        type="email"
        required
        placeholder="Seu melhor e-mail"
        aria-label="E-mail para newsletter"
        className={
          dark
            ? "h-11 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40"
            : "h-11 w-full rounded-xl border border-input bg-background px-4 text-sm"
        }
      />
      <label className="sr-only" htmlFor="nl-consent">
        Aceito receber conteúdos
      </label>
      <input id="nl-consent" name="consent" type="checkbox" defaultChecked className="hidden" />
      <button
        type="submit"
        disabled={sending}
        className="h-11 shrink-0 rounded-xl bg-lzgreen px-5 font-display text-sm font-semibold text-navy-deep transition hover:bg-lzgreen-strong hover:text-white"
      >
        {sending ? "Enviando..." : "Inscrever"}
      </button>
    </form>
  );
}
