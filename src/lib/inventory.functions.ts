import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1sXt5mnTugkI7iCdtFNqXxaP1iZRSJYUx4iwC-oeFYrg/export?format=csv&gid=0";

export type InventoryItem = {
  id: string;
  codigo: string;
  descricao: string;
  saldo_inventario: number | null;
  saldo_fisico: number;
  unidade: string;
  preco_venda: number;
  preco_compra: number;
  preco_compra_convertido: number;
  prateleira: string | null;
  ordem: number;
  updated_at: string;
};

export const listInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("inventory_items")
      .select("*")
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as InventoryItem[];
  });

const patchSchema = z.object({
  id: z.string().uuid(),
  patch: z.object({
    descricao: z.string().max(300).optional(),
    saldo_inventario: z.number().nullable().optional(),
    saldo_fisico: z.number().optional(),
    unidade: z.string().max(30).optional(),
    preco_venda: z.number().optional(),
    preco_compra: z.number().optional(),
    preco_compra_convertido: z.number().optional(),
    prateleira: z.string().max(60).nullable().optional(),
  }),
});

export const updateInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => patchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("inventory_items")
      .update({ ...data.patch, updated_by: context.userId } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const createSchema = z.object({
  codigo: z.string().min(1).max(40),
  descricao: z.string().min(1).max(300),
  unidade: z.string().max(30).default("UNID"),
  saldo_fisico: z.number().default(0),
  saldo_inventario: z.number().nullable().default(null),
  preco_compra: z.number().default(0),
  preco_venda: z.number().default(0),
  prateleira: z.string().max(60).nullable().default(null),
});

export const createInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: max } = await context.supabase
      .from("inventory_items")
      .select("ordem")
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await context.supabase.from("inventory_items").insert({
      ...data,
      preco_compra_convertido: data.preco_compra,
      ordem: ((max as { ordem?: number } | null)?.ordem ?? 0) + 1,
      updated_by: context.userId,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("inventory_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- CSV helpers (mesmo padrão da planilha) ----------

export const CSV_HEADERS = [
  "Código",
  "Descrição",
  "SALDO INVENTARIO",
  "Saldo físico",
  "Und. venda",
  "Preço de venda",
  "Preço de compra",
  "Preço de compra convertido",
  "Prateleira",
] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function num(raw: string | undefined): number | null {
  const s = (raw ?? "").replace(/R\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".").trim();
  if (!s || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

type ParsedRow = {
  codigo: string;
  descricao: string;
  saldo_inventario: number | null;
  saldo_fisico: number;
  unidade: string;
  preco_venda: number;
  preco_compra: number;
  preco_compra_convertido: number;
  prateleira: string | null;
  ordem: number;
};

function rowsFromCsv(text: string): ParsedRow[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const out: ParsedRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const codigo = (r[0] ?? "").trim();
    if (!codigo) continue;
    const compra = num(r[6]) ?? 0;
    out.push({
      codigo,
      descricao: (r[1] ?? "").trim(),
      saldo_inventario: num(r[2]),
      saldo_fisico: num(r[3]) ?? 0,
      unidade: (r[4] ?? "UNID").trim() || "UNID",
      preco_venda: num(r[5]) ?? 0,
      preco_compra: compra,
      preco_compra_convertido: num(r[7]) ?? compra,
      prateleira: (r[8] ?? "").trim() || null,
      ordem: i - 1,
    });
  }
  return out;
}

async function upsertRows(rows: ParsedRow[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let saved = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabaseAdmin
      .from("inventory_items")
      .upsert(chunk as never, { onConflict: "codigo" });
    if (error) throw new Error(error.message);
    saved += chunk.length;
  }
  return saved;
}

async function assertManager(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin") && !roles.includes("coordenador")) {
    throw new Error("Somente administradores e coordenadores podem importar planilhas.");
  }
}

/** Importa/atualiza o inventário direto da planilha do Google (mesmo padrão de colunas). */
export const importInventoryFromSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context.supabase, context.userId);
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error(`Falha ao baixar a planilha [${res.status}]`);
    const rows = rowsFromCsv(await res.text());
    const saved = await upsertRows(rows);
    return { saved };
  });

/** Importa a partir de um CSV enviado pelo usuário, no mesmo padrão da planilha. */
export const importInventoryCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ csv: z.string().min(10).max(2_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const rows = rowsFromCsv(data.csv);
    if (!rows.length) throw new Error("Nenhuma linha válida encontrada no arquivo.");
    const saved = await upsertRows(rows);
    return { saved };
  });
