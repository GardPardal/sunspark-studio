import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

/** Sessão isolada: o portal de vendas NÃO usa o login do sistema principal. */
export const vendasSession = createServerFn({ method: "GET" }).handler(async () => {
  const { hasVendasSession } = await import("./vendas-auth.server");
  return { authenticated: hasVendasSession() };
});

export const vendasLogin = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ password: z.string().min(1) }).parse(raw))
  .handler(async ({ data }) => {
    const { getVendasPassword, issueVendasSession } = await import("./vendas-auth.server");
    const expected = await getVendasPassword();
    if (data.password !== expected) throw new Error("Senha incorreta.");
    issueVendasSession();
    return { ok: true };
  });

export const vendasLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { clearVendasSession } = await import("./vendas-auth.server");
  clearVendasSession();
  return { ok: true };
});

export const vendasChangePassword = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ current: z.string().min(1), next: z.string().min(6) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { getVendasPassword, setVendasPassword, issueVendasSession } =
      await import("./vendas-auth.server");
    const expected = await getVendasPassword();
    if (data.current !== expected) throw new Error("Senha atual incorreta.");
    await setVendasPassword(data.next);
    issueVendasSession();
    return { ok: true };
  });

async function guardedDb() {
  const { requireVendasSession } = await import("./vendas-auth.server");
  requireVendasSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listFinanceSales = createServerFn({ method: "POST" }).handler(
  async (): Promise<FinanceSale[]> => {
    const db = await guardedDb();
    const { data, error } = await db
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
  },
);

export const upsertFinanceSale = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: saleInput }).parse(raw),
  )
  .handler(async ({ data }) => {
    const db = await guardedDb();
    if (data.id) {
      const { error } = await db.from("finance_sales").update(data.values).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await db
      .from("finance_sales")
      .insert(data.values)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const deleteFinanceSale = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const db = await guardedDb();
    const { error } = await db.from("finance_sales").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
