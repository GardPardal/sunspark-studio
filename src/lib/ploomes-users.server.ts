// Server-only: lógica de sincronização dos responsáveis do Ploomes.
import { _internalFetchSchema } from "./ploomes-form.functions";

function norm(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cria ou recupera a conta de usuário no Supabase Auth + profile + papel de consultor.
 */
async function ensureAuthUser(supabaseAdmin: any, name: string, emailCandidate: string | null) {
  const cleanName = name.trim();
  let email = emailCandidate?.trim()?.toLowerCase() || "";
  if (!email || !email.includes("@")) {
    const slug = norm(cleanName).replace(/[^a-z0-9]/g, ".");
    email = `${slug || "usuario"}@lz7energia.com.br`;
  }

  try {
    const tempPassword = `LZ7Solar@${new Date().getFullYear()}!`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: cleanName },
    });

    if (created?.user?.id) {
      const uid = created.user.id;
      await supabaseAdmin.from("profiles").upsert({
        id: uid,
        email,
        full_name: cleanName,
        status: "active",
      });
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: uid, role: "consultor" }, { onConflict: "user_id,role" });
      return uid;
    }

    if (error) {
      // Se usuário já existe no auth com esse email, busca o id correspondente
      const { data: existingList } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const found = (existingList?.users ?? []).find(
        (u: any) => (u.email ?? "").toLowerCase() === email,
      );
      if (found?.id) {
        await supabaseAdmin.from("profiles").upsert({
          id: found.id,
          email,
          full_name: cleanName,
          status: "active",
        });
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: found.id, role: "consultor" }, { onConflict: "user_id,role" });
        return found.id;
      }
    }
  } catch (err) {
    console.error("[ensureAuthUser] Error creating user:", err);
  }
  return null;
}

export async function runPloomesUsersSync(createSellers = true) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Fonte: formulário público
  const schema = await _internalFetchSchema();
  const incoming = new Map<
    number,
    { name: string; email: string | null; active: boolean; source: string }
  >();
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
    return {
      synced: 0,
      created: 0,
      linked: 0,
      sellersCreated: 0,
      apiError: apiError ?? "nenhum responsável encontrado",
    };
  }

  // 3) Estado atual
  const [{ data: existing }, { data: profiles }, { data: sellers }] = await Promise.all([
    supabaseAdmin.from("ploomes_users").select("ploomes_id,profile_id,seller_id"),
    supabaseAdmin.from("profiles").select("id,full_name,email,unit,status"),
    supabaseAdmin.from("sales_sellers").select("id,name,profile_id,unit,active"),
  ]);
  const existingMap = new Map<number, { profile_id: string | null; seller_id: string | null }>(
    (existing ?? []).map((r: any) => [
      Number(r.ploomes_id),
      { profile_id: r.profile_id, seller_id: r.seller_id },
    ]),
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
  let usersProvisioned = 0;

  for (const [id, u] of incoming) {
    const prev = existingMap.get(id);
    if (!prev) created += 1;

    let profile_id = prev?.profile_id ?? null;
    if (!profile_id) {
      // 1. Tenta vincular a um perfil existente por e-mail ou nome
      const match =
        (u.email ? profByEmail.get(norm(u.email)) : null) ?? profByName.get(norm(u.name)) ?? null;
      if (match) {
        profile_id = match.id;
        linked += 1;
        // Se o e-mail no Ploomes existe e o perfil está desatualizado, atualiza o perfil
        if (u.email && (!match.email || match.email !== u.email)) {
          await supabaseAdmin.from("profiles").update({ email: u.email }).eq("id", match.id);
        }
      } else {
        // 2. Não tem conta: cria a conta no Supabase Auth + profile + papel consultor
        const newUserId = await ensureAuthUser(supabaseAdmin, u.name, u.email);
        if (newUserId) {
          profile_id = newUserId;
          usersProvisioned += 1;
          linked += 1;
        }
      }
    }

    const prof = profile_id ? (profiles ?? []).find((p: any) => p.id === profile_id) : null;

    let seller_id = prev?.seller_id ?? null;
    if (!seller_id) {
      const s =
        (profile_id ? sellerByProfile.get(profile_id) : null) ??
        sellerByName.get(norm(u.name)) ??
        null;
      if (s) seller_id = s.id;
      else if (createSellers && u.active) {
        newSellers.push({
          name: u.name,
          profile_id,
          unit: prof?.unit ?? null,
          active: true,
          __ploomes_id: id,
        });
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

  const { error } = await supabaseAdmin
    .from("ploomes_users")
    .upsert(rows, { onConflict: "ploomes_id" });
  if (error) throw new Error(error.message);

  return { synced: rows.length, created, linked, sellersCreated, usersProvisioned, apiError };
}
