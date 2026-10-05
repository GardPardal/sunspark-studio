import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LinhaQuiz, Relatorio, ItemLinha, ResumoInteracoes } from "./auditoria-quiz.server";

export type { LinhaQuiz, Relatorio, ItemLinha } from "./auditoria-quiz.server";
export type FichaLead = Awaited<ReturnType<typeof import("./auditoria-quiz.server").fichaLead>>;

const PODE_VER = ["admin", "diretor", "coordenador", "sdr"];

async function exige(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const rs = (data ?? []).map((r: { role: string }) => r.role);
  if (!rs.some((r: string) => PODE_VER.includes(r)))
    throw new Error("Auditoria restrita à gestão e ao SDR.");
}

const iso = z.string().datetime({ offset: true });

export const listarQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ de: iso, ate: iso }).parse(d))
  .handler(async ({ data, context }): Promise<LinhaQuiz[]> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await exige(supabase, userId);
    const { listarLeadsQuiz } = await import("./auditoria-quiz.server");
    return listarLeadsQuiz(data.de, data.ate);
  });

export const getFichaLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await exige(supabase, userId);
    const { fichaLead } = await import("./auditoria-quiz.server");
    // serializa para JSON puro (Json/unknown do banco)
    return JSON.parse(JSON.stringify(await fichaLead(data.id))) as any;
  });

export type ResumoRelatorio = {
  id: string;
  gerado_em: string;
  periodo_de: string;
  periodo_ate: string;
  total: number;
  origem: string;
};

export const listarRelatorios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResumoRelatorio[]> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await exige(supabase, userId);
    const { data, error } = await supabase
      .from("relatorios_quiz")
      .select("id,gerado_em,periodo_de,periodo_ate,total,origem")
      .order("gerado_em", { ascending: false })
      .limit(90);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getRelatorio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Relatorio & { geradoEm: string }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await exige(supabase, userId);
    const { data: r, error } = await supabase
      .from("relatorios_quiz")
      .select("dados,gerado_em")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) throw new Error("Relatório não encontrado.");
    return { ...(r.dados as Relatorio), geradoEm: r.gerado_em };
  });

export const gerarRelatorioAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await exige(supabase, userId);
    const { gerarESalvarRelatorio } = await import("./auditoria-quiz.server");
    return gerarESalvarRelatorio("manual");
  });

export type {
  AlertaLead,
  ResultadoAlertas,
  Interacao,
  ResumoInteracoes,
} from "./auditoria-quiz.server";

/** Última interação registrada por uma pessoa no Ploomes, por negócio (coluna da lista). */
export const getInteracoesPloomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        dealIds: z.array(z.number().int().positive()).max(1000),
        forcar: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await exige(supabase, userId);
    const { resumoInteracoes } = await import("./auditoria-quiz.server");
    try {
      return { ok: true as const, porDeal: await resumoInteracoes(data.dealIds, data.forcar) };
    } catch (e) {
      return {
        ok: false as const,
        erro: (e as Error).message,
        porDeal: {} as Record<number, ResumoInteracoes>,
      };
    }
  });

/** Leads do quiz sem nenhuma interação humana no Ploomes há `dias` dias. */
export const getAlertasParados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dias: z.number().int().min(1).max(30), forcar: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await exige(supabase, userId);
    const { alertasLeadsParados } = await import("./auditoria-quiz.server");
    return alertasLeadsParados(data.dias, 60, Boolean(data.forcar));
  });

export type { CruzamentoTrafego } from "./trafego-vendas.server";

/** Cruzamento Meta Ads × Solar OS × Ploomes do mês (gasto → lead → visita → venda). */
export const getCruzamentoTrafego = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await exige(supabase, userId);
    const { cruzamentoTrafego } = await import("./trafego-vendas.server");
    return cruzamentoTrafego(data.mes);
  });
