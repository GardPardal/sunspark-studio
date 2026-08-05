import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { _internalFetchSchema } from "./ploomes-form.functions";

export type PloomesUserRow = {
  ploomes_id: number;
  name: string;
  email: string | null;
  active: boolean;
  profile_id: string | null;
  seller_id: string | null;
  unit: "londrina" | "ponta_grossa" | "wenceslau_braz" | null;
  source: string;
  last_seen_at: string;
  updated_at: string;
};

function norm(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function getRoles(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { role: string }) => r.role);
}
async function assertManage(supabase: any, userId: string) {
  const roles = await getRoles(supabase, userId);
  if (!roles.some((r) => ["admin", "coordenador", "sdr"].includes(r))) {
    throw new Error("Somente admin, coordenação ou SDR podem gerenciar responsáveis.");
  }
}

/** Lista responsáveis do Ploomes já sincronizados, com vínculos resolvidos. */
export const listPloomesUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const [{ data: users, error }, { data: profiles }, { data: sellers }] = await Promise.all([
      supabase
        .from("ploomes_users")
        .select("ploomes_id,name,email,active,profile_id,seller_id,unit,source,last_seen_at,updated_at")
        .order("name", { ascending: true }),
      supabase.from("profiles").select("id,full_name,email,unit,status").order("full_name"),
      supabase.from("sales_sellers").select("id,name,unit,active").order("name"),
    ]);
    if (error) throw new Error(error.message);
    return {
      users: (users ?? []) as PloomesUserRow[],
      profiles: (profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null; unit: string | null; status: string }>,
      sellers: (sellers ?? []) as Array<{ id: string; name: string; unit: string | null; active: boolean }>,
    };
  });

/**
 * Sincroniza os responsáveis cadastrados no Ploomes para o nosso sistema.
 * Fonte primária: formulário público do Ploomes (sempre disponível).
 * Complemento: API /Users quando houver chave configurada (traz e-mail e status).
 * Faz o auto-vínculo com logins (profiles) e vendedores (ranking) por nome/e-mail.
 */
