import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Resumo do dia + fila "Faça agora" — uma única chamada para toda a home. */
export const getTodayBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const helpers = await import("@/modules/clientes/clientes.server");

    const { data: rolesRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
    const canSeeAll =
      roles.includes("admin") || roles.includes("coordenador") || roles.includes("sdr");

    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let leadsQ = supabase
      .from("leads")
      .select(helpers.LEAD_COLS)
      .not("stage", "in", "(faturado,perdido)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (!canSeeAll) leadsQ = leadsQ.eq("assigned_to", userId);
    else leadsQ = leadsQ.eq("assigned_to", userId);

    const [{ data: leads }, { data: appts }, { data: mesVendas }] = await Promise.all([
      leadsQ,
      supabase
        .from("agenda_appointments")
        .select("id,title,type,starts_at,ends_at,status,lead_id")
        .eq("consultor_id", userId)
        .gte("starts_at", startToday.toISOString())
        .lte("starts_at", endToday.toISOString())
        .order("starts_at", { ascending: true }),
      supabase
        .from("leads")
        .select("id,sale_value,stage,stage_updated_at")
        .eq("assigned_to", userId)
        .in("stage", ["venda", "faturado"])
        .gte("stage_updated_at", startMonth.toISOString()),
    ]);

    const rows = await helpers.enrichLeads(supabase, leads ?? []);
    const queue = rows
      .filter((r) => r.next_action)
      .sort(
        (a, b) =>
          b.urgency - a.urgency ||
          +new Date(a.next_action_at ?? a.created_at) - +new Date(b.next_action_at ?? b.created_at),
      )
      .slice(0, 25);

    const novos = rows.filter((r) => r.stage === "novo").length;
    const retorno = rows.filter((r) => r.stage === "nao_atendido").length;
    const followups = rows.filter((r) => r.urgency >= 55 && r.stage === "atendimento").length;
    const negociacao = rows.filter(
      (r) => r.substage === "negociacao" || r.substage === "proposta",
    ).length;
    const vendasMes = (mesVendas ?? []).length;
    const faturamentoMes = (mesVendas ?? []).reduce(
      (s: number, v: any) => s + Number(v.sale_value ?? 0),
      0,
    );

    return {
      roles,
      summary: {
        novos,
        retorno,
        followups,
        compromissos: (appts ?? []).length,
        negociacao,
        vendasMes,
        faturamentoMes,
      },
      queue,
      appointments: appts ?? [],
    };
  });
