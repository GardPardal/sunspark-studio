import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

/**
 * Rota pública chamada logo após o cadastro público do consultor.
 * Envia um email para todos os admins avisando que há um novo pedido
 * de aprovação, com botões de aprovar/rejeitar via token.
 *
 * Público de propósito: no cadastro o usuário ainda não tem sessão.
 * Não retorna dados sensíveis.
 */
export const Route = createFileRoute("/api/public/notify-approval")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json({ error: "server_misconfigured" }, { status: 500 });
        }

        let userId: string | undefined;
        let email: string | undefined;
        try {
          const body = await request.json();
          userId = body.userId;
          email = body.email;
        } catch {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }
        if (!userId && !email) {
          return Response.json({ error: "userId_or_email_required" }, { status: 400 });
        }

        const admin = createClient(supabaseUrl, supabaseServiceKey);

        // Busca a aprovação pendente
        let q = admin
          .from("account_approvals")
          .select("id,user_id,email,full_name,requested_unit,token,status")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1);
        if (userId) q = q.eq("user_id", userId);
        else if (email) q = q.eq("email", email);

        const { data: approval, error: apErr } = await q.maybeSingle();
        if (apErr || !approval) {
          return Response.json({ ok: false, reason: "approval_not_found" }, { status: 404 });
        }

        // Descobre destinatários (admins)
        const { data: adminRoles } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        const adminIds = (adminRoles ?? []).map((r: any) => r.user_id);
        let recipients: string[] = [];
        if (adminIds.length > 0) {
          const { data: profs } = await admin.from("profiles").select("email").in("id", adminIds);
          recipients = (profs ?? [])
            .map((p: any) => p.email)
            .filter((e: string | null): e is string => Boolean(e));
        }
        // Fallback: sempre inclui o email institucional
        if (!recipients.includes("alisonlz7@icloud.com")) recipients.push("alisonlz7@icloud.com");

        // URLs de decisão via token (rota pública já existente)
        const origin = new URL(request.url).origin;
        const approveUrl = `${origin}/aprovar-usuario?token=${approval.token}&d=approved`;
        const rejectUrl = `${origin}/aprovar-usuario?token=${approval.token}&d=rejected`;
        const panelUrl = `${origin}/admin`;

        const data = {
          fullName: approval.full_name ?? approval.email,
          email: approval.email,
          unit: approval.requested_unit ?? "—",
          approveUrl,
          rejectUrl,
          panelUrl,
        };

        // Envia um email por destinatário através do envio gerenciado
        const enqueued: string[] = [];
        const errors: Array<{ to: string; error: string }> = [];
        for (const to of recipients) {
          try {
            const result = await sendTemplateEmail("aprovacao-solicitada", to, {
              templateData: data,
              idempotencyKey: `approval-${approval.id}-${to}`,
            });
            if (result.sent) enqueued.push(to);
            else errors.push({ to, error: result.reason });
          } catch (sendError) {
            errors.push({
              to,
              error: sendError instanceof Error ? sendError.message : "send_failed",
            });
          }
        }

        return Response.json({ ok: true, enqueued_count: enqueued.length, enqueued, errors });
      },
    },
  },
});
