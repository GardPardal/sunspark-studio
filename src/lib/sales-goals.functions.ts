import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UnitGoal = {
  vendas: number;
  faturamento: number;
  prospeccao: number;
  contratos: number;
};

export type SellerGoal = {
  vendas: number;
  faturamento: number;
  prospeccao: number;
};

export type SalesGoalsConfig = {
  global: UnitGoal;
  units: {
    wenceslau_braz: UnitGoal;
    londrina: UnitGoal;
    ponta_grossa: UnitGoal;
    representantes: UnitGoal;
  };
  sellers: Record<string, SellerGoal>;
};

export const DEFAULT_SALES_GOALS: SalesGoalsConfig = {
  global: {
    vendas: 3000000,
    faturamento: 2500000,
    prospeccao: 500,
    contratos: 60,
  },
  units: {
    wenceslau_braz: {
      vendas: 1200000,
      faturamento: 1000000,
      prospeccao: 200,
      contratos: 25,
    },
    londrina: {
      vendas: 1000000,
      faturamento: 800000,
      prospeccao: 180,
      contratos: 20,
    },
    ponta_grossa: {
      vendas: 500000,
      faturamento: 450000,
      prospeccao: 80,
      contratos: 10,
    },
    representantes: {
      vendas: 300000,
      faturamento: 250000,
      prospeccao: 40,
      contratos: 5,
    },
  },
  sellers: {
    "beatriz moro": { vendas: 300000, faturamento: 250000, prospeccao: 40 },
    "maycom cristian": { vendas: 200000, faturamento: 170000, prospeccao: 30 },
    "matheus henrique": { vendas: 200000, faturamento: 170000, prospeccao: 30 },
    "guilherme luis": { vendas: 200000, faturamento: 170000, prospeccao: 30 },
    "carlos munhoz": { vendas: 180000, faturamento: 150000, prospeccao: 25 },
    "adonias pereira da silva": { vendas: 180000, faturamento: 150000, prospeccao: 25 },
    "eduarda juraski": { vendas: 180000, faturamento: 150000, prospeccao: 25 },
    "mycaela silva": { vendas: 160000, faturamento: 140000, prospeccao: 25 },
    "julia azevedo": { vendas: 160000, faturamento: 140000, prospeccao: 25 },
    "daniele silva": { vendas: 150000, faturamento: 130000, prospeccao: 20 },
    "nelton shishito junior": { vendas: 150000, faturamento: 130000, prospeccao: 20 },
    "ademir silva": { vendas: 150000, faturamento: 130000, prospeccao: 20 },
    "augusto costa": { vendas: 150000, faturamento: 130000, prospeccao: 20 },
    "luiz henrique oliveira": { vendas: 150000, faturamento: 130000, prospeccao: 20 },
    "kamily meira": { vendas: 150000, faturamento: 130000, prospeccao: 20 },
    "thiago paiva": { vendas: 150000, faturamento: 130000, prospeccao: 20 },
    "victor hugo victorino": { vendas: 150000, faturamento: 130000, prospeccao: 20 },
    "joao gabriel macedo": { vendas: 150000, faturamento: 130000, prospeccao: 20 },
    "anderson miguel": { vendas: 150000, faturamento: 130000, prospeccao: 20 },
    "pamela martins": { vendas: 150000, faturamento: 130000, prospeccao: 20 },
    "richard souza": { vendas: 150000, faturamento: 130000, prospeccao: 20 },
    "rodrigo da fonte costa": { vendas: 150000, faturamento: 130000, prospeccao: 20 },
  },
};

const SETTINGS_KEY = "sales_goals:config";

export const getSalesGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SalesGoalsConfig> => {
    const { supabase } = context as { supabase: any };
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (!data?.value) {
      return DEFAULT_SALES_GOALS;
    }

    try {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      return {
        global: { ...DEFAULT_SALES_GOALS.global, ...(parsed.global || {}) },
        units: {
          wenceslau_braz: {
            ...DEFAULT_SALES_GOALS.units.wenceslau_braz,
            ...(parsed.units?.wenceslau_braz || {}),
          },
          londrina: {
            ...DEFAULT_SALES_GOALS.units.londrina,
            ...(parsed.units?.londrina || {}),
          },
          ponta_grossa: {
            ...DEFAULT_SALES_GOALS.units.ponta_grossa,
            ...(parsed.units?.ponta_grossa || {}),
          },
          representantes: {
            ...DEFAULT_SALES_GOALS.units.representantes,
            ...(parsed.units?.representantes || {}),
          },
        },
        sellers: {
          ...DEFAULT_SALES_GOALS.sellers,
          ...(parsed.sellers || {}),
        },
      };
    } catch {
      return DEFAULT_SALES_GOALS;
    }
  });

const saveGoalsSchema = z.object({
  global: z.object({
    vendas: z.number().min(0),
    faturamento: z.number().min(0),
    prospeccao: z.number().min(0),
    contratos: z.number().min(0),
  }),
  units: z.object({
    wenceslau_braz: z.object({
      vendas: z.number().min(0),
      faturamento: z.number().min(0),
      prospeccao: z.number().min(0),
      contratos: z.number().min(0),
    }),
    londrina: z.object({
      vendas: z.number().min(0),
      faturamento: z.number().min(0),
      prospeccao: z.number().min(0),
      contratos: z.number().min(0),
    }),
    ponta_grossa: z.object({
      vendas: z.number().min(0),
      faturamento: z.number().min(0),
      prospeccao: z.number().min(0),
      contratos: z.number().min(0),
    }),
    representantes: z.object({
      vendas: z.number().min(0),
      faturamento: z.number().min(0),
      prospeccao: z.number().min(0),
      contratos: z.number().min(0),
    }),
  }),
  sellers: z.record(
    z.string(),
    z.object({
      vendas: z.number().min(0),
      faturamento: z.number().min(0),
      prospeccao: z.number().min(0),
    }),
  ),
});

export const saveSalesGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveGoalsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const list = (roles ?? []).map((r: { role: string }) => r.role);
    if (!list.some((r: string) => ["admin", "coordenador"].includes(r))) {
      throw new Error("Apenas administradores e coordenadores podem alterar metas.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const jsonStr = JSON.stringify(data);
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: SETTINGS_KEY, value: jsonStr, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Retorna contagem de leads de prospecção criados agrupados por período e responsável.
 */
export const listProspeccaoSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id,created_at,assigned_to,cidade,stage,origem")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (leads ?? []).map((l: any) => ({
      id: l.id,
      created_at: l.created_at,
      assigned_to: l.assigned_to,
      cidade: l.cidade,
      stage: l.stage,
      origem: l.origem,
    }));
  });
