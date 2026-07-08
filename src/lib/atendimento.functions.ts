import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Consultor (ou SDR/coord) marca que já ligou/confirmou — para o timer de 2h. */
export const confirmarAtendimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { error } = await supabase.rpc("confirmar_atendimento", { _lead_id: data.leadId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Lista consultores congelados (fora da roleta até o SDR devolver). */
export const listFrozenConsultants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesRows ?? []).map((r: any) => r.role);
    if (!roles.some((r: string) => ["admin", "coordenador", "sdr"].includes(r))) {
      throw new Error("Acesso restrito.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email,unit,queue_frozen_at,queue_frozen_reason")
      .eq("queue_frozen", true)
      .order("queue_frozen_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** SDR/coord devolve o consultor à fila (independente do ranking). */
export const unfreezeConsultant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { error } = await supabase.rpc("unfreeze_consultant", { _user_id: data.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
