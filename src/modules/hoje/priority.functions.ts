import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PriorityCard = {
  key: string;
  title: string;
  detail: string;
  count: number;
  severity: "info" | "warning" | "error" | "critical";
  actionLabel: string;
  actionTo: string;
  actionSearch?: Record<string, string>;
  audience: Array<"admin" | "coordenador" | "consultor" | "sdr">;
};

async function getRoles(supabase: any, userId: string) {
  const roles = await Promise.all(
    (["admin", "coordenador", "consultor", "sdr"] as const).map(async (r) => {
      const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: r });
      return [r, !!data] as const;
    }),
  );
  return Object.fromEntries(roles) as Record<"admin" | "coordenador" | "consultor" | "sdr", boolean>;
}

/** Returns prioritized action cards tailored to the caller's roles. */
export const getPriorityCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PriorityCard[]> => {
    const { supabase, userId } = context;
    const roles = await getRoles(supabase, userId);
    const isMgr = roles.admin || roles.coordenador;
    const cards: PriorityCard[] = [];

    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
    const in24h = new Date(now.getTime() + 24 * 3600 * 1000);

    // Consultor: meus leads novos / atrasados / agendamentos hoje
    if (roles.consultor) {
      const [{ data: novos }, { data: atrasados }, { data: hoje }] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true })
          .eq("assigned_to", userId).eq("stage", "novo"),
        supabase.from("leads").select("id", { count: "exact", head: true })
          .eq("assigned_to", userId).is("atendimento_confirmado_at", null)
          .lt("atendimento_deadline", now.toISOString()),
        supabase.from("agenda_appointments").select("id", { count: "exact", head: true })
          .eq("consultor_id", userId).gte("starts_at", startToday.toISOString())
          .lte("starts_at", endToday.toISOString()),
      ]) as any;

      const nNovos = (novos as any).count ?? 0;
      const nAtras = (atrasados as any).count ?? 0;
      const nHoje = (hoje as any).count ?? 0;

      if (nNovos > 0) cards.push({
        key: "meus_novos", title: `${nNovos} lead(s) novo(s) aguardando você`,
        detail: "Faça o primeiro contato para não perder a janela.",
        count: nNovos, severity: nNovos > 5 ? "warning" : "info",
        actionLabel: "Atender agora", actionTo: "/crm", actionSearch: { stage: "novo", scope: "meus" },
        audience: ["consultor"],
      });
      if (nAtras > 0) cards.push({
        key: "meus_atrasados", title: `${nAtras} atendimento(s) atrasado(s)`,
        detail: "Deadline de contato já venceu.",
        count: nAtras, severity: "error",
        actionLabel: "Resolver agora", actionTo: "/crm", actionSearch: { filter: "atrasados" },
        audience: ["consultor"],
      });
      if (nHoje > 0) cards.push({
        key: "agenda_hoje", title: `${nHoje} compromisso(s) na sua agenda hoje`,
        detail: "Confirme reuniões e visitas do dia.",
        count: nHoje, severity: "info",
        actionLabel: "Abrir agenda", actionTo: "/agenda",
        audience: ["consultor"],
      });
    }

    // Manager: leads sem consultor
    if (isMgr) {
      const { count: fila } = await supabase.from("leads")
        .select("id", { count: "exact", head: true }).is("assigned_to", null);
      if ((fila ?? 0) > 0) cards.push({
        key: "leads_fila", title: `${fila} lead(s) aguardando distribuição`,
        detail: "Rodar a roleta ou distribuir manualmente.",
        count: fila ?? 0, severity: (fila ?? 0) > 20 ? "error" : "warning",
        actionLabel: "Distribuir", actionTo: "/coordenacao",
        audience: ["admin", "coordenador"],
      });

      const { count: pend } = await supabase.from("account_approvals")
        .select("id", { count: "exact", head: true }).eq("status", "pending");
      if ((pend ?? 0) > 0) cards.push({
        key: "aprovacoes", title: `${pend} solicitação(ões) de acesso pendentes`,
        detail: "Novos consultores aguardando aprovação.",
        count: pend ?? 0, severity: "warning",
        actionLabel: "Aprovar", actionTo: "/admin",
        audience: ["admin", "coordenador"],
      });

      // Consultores sem agenda nas próximas 24h
      const { data: consultantsRaw } = await supabase.rpc("current_user_roles");
      void consultantsRaw;
      const { data: profs } = await supabase.from("profiles")
        .select("id").eq("status", "active");
      const consultantIds = (profs ?? []).map((p: any) => p.id);
      if (consultantIds.length) {
        const { data: withAgenda } = await supabase.from("agenda_appointments")
          .select("consultor_id")
          .in("consultor_id", consultantIds)
          .gte("starts_at", now.toISOString())
          .lte("starts_at", in24h.toISOString());
        const busy = new Set((withAgenda ?? []).map((a: any) => a.consultor_id));
        const semAgenda = consultantIds.filter((id: string) => !busy.has(id)).length;
        if (semAgenda > 0) cards.push({
          key: "consultores_sem_agenda", title: `${semAgenda} consultor(es) sem agenda nas próximas 24h`,
          detail: "Distribuir leads ou marcar visitas.",
          count: semAgenda, severity: "info",
          actionLabel: "Ver equipe", actionTo: "/coordenacao",
          audience: ["admin", "coordenador"],
        });
      }

      // Integrações com erro (últimas 24h)
      const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: errs } = await supabase.from("integration_sync_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24h).in("status", ["error", "partial"]);
      if ((errs ?? 0) > 0) cards.push({
        key: "int_errors", title: `${errs} falha(s) de integração nas últimas 24h`,
        detail: "Meta, Ploomes ou e-mail podem estar impactados.",
        count: errs ?? 0, severity: (errs ?? 0) > 5 ? "error" : "warning",
        actionLabel: "Abrir Saúde do Sistema", actionTo: "/mod/admin",
        audience: ["admin", "coordenador"],
      });
    }

    // SDR: leads não atendidos
    if (roles.sdr) {
      const { count: naoAtend } = await supabase.from("leads")
        .select("id", { count: "exact", head: true }).eq("stage", "nao_atendido");
      if ((naoAtend ?? 0) > 0) cards.push({
        key: "sdr_reaproveitar", title: `${naoAtend} lead(s) não atendido(s) para reaproveitar`,
        detail: "Reengajar via WhatsApp/telefone.",
        count: naoAtend ?? 0, severity: "warning",
        actionLabel: "Trabalhar fila", actionTo: "/crm", actionSearch: { stage: "nao_atendido" },
        audience: ["sdr"],
      });
    }

    // Ordena por severidade
    const rank: Record<PriorityCard["severity"], number> = { critical: 0, error: 1, warning: 2, info: 3 };
    cards.sort((a, b) => rank[a.severity] - rank[b.severity]);
    return cards;
  });
