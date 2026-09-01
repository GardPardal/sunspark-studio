import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

/**
 * Ponte de envio para gatilhos do banco (novo lead, agenda, lembretes).
 * O banco chama esta rota com um segredo interno; o envio em si acontece aqui,
 * no servidor, pelo envio gerenciado da plataforma.
 *
 * Corpo esperado: { to, template, data?, idempotency_key? }
 */
export const Route = createFileRoute("/api/public/email/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json({ error: "server_misconfigured" }, { status: 500 });
        }

        const provided = request.headers.get("x-email-dispatch-secret");
        if (!provided) return Response.json({ error: "unauthorized" }, { status: 401 });

        const admin = createClient(supabaseUrl, supabaseServiceKey);
        const { data: config } = await admin
          .from("email_dispatch_config")
          .select("secret")
          .eq("id", 1)
          .maybeSingle();
        const expected = config?.secret;
        if (!expected || provided !== expected) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }

        const to = typeof body?.to === "string" ? body.to.trim() : "";
        const templateName = typeof body?.template === "string" ? body.template : "";
        const templateData =
          body?.data && typeof body.data === "object" ? (body.data as Record<string, any>) : {};
        if (!to || !templateName) {
          return Response.json({ error: "to_and_template_required" }, { status: 400 });
        }

        const messageId = crypto.randomUUID();
        const idempotencyKey =
          typeof body?.idempotency_key === "string" && body.idempotency_key
            ? body.idempotency_key
            : `${templateName}-${messageId}`;

        try {
          const result = await sendTemplateEmail(templateName, to, {
            templateData,
            idempotencyKey,
          });
          const { error: logError } = await admin.from("email_send_log").insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: to,
            status: result.sent ? "sent" : "suppressed",
          });
          if (logError) console.error("[email dispatch] log falhou", logError);
          return Response.json({ ok: result.sent, reason: result.sent ? null : result.reason });
        } catch (error) {
          const message = error instanceof Error ? error.message : "send_failed";
          const { error: logError } = await admin.from("email_send_log").insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: to,
            status: "failed",
            error_message: message.slice(0, 1000),
          });
          if (logError) console.error("[email dispatch] log falhou", logError);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
