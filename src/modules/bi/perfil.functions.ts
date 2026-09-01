import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    let leadsQ = supabase
      .from("leads")
      .select("id, stage, sale_value")
      .gte("created_at", first.toISOString());
    if (scope === "own") leadsQ = leadsQ.eq("assigned_to", userId);
    const { data: leads } = await leadsQ;

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
    const vendas = lArr.filter((l) => ["venda", "faturado"].includes(l.stage));
    const receita = vendas.reduce((s, l) => s + Number(l.sale_value ?? 0), 0);
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
      vendas: vendas.length,
      receita,
      agenda_hoje: (appts ?? []).length,
      agenda_atrasada: atrasadas,
      taxa_conversao_pct: lArr.length > 0 ? (vendas.length / lArr.length) * 100 : 0,
    };
  });
