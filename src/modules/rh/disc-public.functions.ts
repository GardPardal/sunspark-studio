import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.string().trim().regex(/^[a-f0-9]{32,80}$/);

async function loadInvite(admin: any, token: string) {
  const { data: invite } = await admin
    .from("disc_invites")
    .select("id,application_id,version_id,status,expires_at,started_at,completed_at")
    .eq("token", token)
    .maybeSingle();
  return invite;
}

/** Carrega o questionário de um convite individual — sem login, só com o token. */
export const getDiscInvite = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const invite = await loadInvite(supabaseAdmin, data.token);
    if (!invite) return { state: "invalido" as const };
    if (invite.completed_at) return { state: "concluido" as const };
    if (new Date(invite.expires_at).getTime() < Date.now()) return { state: "expirado" as const };

    const [{ data: version }, { data: application }] = await Promise.all([
      supabaseAdmin.from("disc_versions").select("id,name,version,instructions,status").eq("id", invite.version_id).maybeSingle(),
      supabaseAdmin.from("job_applications").select("full_name,job_title").eq("id", invite.application_id).maybeSingle(),
    ]);
    const { data: questions } = await supabaseAdmin
      .from("disc_questions")
      .select("id,prompt,help,ordem")
      .eq("version_id", invite.version_id)
      .order("ordem");
    const qIds = (questions ?? []).map((q: any) => q.id);
    const { data: options } = qIds.length
      ? await supabaseAdmin.from("disc_options").select("id,question_id,label,ordem").in("question_id", qIds).order("ordem")
      : { data: [] as any[] };

    if (!invite.started_at) {
      await supabaseAdmin
        .from("disc_invites")
        .update({ started_at: new Date().toISOString(), status: "em_andamento" })
        .eq("id", invite.id);
    }

    return {
      state: "ok" as const,
      candidate: application?.full_name ?? "",
      jobTitle: application?.job_title ?? null,
      version: { name: version?.name ?? "", version: version?.version ?? 1, instructions: version?.instructions ?? null },
      questions: (questions ?? []).map((q: any) => ({
        id: q.id,
        prompt: q.prompt,
        help: q.help,
        options: (options ?? []).filter((o: any) => o.question_id === q.id).map((o: any) => ({ id: o.id, label: o.label })),
      })),
    };
  });

/** Grava as respostas, calcula a pontuação e congela a versão usada. */
export const submitDiscInvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenSchema, answers: z.record(z.string().uuid(), z.string().uuid()) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { scoreDisc } = await import("./rh.server");
    const invite = await loadInvite(supabaseAdmin, data.token);
    if (!invite) throw new Error("Link inválido.");
    if (invite.completed_at) throw new Error("Esta avaliação já foi respondida.");
    if (new Date(invite.expires_at).getTime() < Date.now()) throw new Error("Este link expirou. Peça um novo ao RH.");

    const [{ data: version }, { data: questions }] = await Promise.all([
      supabaseAdmin.from("disc_versions").select("*").eq("id", invite.version_id).maybeSingle(),
      supabaseAdmin.from("disc_questions").select("id,prompt,ordem").eq("version_id", invite.version_id).order("ordem"),
    ]);
    const qIds = (questions ?? []).map((q: any) => q.id);
    const { data: options } = await supabaseAdmin
      .from("disc_options")
      .select("id,question_id,label,dimension,weight")
      .in("question_id", qIds.length ? qIds : ["00000000-0000-0000-0000-000000000000"]);

    const shaped = (questions ?? []).map((q: any) => ({
      id: q.id,
      prompt: q.prompt,
      options: (options ?? []).filter((o: any) => o.question_id === q.id),
    }));
    if (shaped.some((q) => !data.answers[q.id])) throw new Error("Responda todas as perguntas.");

    const scores = scoreDisc(shaped as any, data.answers);
    const { error } = await supabaseAdmin.from("disc_responses").insert({
      invite_id: invite.id,
      application_id: invite.application_id,
      version_id: invite.version_id,
      answers: data.answers,
      scores,
      snapshot: { version, questions: shaped },
    });
    if (error) throw new Error("Não foi possível registrar suas respostas. Tente novamente.");

    await supabaseAdmin
      .from("disc_invites")
      .update({ status: "concluido", completed_at: new Date().toISOString() })
      .eq("id", invite.id);
    return { ok: true };
  });
