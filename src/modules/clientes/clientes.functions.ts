import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { filter?: string; q?: string; scope?: "meus" | "todos" } | undefined) => ({
      filter: String(input?.filter ?? "todos"),
      q: String(input?.q ?? "").slice(0, 80),
      scope: input?.scope === "todos" ? ("todos" as const) : ("meus" as const),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const helpers = await import("./clientes.server");

    const { data: rolesRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
    const canSeeAll =
      roles.includes("admin") || roles.includes("coordenador") || roles.includes("sdr");

    let q = supabase
      .from("leads")
      .select(helpers.LEAD_COLS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (!canSeeAll || data.scope === "meus") q = q.eq("assigned_to", userId);
    const { data: leads, error } = await q;
    if (error) throw new Error(error.message);

    let rows = await helpers.enrichLeads(supabase, leads ?? []);

    if (data.q.trim()) {
      const needle = data.q.trim().toLowerCase();
      rows = rows.filter((r) =>
        [r.nome, r.telefone, r.cidade, r.email].some((v) =>
          (v ?? "").toLowerCase().includes(needle),
        ),
      );
    }

    const counts: Record<string, number> = {};
    for (const f of helpers.CLIENT_FILTERS)
      counts[f.key] = rows.filter((r) => helpers.matchesFilter(r, f.key)).length;

    const filtered = rows
      .filter((r) => helpers.matchesFilter(r, data.filter))
      .sort((a, b) => b.urgency - a.urgency || +new Date(b.created_at) - +new Date(a.created_at));

    return { rows: filtered, counts, canSeeAll };
  });

export const getCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const helpers = await import("./clientes.server");

    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("Cliente não encontrado ou sem permissão de acesso.");

    const [{ data: tasks }, { data: appts }, { data: timeline }, { data: owner }] =
      await Promise.all([
        supabase
          .from("lead_cadence_tasks")
          .select("*")
          .eq("lead_id", data.id)
          .order("due_at", { ascending: true })
          .limit(50),
        supabase
          .from("agenda_appointments")
          .select("*")
          .eq("lead_id", data.id)
          .order("starts_at", { ascending: false })
          .limit(50),
        supabase
          .from("timeline_events")
          .select("*")
          .eq("entity_type", "lead")
          .eq("entity_id", data.id)
          .order("ts", { ascending: false })
          .limit(80),
        lead.assigned_to
          ? supabase
              .from("profiles")
              .select("full_name,unit")
              .eq("id", lead.assigned_to)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    const [enriched] = await helpers.enrichLeads(supabase, [lead]);

    return {
      lead: enriched,
      raw: lead,
      ownerName: owner?.full_name ?? null,
      tasks: tasks ?? [],
      appointments: appts ?? [],
      timeline: timeline ?? [],
    };
  });

/** "O que aconteceu?" — registra a interação e aplica as regras já existentes. */
export const registerInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { leadId: string; outcome: string; note?: string; saleValue?: number | null }) => ({
      leadId: String(input.leadId),
      outcome: String(input.outcome),
      note: String(input.note ?? "").slice(0, 2000),
      saleValue: input.saleValue == null ? null : Number(input.saleValue),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const helpers = await import("./clientes.server");
    const outcome = helpers.outcomeByKey(data.outcome);
    if (!outcome) throw new Error("Resultado de interação inválido.");

    const { data: rolesRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);

    if (outcome.stage) {
      const { applyStageChange } = await import("@/lib/crm-stage.server");
      await applyStageChange(supabase, userId, roles, {
        leadId: data.leadId,
        stage: outcome.stage as any,
        saleValue: data.saleValue,
        saleNotes: data.note || null,
      });
    }

    // Fecha a tarefa de cadência aberta mais próxima (cadência continua invisível ao vendedor)
    const { data: task } = await supabase
      .from("lead_cadence_tasks")
      .select("id")
      .eq("lead_id", data.leadId)
      .is("completed_at", null)
      .order("due_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (task?.id) {
      await supabase
        .from("lead_cadence_tasks")
        .update({
          completed_at: new Date().toISOString(),
          completed_by: userId,
          notes: data.note || null,
        })
        .eq("id", task.id);
    }

    await supabase.rpc("record_event", {
      _entity_type: "lead",
      _entity_id: data.leadId,
      _kind: "interacao",
      _title: outcome.label,
      _summary: data.note || null,
      _source: "clientes",
      _payload: { outcome: outcome.key, next: outcome.next } as any,
    });

    // Sincroniza a interação como histórico no Ploomes
    try {
      const { syncInteractionToPloomes } = await import("@/lib/ploomes.server");
      await syncInteractionToPloomes(data.leadId, {
        title: outcome.label,
        content: data.note ? `${outcome.label}: ${data.note}` : outcome.label,
      });
    } catch (e) {
      console.error("[registrarInteracao] Ploomes sync error:", e);
    }

    return { ok: true, next: outcome.next };
  });

/** Adia a próxima ação (snooze) sem mexer na etapa. */
export const adiarProximaAcao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; hours?: number }) => ({
    leadId: String(input.leadId),
    hours: Math.min(168, Math.max(1, Number(input.hours ?? 24))),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const due = new Date(Date.now() + data.hours * 3600_000).toISOString();

    const { data: task } = await supabase
      .from("lead_cadence_tasks")
      .select("id")
      .eq("lead_id", data.leadId)
      .is("completed_at", null)
      .order("due_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (task?.id) {
      await supabase.from("lead_cadence_tasks").update({ due_at: due }).eq("id", task.id);
    }

    await supabase.rpc("record_event", {
      _entity_type: "lead",
      _entity_id: data.leadId,
      _kind: "adiado",
      _title: `Próxima ação adiada em ${data.hours}h`,
      _source: "clientes",
      _payload: { until: due, by: userId } as any,
    });

    return { ok: true, until: due };
  });
