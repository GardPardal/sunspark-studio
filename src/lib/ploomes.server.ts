// Server-only helpers for Ploomes push. Import ONLY from inside server-fn handlers.
const PLOOMES_API = "https://public-api2.ploomes.com";

async function ploomesFetch(
  path: string,
  init?: { method?: string; body?: any },
): Promise<any> {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) throw new Error("Sem PLOOMES_USER_KEY");
  const res = await fetch(`${PLOOMES_API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "User-Key": key,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Ploomes ${res.status}: ${text.slice(0, 400)}`);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function pushLeadToPloomesInternal(leadId: string) {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "sem chave" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("id, nome, telefone, email, cidade, estado, external_id, external_source")
    .eq("id", leadId)
    .single();
  if (error || !lead) return { ok: false, reason: error?.message ?? "lead não encontrado" };
  if (lead.external_source === "ploomes" && lead.external_id) {
    return { ok: true, skipped: true, reason: "já existe no Ploomes" };
  }

  try {
    const body: any = {
      Name: lead.nome,
      Email: lead.email ?? undefined,
      Phones: lead.telefone
        ? [{ PhoneNumber: lead.telefone, TypeId: 2, CountryId: 76 }]
        : [],
      TypeId: 1,
    };
    const created = await ploomesFetch("/Contacts", { method: "POST", body });
    const ploomesId = created?.value?.[0]?.Id ?? created?.Id;
    if (ploomesId) {
      await supabaseAdmin
        .from("leads")
        .update({
          external_source: "ploomes",
          external_id: String(ploomesId),
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", leadId);
    }
    return { ok: true, ploomesId };
  } catch (e: any) {
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_push",
      status: "error",
      message: `lead ${leadId}: ${String(e?.message ?? e).slice(0, 400)}`,
    });
    return { ok: false, reason: e?.message ?? String(e) };
  }
}

export async function upsertLeadFromPloomesContact(contact: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const phone =
    contact.Phones?.find((p: any) => p.PhoneNumber)?.PhoneNumber ??
    contact.Phones?.[0]?.PhoneNumber ??
    "";
  if (!phone) return { ok: false, reason: "sem telefone" };

  const payload = {
    external_source: "ploomes" as const,
    external_id: String(contact.Id),
    nome: (contact.Name ?? "Sem nome").toString().slice(0, 200),
    telefone: String(phone).slice(0, 40),
    email: contact.Email ?? null,
    cidade: contact.City?.Name ?? null,
    estado: contact.City?.StateShortName ?? null,
    origem: "Ploomes",
    last_synced_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin
    .from("leads")
    .upsert(payload, { onConflict: "external_source,external_id" });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
