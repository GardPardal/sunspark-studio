import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SALES_LEADS_OR_FILTER } from "@/lib/ploomes-pipelines";

export type PerfilBI = {
  role: "admin" | "coordenador" | "consultor" | "sdr" | "user";
  scope: "global" | "own";
  leads_total: number;
  leads_novos: number;
  leads_atendimento: number;
  vendas: number;
  receita: number;
  agenda_hoje: number;
  agenda_atrasada: number;
  taxa_conversao_pct: number;
};

export const getPerfilBI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PerfilBI> => {
    const { supabase, userId } = context;
    const [{ data: isAdmin }, { data: isCoord }, { data: isSdr }, { data: isCons }] =
      await Promise.all([
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "coordenador" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "sdr" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "consultor" }),
      ]);
    const role: PerfilBI["role"] = isAdmin
      ? "admin"
      : isCoord
        ? "coordenador"
        : isSdr
          ? "sdr"
          : isCons
            ? "consultor"
            : "user";
    const scope: PerfilBI["scope"] = isAdmin || isCoord ? "global" : "own";

    const first = new Date();
    first.setDate(1);
    first.setHours(0, 0, 0, 0);

    const { fetchAllRows } = await import("@/lib/fetch-all.server");
    const leads = await fetchAllRows((from, to) => {
      let leadsQ = supabase
        .from("leads")
        .select("id, stage, sale_value", { count: "exact" })
        .or(SALES_LEADS_OR_FILTER)
        .gte("created_at", first.toISOString())
        .order("id");
      if (scope === "own") leadsQ = leadsQ.eq("assigned_to", userId);
      return leadsQ.range(from, to);
    });

    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);
    let apptQ = supabase
      .from("agenda_appointments")
      .select("id, starts_at, status")
      .gte("starts_at", startToday.toISOString())
      .lte("starts_at", endToday.toISOString());
    if (scope === "own") apptQ = apptQ.eq("consultor_id", userId);
    const { data: appts } = await apptQ;

    const lArr = (leads ?? []) as any[];
    // Conversão da safra: leads criados no mês que já viraram venda.
    const convertidos = lArr.filter((l) => ["venda", "faturado"].includes(l.stage));

    // Vendas do mês = contratos fechados no mês (espelho do Ploomes em manual_sales),
    // não os leads criados no mês — que misturava safra de leads com vendas.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const monthKey = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 8) + "01";
    let sellerIds: string[] | null = null;
    if (scope === "own") {
      const { data: mine } = await supabaseAdmin
        .from("sales_sellers")
        .select("id")
        .eq("profile_id", userId);
      sellerIds = (mine ?? []).map((r: any) => r.id);
    }
    let contratos: any[] = [];
    if (!sellerIds || sellerIds.length) {
      contratos = await fetchAllRows((from, to) => {
        let q = supabaseAdmin
          .from("manual_sales")
          .select("id, amount", { count: "exact" })
          .gte("sale_date", monthKey)
          .order("id");
        if (sellerIds) q = q.in("seller_id", sellerIds);
        return q.range(from, to);
      });
    }
    const receita = contratos.reduce((s, c) => s + Number(c.amount ?? 0), 0);
    const now = Date.now();
    const atrasadas = (appts ?? []).filter(
      (a: any) => a.status === "agendado" && new Date(a.starts_at).getTime() < now,
    ).length;

    return {
      role,
      scope,
      leads_total: lArr.length,
      leads_novos: lArr.filter((l) => l.stage === "novo").length,
      leads_atendimento: lArr.filter((l) => l.stage === "atendimento").length,
      vendas: contratos.length,
      receita,
      agenda_hoje: (appts ?? []).length,
      agenda_atrasada: atrasadas,
      taxa_conversao_pct: lArr.length > 0 ? (convertidos.length / lArr.length) * 100 : 0,
    };
  });
