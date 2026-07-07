import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r: { role: string }) => r.role === "admin")) {
    throw new Error("Acesso restrito a administradores.");
  }
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: usersData, error: usersError }, { data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("id,email,full_name"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
    ]);

    if (usersError) throw new Error(usersError.message);
    if (profilesError) throw new Error(profilesError.message);
    if (rolesError) throw new Error(rolesError.message);

    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const rolesByUser = new Map<string, string[]>();
    for (const row of roles ?? []) {
      const list = rolesByUser.get(row.user_id) ?? [];
      list.push(row.role);
      rolesByUser.set(row.user_id, list);
    }

    return (usersData.users ?? []).map((u: any) => {
      const profile = profileById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? profile?.email ?? "",
        full_name: profile?.full_name ?? u.user_metadata?.full_name ?? null,
        roles: rolesByUser.get(u.id) ?? [],
        created_at: u.created_at,
      };
    }) as Array<{ id: string; email: string; full_name: string | null; roles: string[]; created_at: string }>;
  });

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  fullName: z.string().min(1).max(120),
  role: z.enum(["admin", "consultor", "coordenador"]),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) throw new Error(error.message);
    const newId = created.user?.id;
    if (!newId) throw new Error("Falha ao criar usuário.");

    await supabaseAdmin.from("profiles").upsert({ id: newId, email: data.email, full_name: data.fullName });
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: data.role });
    if (roleErr && !roleErr.message.includes("duplicate")) throw new Error(roleErr.message);

    return { ok: true, id: newId };
  });

const setRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "consultor", "coordenador"]),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Clear existing then insert
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteSchema = z.object({ userId: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertAdmin(supabase, userId);
    if (data.userId === userId) throw new Error("Você não pode excluir a própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (data ?? []).map((r: { role: string }) => r.role);
    return { userId, roles, isAdmin: roles.includes("admin"), isConsultor: roles.includes("consultor") };
  });
