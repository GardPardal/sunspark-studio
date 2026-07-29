import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminOrCoord(supabase: any, userId: string) {
  const [{ data: a }, { data: c }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "coordenador" }),
  ]);
  if (!a && !c) throw new Error("Acesso restrito.");
}

export type SystemHealth = {
  meta: { last_run_at: string | null; last_status: string | null; last_message: string | null; items: number | null };
  ploomes: { last_run_at: string | null; last_status: string | null; last_message: string | null };
  emails24h: { total: number; failed: number };
  syncLog: Array<{ id: string; provider: string; status: string; message: string | null; created_at: string; items_imported: number }>;
  integrationErrors24h: number;
  leadsToday: number;
  activeCampaigns: number;
  computed_at: string;
};

export const getSystemHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemHealth> => {
    const { supabase, userId } = context;
    await assertAdminOrCoord(supabase, userId);

    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);

    const [metaSync, syncLog, emails, leadsToday, campaigns] = await Promise.all([
      supabase.from("meta_sync_state").select("*").order("last_run_at", { ascending: false }).limit(1),
      supabase.from("integration_sync_log").select("id, provider, status, message, created_at, items_imported").order("created_at", { ascending: false }).limit(20),
      supabase.from("email_send_log").select("status").gte("created_at", since24h),
      supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", startToday.toISOString()),
      supabase.from("meta_campaigns").select("id", { count: "exact", head: true }).in("effective_status", ["ACTIVE"]),
    ]);

    const metaRow = metaSync.data?.[0];
    const logs = syncLog.data ?? [];
    const ploomesRow = logs.find((l: any) => l.provider?.startsWith("ploomes"));
    const emailRows = emails.data ?? [];
    const failed = emailRows.filter((e: any) => (e.status ?? "").toLowerCase().includes("fail") || (e.status ?? "").toLowerCase().includes("error")).length;
    const integrationErrors24h = logs.filter((l: any) => l.status === "error" || l.status === "partial").length;

    return {
      meta: {
        last_run_at: metaRow?.last_run_at ?? null,
        last_status: metaRow?.last_status ?? null,
        last_message: metaRow?.last_message ?? null,
        items: metaRow?.items_processed ?? null,
      },
      ploomes: {
        last_run_at: ploomesRow?.created_at ?? null,
        last_status: ploomesRow?.status ?? null,
        last_message: ploomesRow?.message ?? null,
      },
      emails24h: { total: emailRows.length, failed },
      syncLog: logs as any,
      integrationErrors24h,
      leadsToday: (leadsToday as any).count ?? 0,
      activeCampaigns: (campaigns as any).count ?? 0,
      computed_at: new Date().toISOString(),
    };
  });
