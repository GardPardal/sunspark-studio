import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminOrCoord(supabase: any, userId: string) {
  const [{ data: a }, { data: c }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "coordenador" }),
  ]);
  if (!a && !c) throw new Error("Acesso restrito.");
}

export type Diagnostic = {
  id: string;
  severity: "info" | "warning" | "error" | "critical";
  source: string;
  code: string;
  message: string;
  suggestion: string | null;
  status: "open" | "acknowledged" | "resolved" | "ignored";
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

/** Runs a lightweight scan and upserts findings into `system_diagnostics`. */
export const runDiagnosticsScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdminOrCoord(supabase, userId);

    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const findings: Array<Omit<Diagnostic, "id" | "created_at" | "updated_at" | "resolved_at" | "status">> = [];

    // Meta sync stale > 6h
    const { data: metaSync } = await supabase
      .from("meta_sync_state")
      .select("entity,last_run_at,last_status,last_message")
      .order("last_run_at", { ascending: false })
      .limit(1);
    const m = metaSync?.[0];
    if (m?.last_run_at) {
      const age = Date.now() - new Date(m.last_run_at).getTime();
      if (age > 6 * 3600 * 1000) {
        findings.push({
          severity: "warning",
          source: "meta_ads",
          code: "sync_stale",
          message: `Sincronização Meta sem execução há ${Math.round(age / 3600000)}h.`,
          suggestion: "Executar sync manual em Marketing → Meta Ads.",
          metadata: { last_run_at: m.last_run_at, entity: m.entity },
        });
      }
    }
    if (m?.last_status && m.last_status !== "success" && m.last_status !== "ok") {
      findings.push({
        severity: "error",
        source: "meta_ads",
        code: "last_sync_failed",
        message: `Última sync Meta falhou: ${m.last_message ?? m.last_status}.`,
        suggestion: "Verificar credenciais do Meta Business e reprocessar.",
        metadata: { last_status: m.last_status },
      });
    }

    // Failed emails last 24h
    const { data: emails } = await supabase
      .from("email_send_log")
      .select("status")
      .gte("created_at", since24h);
    const failedEmails = (emails ?? []).filter((e: any) => {
      const s = (e.status ?? "").toLowerCase();
      return s.includes("fail") || s.includes("error") || s.includes("bounce");
    }).length;
    if (failedEmails > 0) {
      findings.push({
        severity: failedEmails > 10 ? "error" : "warning",
        source: "email",
        code: "delivery_failures",
        message: `${failedEmails} e-mails falharam nas últimas 24h.`,
        suggestion: "Revisar Gestão → Logs de e-mail.",
        metadata: { count: failedEmails },
      });
    }

    // Integrations with error in last 24h
    const { data: syncLog } = await supabase
      .from("integration_sync_log")
      .select("provider,status,message,created_at")
      .gte("created_at", since24h)
      .in("status", ["error", "partial"]);
    for (const row of (syncLog ?? []) as any[]) {
      findings.push({
        severity: row.status === "error" ? "error" : "warning",
        source: `integration:${row.provider}`,
        code: `sync_${row.status}`,
        message: `Integração ${row.provider} — ${row.status}: ${row.message ?? "sem detalhe"}.`,
        suggestion: "Reexecutar sincronização e checar credenciais.",
        metadata: { at: row.created_at },
      });
    }

    // Pending approvals older than 2h
    const twoH = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const { count: pendingAppr } = await supabase
      .from("account_approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", twoH);
    if ((pendingAppr ?? 0) > 0) {
      findings.push({
        severity: "warning",
        source: "auth",
        code: "approvals_pending",
        message: `${pendingAppr} solicitação(ões) de acesso aguardam aprovação há mais de 2h.`,
        suggestion: "Ir em Operação → Liberação de contas.",
        metadata: { count: pendingAppr },
      });
    }

    // Leads unassigned > 30min
    const halfHour = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { count: unassigned } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .is("assigned_to", null)
      .lt("created_at", halfHour);
    if ((unassigned ?? 0) > 0) {
      findings.push({
        severity: (unassigned ?? 0) > 20 ? "error" : "warning",
        source: "crm",
        code: "leads_unassigned",
        message: `${unassigned} lead(s) sem consultor há mais de 30min.`,
        suggestion: "Rodar a Roleta em Operação → Distribuição.",
        metadata: { count: unassigned },
      });
    }

    // Persist findings — one open row per (source, code)
    for (const f of findings) {
      const { data: existing } = await supabase
        .from("system_diagnostics")
        .select("id,status")
        .eq("source", f.source)
        .eq("code", f.code)
        .in("status", ["open", "acknowledged"])
        .limit(1);
      if (existing && existing[0]) {
        await supabase
          .from("system_diagnostics")
          .update({
            severity: f.severity,
            message: f.message,
            suggestion: f.suggestion,
            metadata: f.metadata,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing[0].id);
      } else {
        await supabase.from("system_diagnostics").insert({
          severity: f.severity,
          source: f.source,
          code: f.code,
          message: f.message,
          suggestion: f.suggestion,
          metadata: f.metadata,
        });
      }
    }

    return { scanned_at: new Date().toISOString(), findings_count: findings.length };
  });

export const listDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdminOrCoord(supabase, userId);
    const { data } = await supabase
      .from("system_diagnostics")
      .select("*")
      .in("status", ["open", "acknowledged"])
      .order("severity", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200);
    return (data ?? []) as Diagnostic[];
  });

export const updateDiagnosticStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = raw as { id: string; status: Diagnostic["status"] };
    if (!d?.id || !d?.status) throw new Error("Parâmetros inválidos.");
    return d;
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdminOrCoord(supabase, userId);
    const patch: { status: string; updated_at: string; resolved_at?: string } = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === "resolved") patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("system_diagnostics").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