export const syncPloomesUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ createSellers: z.boolean().default(true) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertManage(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Fonte: formulário público
    const schema = await _internalFetchSchema();
    const incoming = new Map<number, { name: string; email: string | null; active: boolean; source: string }>();
    for (const o of schema.owners) {
      if (!o.value) continue;
      incoming.set(o.value, { name: o.name, email: null, active: true, source: "ploomes_form" });
    }

    // 2) Complemento: API de usuários (opcional)
    let apiError: string | null = null;
    try {
      const key = process.env["PLOOMES_USER_KEY"] || process.env["PLOOMES_API_KEY"];
      if (key) {
        const res = await fetch("https://public-api2.ploomes.com/Users?$top=300", {
          headers: { "User-Key": key, Accept: "application/json" },
        });
        if (res.ok) {
          const j: any = await res.json();
          for (const u of j?.value ?? []) {
            const id = Number(u.Id);
            if (!id) continue;
            const prev = incoming.get(id);
            incoming.set(id, {
              name: u.Name ?? prev?.name ?? `Usuário ${id}`,
              email: u.Email ?? prev?.email ?? null,
              active: u.Active !== false,
              source: "ploomes_api",
            });
          }
        } else {
          apiError = `API Ploomes ${res.status}`;
        }
      }
    } catch (e: any) {
      apiError = e?.message ?? "falha na API do Ploomes";
    }

    if (incoming.size === 0) {
      return { synced: 0, created: 0, linked: 0, sellersCreated: 0, apiError: apiError ?? "nenhum responsável encontrado" };
    }

    // 3) Estado atual
    const [{ data: existing }, { data: profiles }, { data: sellers }] = await Promise.all([
      supabaseAdmin.from("ploomes_users").select("ploomes_id,profile_id,seller_id"),
      supabaseAdmin.from("profiles").select("id,full_name,email,unit,status"),
      supabaseAdmin.from("sales_sellers").select("id,name,profile_id,unit,active"),
    ]);
    const existingMap = new Map<number, { profile_id: string | null; seller_id: string | null }>(
      (existing ?? []).map((r: any) => [Number(r.ploomes_id), { profile_id: r.profile_id, seller_id: r.seller_id }]),
    );
    const profByName = new Map<string, any>();
    const profByEmail = new Map<string, any>();
    for (const p of profiles ?? []) {
      if (p.full_name) profByName.set(norm(p.full_name), p);
      if (p.email) profByEmail.set(norm(p.email), p);
    }
    const sellerByName = new Map<string, any>();
    const sellerByProfile = new Map<string, any>();
    for (const s of sellers ?? []) {
      sellerByName.set(norm(s.name), s);
      if (s.profile_id) sellerByProfile.set(s.profile_id, s);
    }

    const now = new Date().toISOString();
    const rows: any[] = [];
    const newSellers: any[] = [];
    let created = 0;
    let linked = 0;

    for (const [id, u] of incoming) {
      const prev = existingMap.get(id);
      if (!prev) created += 1;

      let profile_id = prev?.profile_id ?? null;
      if (!profile_id) {
        const match =
          (u.email ? profByEmail.get(norm(u.email)) : null) ?? profByName.get(norm(u.name)) ?? null;
        if (match) {
          profile_id = match.id;
          linked += 1;
        }
      }
      const prof = profile_id ? (profiles ?? []).find((p: any) => p.id === profile_id) : null;

      let seller_id = prev?.seller_id ?? null;
      if (!seller_id) {
        const s = (profile_id ? sellerByProfile.get(profile_id) : null) ?? sellerByName.get(norm(u.name)) ?? null;
        if (s) seller_id = s.id;
        else if (data.createSellers && u.active) {
          newSellers.push({ name: u.name, profile_id, unit: prof?.unit ?? null, active: true, __ploomes_id: id });
        }
      }

      rows.push({
        ploomes_id: id,
        name: u.name,
        email: u.email,
        active: u.active,
        profile_id,
        seller_id,
        unit: prof?.unit ?? null,
        source: u.source,
        last_seen_at: now,
        updated_at: now,
      });
    }

    // 4) Cria vendedores faltantes e amarra ao responsável
    let sellersCreated = 0;
    if (newSellers.length > 0) {
      const payload = newSellers.map(({ __ploomes_id, ...rest }) => rest);
      const { data: inserted, error: sErr } = await supabaseAdmin
        .from("sales_sellers")
        .insert(payload)
        .select("id,name");
      if (!sErr && inserted) {
        sellersCreated = inserted.length;
        const byName = new Map(inserted.map((s: any) => [norm(s.name), s.id]));
        for (const r of rows) {
          if (!r.seller_id) r.seller_id = byName.get(norm(r.name)) ?? null;
        }
      }
    }

    const { error } = await supabaseAdmin.from("ploomes_users").upsert(rows, { onConflict: "ploomes_id" });
    if (error) throw new Error(error.message);

    return { synced: rows.length, created, linked, sellersCreated, apiError };
  });

/** Atualiza o vínculo/estado de um responsável manualmente. */
export const updatePloomesUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ploomes_id: z.number(),
        profile_id: z.string().uuid().nullable().optional(),
        seller_id: z.string().uuid().nullable().optional(),
        unit: z.enum(["londrina", "ponta_grossa", "wenceslau_braz"]).nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertManage(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { updated_at: new Date().toISOString() };
    if (data.profile_id !== undefined) patch["profile_id"] = data.profile_id;
    if (data.seller_id !== undefined) patch["seller_id"] = data.seller_id;
    if (data.unit !== undefined) patch["unit"] = data.unit;
    if (data.active !== undefined) patch["active"] = data.active;
    const { error } = await supabaseAdmin.from("ploomes_users").update(patch).eq("ploomes_id", data.ploomes_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Opções de responsável para formulários (SDR etc.), já sincronizadas. */
export const listResponsavelOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data } = await supabase
      .from("ploomes_users")
      .select("ploomes_id,name,active")
      .eq("active", true)
      .order("name", { ascending: true });
    const rows = (data ?? []) as Array<{ ploomes_id: number; name: string }>;
    if (rows.length > 0) return rows.map((r) => ({ value: r.ploomes_id, name: r.name }));
    const schema = await _internalFetchSchema();
    return schema.owners;
  });
