import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_STAGES } from "./rh.server";

/** Confere o papel de RH pelo próprio banco (RLS + função security definer). */
async function assertRh(context: any) {
  const { data, error } = await context.supabase.rpc("is_rh_or_above");
  if (error || data !== true) throw new Error("Acesso restrito ao time de RH.");
}

const uuid = z.string().uuid();

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        job_id: z.string().uuid().optional().nullable(),
        stage: z.string().max(80).optional().nullable(),
        q: z.string().max(120).optional().nullable(),
        include_test: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertRh(context);
    let query = context.supabase
      .from("job_applications")
      .select(
        "id,job_id,job_title,kind,full_name,email,phone,city,state,stage,stage_updated_at,assigned_to,resume_path,resume_name,is_test,created_at,origin",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.job_id) query = query.eq("job_id", data.job_id);
    if (data.stage) query = query.eq("stage", data.stage);
    if (!data.include_test) query = query.eq("is_test", false);
    if (data.q) query = query.or(`full_name.ilike.%${data.q}%,email.ilike.%${data.q}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const [{ data: jobs }, { data: people }] = await Promise.all([
      context.supabase
        .from("site_jobs")
        .select("id,slug,title,status,stages,disc_enabled,is_test")
        .order("title"),
      context.supabase.from("profiles").select("id,full_name,email").order("full_name"),
    ]);
    return {
      applications: rows ?? [],
      jobs: jobs ?? [],
      people: people ?? [],
      defaultStages: DEFAULT_STAGES as unknown as string[],
    };
  });

export const getApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    await assertRh(context);
    const { data: application, error } = await context.supabase
      .from("job_applications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!application) throw new Error("Candidatura não encontrada.");

    const [
      { data: events },
      { data: notes },
      { data: invites },
      { data: responses },
      { data: emails },
    ] = await Promise.all([
      context.supabase
        .from("application_stage_events")
        .select("*")
        .eq("application_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("application_notes")
        .select("*")
        .eq("application_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("disc_invites")
        .select("*")
        .eq("application_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("disc_responses")
        .select("*")
        .eq("application_id", data.id)
        .order("completed_at", { ascending: false }),
      context.supabase
        .from("application_email_log")
        .select("*")
        .eq("application_id", data.id)
        .order("created_at", { ascending: false }),
    ]);

    let job: Record<string, any> | null = null;
    if (application.job_id) {
      const { data: j } = await context.supabase
        .from("site_jobs")
        .select("id,slug,title,status,stages,disc_enabled")
        .eq("id", application.job_id)
        .maybeSingle();
      job = j ?? null;
    }
    return {
      application,
      job,
      events: events ?? [],
      notes: notes ?? [],
      invites: invites ?? [],
      responses: responses ?? [],
      emails: emails ?? [],
      stages: (job?.stages as string[] | undefined) ?? (DEFAULT_STAGES as unknown as string[]),
    };
  });

export const setApplicationStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: uuid,
        stage: z.string().trim().min(2).max(80),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertRh(context);
    const { data: current } = await context.supabase
      .from("job_applications")
      .select("stage")
      .eq("id", data.id)
      .maybeSingle();
    const from = current?.stage ?? null;
    if (from === data.stage && !data.note) return { ok: true, unchanged: true };

    const { error } = await context.supabase
      .from("job_applications")
      .update({ stage: data.stage, stage_updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("application_stage_events").insert({
      application_id: data.id,
      from_stage: from,
      to_stage: data.stage,
      note: data.note ?? null,
      changed_by: context.userId,
    });
    // Mudar de etapa NÃO dispara mensagem ao candidato — só automação explícita faria isso.
    return { ok: true };
  });

export const assignApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: uuid, user_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertRh(context);
    const { error } = await context.supabase
      .from("job_applications")
      .update({ assigned_to: data.user_id })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addApplicationNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: uuid, body: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertRh(context);
    const { error } = await context.supabase
      .from("application_notes")
      .insert({ application_id: data.id, body: data.body, author_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Link temporário e autenticado para abrir o currículo (5 minutos). */
export const getResumeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, download: z.boolean().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertRh(context);
    const { data: row } = await context.supabase
      .from("job_applications")
      .select("resume_path,resume_name")
      .eq("id", data.id)
      .maybeSingle();
    if (!row?.resume_path) throw new Error("Esta candidatura não tem currículo anexado.");
    const { data: signed, error } = await context.supabase.storage
      .from("resumes")
      .createSignedUrl(
        row.resume_path,
        300,
        data.download ? { download: row.resume_name ?? true } : undefined,
      );
    if (error || !signed?.signedUrl) throw new Error("Não foi possível abrir o currículo.");
    return { url: signed.signedUrl, name: row.resume_name };
  });

export const resendApplicationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    await assertRh(context);
    const { data: application } = await context.supabase
      .from("job_applications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!application) throw new Error("Candidatura não encontrada.");
    const { count } = await context.supabase
      .from("application_email_log")
      .select("id", { count: "exact", head: true })
      .eq("application_id", data.id)
      .eq("kind", "nova-candidatura");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyNewApplication } = await import("./rh.server");
    const results = await notifyNewApplication({
      admin: supabaseAdmin,
      application,
      baseUrl: baseUrl(),
      attempt: (count ?? 0) + 1,
    });
    return { results };
  });

function baseUrl() {
  return process.env["PUBLIC_SITE_URL"] || "https://www.lz7energia.com.br";
}

/* ---------------- Vagas ---------------- */

export const saveJobProcess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: uuid,
        stages: z.array(z.string().trim().min(2).max(80)).min(1).max(30).optional(),
        disc_enabled: z.boolean().optional(),
        is_test: z.boolean().optional(),
        status: z.enum(["rascunho", "aberta", "pausada", "encerrada"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertRh(context);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("site_jobs").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Avaliação comportamental (modelo DISC) ---------------- */

export const listDiscVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRh(context);
    const { data: versions, error } = await context.supabase
      .from("disc_versions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (versions ?? []).map((v: any) => v.id);
    if (!ids.length) return { versions: [], questions: [], options: [] };
    const { data: questions } = await context.supabase
      .from("disc_questions")
      .select("*")
      .in("version_id", ids)
      .order("ordem");
    const qIds = (questions ?? []).map((q: any) => q.id);
    const { data: options } = qIds.length
      ? await context.supabase
          .from("disc_options")
          .select("*")
          .in("question_id", qIds)
          .order("ordem")
      : { data: [] as any[] };
    return { versions: versions ?? [], questions: questions ?? [], options: options ?? [] };
  });

export const saveDiscVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(120),
        version: z.number().int().min(1).max(999).optional(),
        status: z.enum(["draft", "active", "archived"]).optional(),
        instructions: z.string().trim().max(2000).optional().nullable(),
        scoring_rule: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertRh(context);
    const payload: Record<string, any> = { ...data, updated_at: new Date().toISOString() };
    if (!data.id) payload.created_by = context.userId;
    const { data: row, error } = data.id
      ? await context.supabase
          .from("disc_versions")
          .update(payload as any)
          .eq("id", data.id)
          .select("id")
          .maybeSingle()
      : await context.supabase
          .from("disc_versions")
          .insert(payload as any)
          .select("id")
          .maybeSingle();
    if (error) throw new Error(error.message);
    return { id: row?.id };
  });

export const saveDiscQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        version_id: uuid,
        prompt: z.string().trim().min(3).max(500),
        help: z.string().trim().max(500).optional().nullable(),
        ordem: z.number().int().min(0).max(999).optional(),
        options: z
          .array(
            z.object({
              id: z.string().uuid().optional(),
              label: z.string().trim().min(1).max(300),
              dimension: z.enum(["D", "I", "S", "C"]),
              weight: z.number().min(0).max(10).optional(),
            }),
          )
          .min(2)
          .max(8),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertRh(context);
    await assertVersionEditable(context, data.version_id);
    const { options, ...q } = data;
    const { data: row, error } = q.id
      ? await context.supabase
          .from("disc_questions")
          .update(q)
          .eq("id", q.id)
          .select("id")
          .maybeSingle()
      : await context.supabase.from("disc_questions").insert(q).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    const questionId = row?.id as string;
    await context.supabase.from("disc_options").delete().eq("question_id", questionId);
    const { error: optErr } = await context.supabase.from("disc_options").insert(
      options.map((o, i) => ({
        question_id: questionId,
        label: o.label,
        dimension: o.dimension,
        weight: o.weight ?? 1,
        ordem: i,
      })),
    );
    if (optErr) throw new Error(optErr.message);
    return { id: questionId };
  });

async function assertVersionEditable(context: any, versionId: string) {
  const { data } = await context.supabase
    .from("disc_versions")
    .select("status")
    .eq("id", versionId)
    .maybeSingle();
  const { count } = await context.supabase
    .from("disc_responses")
    .select("id", { count: "exact", head: true })
    .eq("version_id", versionId);
  if ((count ?? 0) > 0) {
    throw new Error(
      "Esta versão já tem respostas. Duplique em uma nova versão para alterar as perguntas.",
    );
  }
  if (data?.status === "archived") throw new Error("Versão arquivada não pode ser editada.");
}

export const deleteDiscQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, version_id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    await assertRh(context);
    await assertVersionEditable(context, data.version_id);
    const { error } = await context.supabase.from("disc_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createDiscInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        application_id: uuid,
        version_id: uuid,
        days: z.number().int().min(1).max(30).optional(),
        send_email: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertRh(context);
    const { data: version } = await context.supabase
      .from("disc_versions")
      .select("id,status,name")
      .eq("id", data.version_id)
      .maybeSingle();
    if (version?.status !== "active")
      throw new Error("Só é possível enviar uma versão ativa do questionário.");
    const { count } = await context.supabase
      .from("disc_questions")
      .select("id", { count: "exact", head: true })
      .eq("version_id", data.version_id);
    if (!count) throw new Error("Esta versão não tem perguntas cadastradas.");

    const { data: application } = await context.supabase
      .from("job_applications")
      .select("id,full_name,email,job_title,is_test")
      .eq("id", data.application_id)
      .maybeSingle();
    if (!application) throw new Error("Candidatura não encontrada.");

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + (data.days ?? 7) * 86400_000).toISOString();
    const { error } = await context.supabase.from("disc_invites").insert({
      application_id: data.application_id,
      version_id: data.version_id,
      token,
      status: "enviado",
      expires_at: expiresAt,
      sent_at: new Date().toISOString(),
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);

    const link = `${baseUrl()}/avaliacao/${token}`;
    let email: { ok: boolean } | null = null;
    if (data.send_email) {
      const [{ default: React }, { render }, { template }, { supabaseAdmin }, { queueRhEmail }] =
        await Promise.all([
          import("react"),
          import("@react-email/render"),
          import("@/lib/email-templates/disc-convite"),
          import("@/integrations/supabase/client.server"),
          import("./rh.server"),
        ]);
      const props = {
        fullName: application.full_name,
        jobTitle: application.job_title ?? "nosso processo seletivo",
        link,
        expiresAt: new Date(expiresAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      };
      const html = await render(React.createElement(template.component as any, props));
      email = await queueRhEmail({
        admin: supabaseAdmin,
        applicationId: data.application_id,
        to: application.email,
        subject:
          typeof template.subject === "function" ? template.subject(props) : template.subject,
        html,
        text: `${props.fullName}, responda a avaliação comportamental: ${link} (válido até ${props.expiresAt}).`,
        label: "disc-convite",
      });
    }
    return { link, expiresAt, email };
  });
