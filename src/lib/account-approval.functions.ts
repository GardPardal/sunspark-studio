import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Master consulta pedidos pendentes */
export const listPendingApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!(rolesRows ?? []).some((r: any) => r.role === "admin")) throw new Error("Acesso restrito.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("account_approvals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Público: consulta dados de um token */
export const getApprovalByToken = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("account_approvals")
      .select("id,email,full_name,requested_unit,status,expires_at,created_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false as const, reason: "not_found" as const };
    if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false as const, reason: "expired" as const };
    return { ok: true as const, approval: row };
  });

/** Público: aprova ou rejeita usando token (sem login) */
export const decideByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: z.string().min(10).max(120),
      decision: z.enum(["approved", "rejected"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("account_approvals")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Token inválido.");
    if (row.status !== "pending") throw new Error("Este pedido já foi decidido.");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("Token expirado.");

    if (data.decision === "approved") {
      // Ativar profile
      await supabaseAdmin.from("profiles").update({ status: "active" }).eq("id", row.user_id);
      // Garantir role consultor
      await supabaseAdmin.from("user_roles").upsert({ user_id: row.user_id, role: "consultor" }, { onConflict: "user_id,role" });
      // Confirmar email automaticamente (admin aprovou = confiamos)
      try { await supabaseAdmin.auth.admin.updateUserById(row.user_id, { email_confirm: true }); } catch { /* noop */ }
    } else {
      await supabaseAdmin.from("profiles").update({ status: "rejected" }).eq("id", row.user_id);
      // Deleta o usuário do auth
      try { await supabaseAdmin.auth.admin.deleteUser(row.user_id); } catch { /* noop */ }
    }

    await supabaseAdmin
      .from("account_approvals")
      .update({ status: data.decision, decided_at: new Date().toISOString() })
      .eq("id", row.id);

    return { ok: true, decision: data.decision };
  });

/** Master aprova/rejeita direto no painel (sem token) */
export const adminDecideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      approvalId: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!(rolesRows ?? []).some((r: any) => r.role === "admin")) throw new Error("Acesso restrito.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("account_approvals").select("*").eq("id", data.approvalId).single();
    if (!row) throw new Error("Pedido não encontrado.");
    if (data.decision === "approved") {
      await supabaseAdmin.from("profiles").update({ status: "active" }).eq("id", row.user_id);
      await supabaseAdmin.from("user_roles").upsert({ user_id: row.user_id, role: "consultor" }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin.from("profiles").update({ status: "rejected" }).eq("id", row.user_id);
      try { await supabaseAdmin.auth.admin.deleteUser(row.user_id); } catch { /* noop */ }
    }
    await supabaseAdmin
      .from("account_approvals")
      .update({ status: data.decision, decided_at: new Date().toISOString(), decided_by: userId })
      .eq("id", data.approvalId);
    return { ok: true };
  });
