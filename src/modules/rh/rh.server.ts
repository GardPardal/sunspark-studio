/** Helpers server-only do módulo de RH (recrutamento e seleção). */

export const DEFAULT_STAGES = [
  "Candidatura recebida",
  "Triagem",
  "Contato inicial",
  "Entrevista",
  "Avaliação comportamental",
  "Avaliação final",
  "Aprovado",
  "Contratado",
  "Não selecionado",
  "Banco de talentos",
] as const;

export const DISC_LABELS: Record<string, string> = {
  D: "Dominância",
  I: "Influência",
  S: "Estabilidade",
  C: "Conformidade",
};

const FALLBACK_RECIPIENTS = ["paloma.stalen@lz7energia.com.br", "alisonlz7@icloud.com"];

/**
 * Destinatários do aviso de nova candidatura (configurável em site_settings).
 * Candidaturas marcadas como teste vão para o destinatário de teste, nunca para o RH.
 */
export async function rhRecipients(admin: any, isTest = false): Promise<string[]> {
  const key = isTest ? "rh:test_notify_emails" : "rh:notify_emails";
  try {
    const { data } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    const raw = String(data?.value ?? "");
    const list = raw
      .split(/[,;\s]+/)
      .map((s: string) => s.trim().toLowerCase())
      .filter((s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
    if (list.length) return Array.from(new Set(list));
  } catch {
    /* usa fallback */
  }
  return isTest ? [] : FALLBACK_RECIPIENTS;
}

async function unsubscribeToken(admin: any, email: string): Promise<string> {
  const { data: existing } = await admin
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", email)
    .maybeSingle();
  if (existing?.token) return existing.token;
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const { data: inserted } = await admin
    .from("email_unsubscribe_tokens")
    .insert({ email, token })
    .select("token")
    .maybeSingle();
  return inserted?.token ?? token;
}

/** Enfileira um e-mail transacional e registra o resultado no log da candidatura. */
export async function queueRhEmail({
  admin,
  applicationId,
  to,
  subject,
  html,
  text,
  label,
  attempt = 1,
}: {
  admin: any;
  applicationId: string | null;
  to: string;
  subject: string;
  html: string;
  text: string;
  label: string;
  attempt?: number;
}) {
  const messageId = crypto.randomUUID();
  try {
    const unsub = await unsubscribeToken(admin, to);
    const { error } = await admin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to,
        from: "LZ7 RH <notify@lz7energia.com.br>",
        sender_domain: "notify.lz7energia.com.br",
        subject,
        html,
        text,
        purpose: "transactional",
        label,
        idempotency_key: `${label}-${messageId}-${to}`,
        message_id: messageId,
        unsubscribe_token: unsub,
        queued_at: new Date().toISOString(),
      },
    });
    if (error) throw new Error(error.message);
    await admin.from("application_email_log").insert({
      application_id: applicationId,
      to_email: to,
      kind: label,
      status: "enviado_ao_provedor",
      attempt,
      message_id: messageId,
    });
    return { ok: true as const, messageId };
  } catch (e) {
    await admin.from("application_email_log").insert({
      application_id: applicationId,
      to_email: to,
      kind: label,
      status: "falha",
      attempt,
      message_id: messageId,
      error: e instanceof Error ? e.message.slice(0, 500) : "erro desconhecido",
    });
    return { ok: false as const, messageId };
  }
}

/** Monta e enfileira o aviso de nova candidatura para o time de RH. */
export async function notifyNewApplication({
  admin,
  application,
  baseUrl,
  attempt = 1,
}: {
  admin: any;
  application: Record<string, any>;
  baseUrl: string;
  attempt?: number;
}) {
  const [{ default: React }, { render }, { template }] = await Promise.all([
    import("react"),
    import("@react-email/render"),
    import("@/lib/email-templates/nova-candidatura"),
  ]);

  const answers = (application.answers ?? {}) as Record<string, string>;
  const props = {
    kind: application.kind,
    jobTitle: application.job_title ?? (application.kind === "vaga" ? "Vaga" : "Banco de talentos"),
    fullName: application.full_name,
    email: application.email,
    phone: application.phone,
    city: application.city ?? undefined,
    state: application.state ?? undefined,
    linkedin: application.linkedin ?? undefined,
    experience: application.experience ?? undefined,
    resumeName: application.resume_name ?? undefined,
    hasResume: Boolean(application.resume_path),
    appliedAt: new Date(application.created_at ?? Date.now()).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    }),
    answers: Object.entries(answers).map(([q, a]) => ({ q, a: String(a) })),
    panelUrl: `${baseUrl}/mod/rh?candidatura=${application.id}`,
  };

  const html = await render(React.createElement(template.component as any, props));
  const text = [
    `Nova candidatura — ${props.fullName} (${props.jobTitle})`,
    `Inscrição: ${props.appliedAt}`,
    `E-mail: ${props.email}`,
    `WhatsApp: ${props.phone}`,
    `Cidade: ${[props.city, props.state].filter(Boolean).join(" - ")}`,
    props.linkedin ? `LinkedIn: ${props.linkedin}` : "",
    props.hasResume ? "Currículo anexado — abra pelo painel (acesso autenticado)." : "Sem currículo anexado.",
    `Painel: ${props.panelUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  const subject = typeof template.subject === "function" ? template.subject(props) : template.subject;

  const recipients = await rhRecipients(admin, Boolean(application.is_test));
  const results = [];
  for (const to of recipients) {
    results.push({
      to,
      ...(await queueRhEmail({
        admin,
        applicationId: application.id ?? null,
        to,
        subject,
        html,
        text,
        label: "nova-candidatura",
        attempt,
      })),
    });
  }
  return results;
}

/** Pontuação da avaliação comportamental: soma dos pesos por dimensão. */
export function scoreDisc(
  questions: Array<{ id: string; options: Array<{ id: string; dimension: string; weight: number }> }>,
  answers: Record<string, string>,
) {
  const totals: Record<string, number> = { D: 0, I: 0, S: 0, C: 0 };
  let answered = 0;
  for (const q of questions) {
    const optionId = answers[q.id];
    if (!optionId) continue;
    const opt = q.options.find((o) => o.id === optionId);
    if (!opt) continue;
    totals[opt.dimension] = (totals[opt.dimension] ?? 0) + Number(opt.weight ?? 1);
    answered += 1;
  }
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  const percent: Record<string, number> = {};
  for (const k of ["D", "I", "S", "C"]) percent[k] = Math.round(((totals[k] ?? 0) / sum) * 1000) / 10;
  const dominant = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "D";
  return { totals, percent, dominant, answered, questions: questions.length };
}
