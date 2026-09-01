import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { rateLimit, clientIp, normalizeOrigin } from "@/modules/site/site.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const schema = z.object({
  kind: z.enum(["vaga", "talentos"]),
  job_id: z.string().uuid().optional().nullable(),
  job_slug: z.string().trim().max(160).optional().nullable(),
  job_title: z.string().trim().max(160).optional().nullable(),
  full_name: z.string().trim().min(2).max(140),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(8).max(25),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.string().trim().max(60).optional().nullable(),
  linkedin: z.string().trim().max(240).optional().nullable(),
  experience: z.string().trim().max(4000).optional().nullable(),
  message: z.string().trim().max(4000).optional().nullable(),
  interest_area: z.string().trim().max(120).optional().nullable(),
  salary_expectation: z.string().trim().max(60).optional().nullable(),
  availability: z.string().trim().max(120).optional().nullable(),
  has_cnh: z.boolean().optional().nullable(),
});

export const Route = createFileRoute("/api/public/candidatura")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json", ...CORS },
          });

        if (!rateLimit(`candidatura:${clientIp(request.headers)}`, 4)) {
          return json({ error: "Muitas tentativas. Aguarde um minuto." }, 429);
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "Envio inválido." }, 400);
        }

        if (String(form.get("hp") ?? "")) return json({ ok: true });
        if (String(form.get("consent") ?? "") !== "true") {
          return json({ error: "É necessário aceitar a política de privacidade." }, 400);
        }

        const raw: Record<string, unknown> = {};
        for (const [k, v] of form.entries()) if (typeof v === "string" && v !== "") raw[k] = v;
        if (raw.has_cnh != null) raw.has_cnh = raw.has_cnh === "true";
        if (!raw.job_id) delete raw.job_id;

        const parsed = schema.safeParse(raw);
        if (!parsed.success) return json({ error: "Confira os campos obrigatórios." }, 400);
        const data = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let resumePath: string | null = null;
        let resumeName: string | null = null;
        const file = form.get("resume");
        if (file && file instanceof File && file.size > 0) {
          if (file.size > MAX_RESUME_BYTES) return json({ error: "O currículo deve ter até 5 MB." }, 400);
          if (!ALLOWED.has(file.type)) return json({ error: "Envie o currículo em PDF ou DOC/DOCX." }, 400);
          const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
          const path = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("resumes")
            .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
          if (upErr) return json({ error: "Não foi possível enviar o currículo. Tente novamente." }, 500);
          resumePath = path;
          resumeName = file.name.slice(0, 160);
        }

        let origin: Record<string, string> = {};
        try {
          origin = normalizeOrigin(JSON.parse(String(form.get("origin") ?? "{}")));
        } catch {
          origin = {};
        }

        let answers: Record<string, string> = {};
        try {
          const parsedAnswers = JSON.parse(String(form.get("answers") ?? "{}"));
          if (parsedAnswers && typeof parsedAnswers === "object") {
            for (const [k, v] of Object.entries(parsedAnswers as Record<string, unknown>)) {
              if (typeof v === "string" && v.trim()) answers[String(k).slice(0, 200)] = v.slice(0, 2000);
            }
          }
        } catch {
          answers = {};
        }

        // Vaga encerrada/rascunho não recebe candidatura.
        let jobRow: any = null;
        let jobId: string | null = data.job_id ?? null;
        if (jobId || data.job_slug) {
          const query = supabaseAdmin.from("site_jobs").select("id,title,status,is_test");
          const { data: j } = await (jobId ? query.eq("id", jobId) : query.eq("slug", data.job_slug!)).maybeSingle();
          jobRow = j;
          if (!jobRow) return json({ error: "Vaga não encontrada." }, 404);
          if (jobRow.status !== "aberta") {
            return json({ error: "Esta vaga não está recebendo candidaturas no momento." }, 409);
          }
          jobId = jobRow.id;
        }

        // Idempotência: mesmo envio (clique duplo / retry) não gera duas candidaturas.
        const submissionKey = String(form.get("submission_key") ?? "").slice(0, 80) || null;
        if (submissionKey) {
          const { data: dup } = await supabaseAdmin
            .from("job_applications")
            .select("id")
            .eq("submission_key", submissionKey)
            .maybeSingle();
          if (dup) return json({ ok: true, id: dup.id, duplicated: true });
        }

        const payload = {
          kind: data.kind,
          job_id: jobId,
          job_title: data.job_title ?? jobRow?.title ?? null,
          full_name: data.full_name,
          email: data.email.toLowerCase(),
          phone: data.phone,
          city: data.city ?? null,
          state: data.state ?? null,
          linkedin: data.linkedin ?? null,
          experience: data.experience ?? null,
          message: data.message ?? null,
          interest_area: data.interest_area ?? null,
          salary_expectation: data.salary_expectation ?? null,
          availability: data.availability ?? null,
          has_cnh: data.has_cnh ?? null,
          resume_path: resumePath,
          resume_name: resumeName,
          answers,
          origin,
          submission_key: submissionKey,
          is_test: Boolean(jobRow?.is_test),
          stage: "Candidatura recebida",
        };

        // Recandidatura à MESMA vaga: atualiza o registro existente em vez de duplicar.
        let existingId: string | null = null;
        if (jobId) {
          const { data: prev } = await supabaseAdmin
            .from("job_applications")
            .select("id")
            .eq("job_id", jobId)
            .eq("email", payload.email)
            .maybeSingle();
          existingId = prev?.id ?? null;
        }

        let application: Record<string, any> | null = null;
        if (existingId) {
          const { updateOnly, ...rest } = { updateOnly: undefined, ...payload } as any;
          if (!resumePath) {
            delete rest.resume_path;
            delete rest.resume_name;
          }
          const { data: updated, error } = await supabaseAdmin
            .from("job_applications")
            .update({ ...rest, updated_at: new Date().toISOString() })
            .eq("id", existingId)
            .select("*")
            .maybeSingle();
          if (error) return json({ error: "Não foi possível atualizar sua candidatura." }, 500);
          application = updated;
        } else {
          const { data: inserted, error } = await supabaseAdmin
            .from("job_applications")
            .insert(payload)
            .select("*")
            .maybeSingle();
          if (error) return json({ error: "Não foi possível registrar sua candidatura." }, 500);
          application = inserted;
        }

        if (!application) return json({ error: "Não foi possível registrar sua candidatura." }, 500);

        if (!existingId) {
          await supabaseAdmin.from("application_stage_events").insert({
            application_id: application.id,
            from_stage: null,
            to_stage: "Candidatura recebida",
            note: "Candidatura recebida pelo site.",
          });
        }

        // Falha de e-mail não invalida nem apaga a candidatura já gravada.
        try {
          const { notifyNewApplication } = await import("@/modules/rh/rh.server");
          await notifyNewApplication({
            admin: supabaseAdmin,
            application,
            baseUrl: new URL(request.url).origin,
          });
        } catch (e) {
          console.error("[candidatura] falha ao notificar RH", e);
        }

        return json({ ok: true, id: application.id, updated: Boolean(existingId) });
      },
    },
  },
});
