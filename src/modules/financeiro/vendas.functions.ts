import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FinanceSale = {
  id: string;
  vendedor: string;
  projeto: string;
  cidade: string | null;
  metodo_pagamento: string | null;
  valor: number;
  faturado: boolean;
  recebido: number;
  a_receber: number;
  previsto: string | null;
  faturado_em: string | null;
  observacoes: string | null;
  created_at: string;
};

const saleInput = z.object({
  vendedor: z.string().min(1),
  projeto: z.string().min(1),
  cidade: z.string().nullable().optional(),
  metodo_pagamento: z.string().nullable().optional(),
  valor: z.number().min(0),
  faturado: z.boolean(),
  recebido: z.number().min(0),
  a_receber: z.number().min(0),
  previsto: z.string().nullable().optional(),
  faturado_em: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export const listFinanceSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FinanceSale[]> => {
    const { data, error } = await context.supabase
      .from("finance_sales")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      ...r,
      valor: Number(r.valor ?? 0),
      recebido: Number(r.recebido ?? 0),
      a_receber: Number(r.a_receber ?? 0),
    }));
  });

export const upsertFinanceSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: saleInput }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase.from("finance_sales").update(data.values).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("finance_sales")
      .insert({ ...data.values, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const deleteFinanceSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("finance_sales").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
