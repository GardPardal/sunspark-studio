import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Importa contratos vendidos e confirma quais já foram faturados no Ploomes. */
export const importPloomesSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sinceDays: z.number().min(1).max(1825).default(365) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const list = (roles ?? []).map((r: { role: string }) => r.role);
    if (!list.some((r: string) => ["admin", "coordenador", "sdr"].includes(r))) {
      throw new Error("Somente admin, coordenação ou SDR podem importar vendas.");
    }
    const { importPloomesWonSales } = await import("./ploomes-sales.server");
    return await importPloomesWonSales(data.sinceDays);
  });
