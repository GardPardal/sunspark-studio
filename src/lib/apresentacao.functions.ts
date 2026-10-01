import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RelatorioMes } from "./apresentacao.server";

export type { RelatorioMes, Venda, Agregado } from "./apresentacao.server";

/** Anotações da reunião (o que foi feito, remember, avisos), editáveis na própria página. */
export type NotasApresentacao = {
  titulo: string;
  feito: string[];
  remember: string[];
  avisos: string[];
  proximos: string[];
  atualizadoEm: string | null;
};

const PODE_VER = ["admin", "diretor", "coordenador", "sdr"];
const PODE_EDITAR = ["admin", "diretor", "coordenador"];

async function roles(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { role: string }) => r.role);
}

async function exige(supabase: any, userId: string, permitidos: string[]) {
  const rs = await roles(supabase, userId);
  if (!rs.some((r) => permitidos.includes(r)))
    throw new Error("Apresentação restrita à gestão (admin, diretoria, coordenação).");
  return rs;
}

const mesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const getRelatorioMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ mes: mesSchema, forcar: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<RelatorioMes> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await exige(supabase, userId, PODE_VER);
    const { relatorioMes } = await import("./apresentacao.server");
    return relatorioMes(data.mes, Boolean(data.forcar));
  });

const chave = (mes: string) => `apresentacao:${mes}`;

function notasPadrao(mes: string): NotasApresentacao {
  const [y, m] = mes.split("-").map(Number);
  const nome = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("pt-BR", {
    month: "long",
    timeZone: "UTC",
  });
  const base: NotasApresentacao = {
    titulo: `Fechamento de ${nome} ${y}`,
    feito: [],
    remember: [],
    avisos: [],
    proximos: [],
    atualizadoEm: null,
  };
  // Setembro/2026: entregas do Solar OS no mês (histórico do repositório) e o aviso
  // pedido para a reunião. O time completa o resto na própria página (tecla E).
  if (mes === "2026-09")
    return {
      ...base,
      feito: [
        "CRM espelhado com o Ploomes: etapa, responsável, valor e origem iguais aos do Ploomes",
        "Kanban do CRM mais rápido e painéis sem o corte de 1.000 leads (números reais)",
        "Sala de Comando (/dashhub) atualizando ao vivo, com filtro por datas anteriores",
        "Quiz do site: nenhum lead se perde e cada um entra no Ploomes em Comercial · Qualificação, com a Stephany",
        "Origens separadas: Quiz = Tráfego Interno · Tráfego Pago = Conecta",
        "Liz (IA do WhatsApp): entende áudio, qualifica e cadastra o lead no Ploomes; página Treine a Liz",
        "Painel de metas do Ploomes por filial e vendedor",
        "Atendimento do quiz limitado a 350 km das bases",
      ],
      avisos: [
        "Livro: a Kamily pegou o livro e não sabe onde ele está. Quem tiver visto, avise a Kamily.",
      ],
    };
  return base;
}

export const getNotasApresentacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mes: mesSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const rs = await exige(supabase, userId, PODE_VER);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", chave(data.mes))
      .maybeSingle();
    let notas = notasPadrao(data.mes);
    const raw = (row as { value?: unknown } | null)?.value;
    if (raw) {
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        notas = { ...notas, ...(parsed as Partial<NotasApresentacao>) };
      } catch {
        /* valor inválido: fica o padrão */
      }
    }
    return { notas, podeEditar: rs.some((r) => PODE_EDITAR.includes(r)) };
  });

const lista = z.array(z.string().trim().min(1).max(400)).max(30);

export const saveNotasApresentacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        mes: mesSchema,
        notas: z.object({
          titulo: z.string().trim().min(2).max(120),
          feito: lista,
          remember: lista,
          avisos: lista,
          proximos: lista,
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await exige(supabase, userId, PODE_EDITAR);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const value: NotasApresentacao = { ...data.notas, atualizadoEm: new Date().toISOString() };
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: chave(data.mes), value: JSON.stringify(value) } as never, {
        onConflict: "key",
      });
    if (error) throw new Error(error.message);
    return { ok: true, notas: value };
  });
