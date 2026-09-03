// Identidade real dos contatos do WhatsApp: nome, telefone, @lid e foto (server-only).
// Fontes oficiais: /contacts, /chats, /chats/{id} e /profile-picture da Z-API.

import { formatBrPhone, isGenericContactName, pickDisplayName } from "@/lib/wa-normalize.server";
import { zApiHeaders, zApiUrl } from "@/lib/zapi.server";

type Supa = any;

const PHOTO_TTL_MS = 20 * 60 * 60 * 1000; // fotos do WhatsApp expiram em 48h

async function zapiGet<T>(endpoint: string): Promise<T | null> {
  try {
    const res = await fetch(zApiUrl(endpoint), { headers: zApiHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.error("[wa identity] falha na Z-API", endpoint, err);
    return null;
  }
}

export function toE164Digits(value: string | null | undefined) {
  const d = (value ?? "").replace(/\D/g, "");
  if (d.length < 8 || d.length > 15) return null;
  return `+${d}`;
}

type DirectoryEntry = {
  lid: string | null;
  phone: string | null;
  name: string | null;
  imgUrl: string | null;
};

/** Baixa a agenda e os chats da instância e guarda o mapa lid ↔ telefone ↔ nome. */
export async function syncWaDirectory(supabase: Supa, orgId: string, maxPages = 20) {
  const entries = new Map<string, DirectoryEntry>();

  const push = (e: DirectoryEntry) => {
    const key = e.lid ?? (e.phone ? `p:${e.phone}` : null);
    if (!key) return;
    const prev = entries.get(key);
    entries.set(key, {
      lid: e.lid ?? prev?.lid ?? null,
      phone: e.phone ?? prev?.phone ?? null,
      name: e.name ?? prev?.name ?? null,
      imgUrl: e.imgUrl ?? prev?.imgUrl ?? null,
    });
  };

  for (let page = 1; page <= maxPages; page++) {
    const rows = await zapiGet<any[]>(`/contacts?page=${page}&pageSize=100`);
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) {
      push({
        lid: typeof r.lid === "string" ? r.lid : null,
        phone: toE164Digits(r.phone),
        name: r.name || r.vname || r.short || r.notify || null,
        imgUrl: typeof r.imgUrl === "string" ? r.imgUrl : null,
      });
    }
    if (rows.length < 100) break;
  }

  for (let page = 1; page <= maxPages; page++) {
    const rows = await zapiGet<any[]>(`/chats?page=${page}&pageSize=100`);
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) {
      if (r.isGroup === true || r.isGroup === "true") continue;
      push({
        lid: typeof r.lid === "string" ? r.lid : null,
        phone: toE164Digits(r.phone),
        name: r.name || null,
        imgUrl: typeof r.profileThumbnail === "string" ? r.profileThumbnail : null,
      });
    }
    if (rows.length < 100) break;
  }

  const now = new Date().toISOString();
  const list = [...entries.values()];
  const comLid = list.filter((e) => e.lid);
  const semLid = list.filter((e) => !e.lid && e.phone);

  const erros: string[] = [];
  let gravados = 0;

  // upsert em lotes: payloads grandes falham silenciosamente na Data API
  const upsertEmLotes = async (
    linhas: Record<string, unknown>[],
    onConflict: string,
  ) => {
    for (let i = 0; i < linhas.length; i += 300) {
      const lote = linhas.slice(i, i + 300);
      const { error } = await supabase.from("wa_directory").upsert(lote, { onConflict });
      if (error) {
        if (erros.length < 3) erros.push(error.message);
        console.error("[wa identity] upsert agenda", error.message);
      } else {
        gravados += lote.length;
      }
    }
  };

  if (comLid.length) {
    await upsertEmLotes(
      comLid.map((e) => ({
        org_id: orgId,
        lid: e.lid,
        phone_e164: e.phone,
        name: e.name,
        img_url: e.imgUrl,
        img_updated_at: e.imgUrl ? now : null,
        updated_at: now,
      })),
      "org_id,lid",
    );
  }
  // Sem @lid não há chave única: resolve por telefone, um a um (poucos casos).
  for (const e of semLid) {
    const linha = {
      org_id: orgId,
      lid: null,
      phone_e164: e.phone,
      name: e.name,
      img_url: e.imgUrl,
      img_updated_at: e.imgUrl ? now : null,
      updated_at: now,
    };
    const { data: existente } = await supabase
      .from("wa_directory")
      .select("id")
      .eq("org_id", orgId)
      .is("lid", null)
      .eq("phone_e164", e.phone)
      .maybeSingle();
    const { error } = existente
      ? await supabase.from("wa_directory").update(linha).eq("id", existente.id)
      : await supabase.from("wa_directory").insert(linha);
    if (error) {
      if (erros.length < 3) erros.push(error.message);
    } else {
      gravados += 1;
    }
  }


  return { total: list.length, comLid: comLid.length, semLid: semLid.length, gravados, erros };
}



async function lookupDirectory(supabase: Supa, orgId: string, lid: string | null, phone: string | null) {
  if (lid) {
    const { data } = await supabase
      .from("wa_directory")
      .select("lid, phone_e164, name, img_url")
      .eq("org_id", orgId)
      .eq("lid", lid)
      .maybeSingle();
    if (data) return data;
  }
  if (phone) {
    const { data } = await supabase
      .from("wa_directory")
      .select("lid, phone_e164, name, img_url")
      .eq("org_id", orgId)
      .eq("phone_e164", phone)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

/** Consulta o metadata do chat quando só temos o @lid. */
async function resolveLidPhone(lid: string) {
  const meta = await zapiGet<any>(`/chats/${encodeURIComponent(lid)}`);
  return toE164Digits(meta?.phone);
}

/** Metadata completo do chat (telefone, nome e foto) a partir do @lid. */
export async function fetchChatIdentity(lid: string) {
  const meta = await zapiGet<any>(`/chats/${encodeURIComponent(lid)}`);
  if (!meta || meta.error) return null;
  return {
    phone: toE164Digits(meta.phone),
    name: typeof meta.name === "string" && meta.name.trim() ? meta.name.trim() : null,
    imgUrl: typeof meta.profileThumbnail === "string" ? meta.profileThumbnail : null,
  };
}


export type IdentityInput = {
  lid?: string | null;
  phone?: string | null; // dígitos
  profileName?: string | null;
  photoUrl?: string | null;
  isFromMe?: boolean;
};

/**
 * Garante um contato com identidade real. Nunca sobrescreve um nome válido por
 * telefone/valor vazio e nunca aplica o nome/foto da conta conectada ao cliente.
 */
export async function resolveWaContact(
  supabase: Supa,
  orgId: string,
  input: IdentityInput,
): Promise<string | null> {
  const lid = input.lid && input.lid.endsWith("@lid") ? input.lid : null;
  let phoneE164 = input.phone ? toE164Digits(input.phone) : null;

  const dir = await lookupDirectory(supabase, orgId, lid, phoneE164);
  if (!phoneE164 && dir?.phone_e164) phoneE164 = dir.phone_e164;
  if (!phoneE164 && lid) {
    const resolved = await resolveLidPhone(lid);
    if (resolved) {
      phoneE164 = resolved;
      await supabase
        .from("wa_directory")
        .upsert(
          { org_id: orgId, lid, phone_e164: resolved, updated_at: new Date().toISOString() },
          { onConflict: "org_id,lid" },
        );
    }
  }
  if (!phoneE164 && !lid) return null;

  // A conta conectada não recebe o nome/foto do cliente e vice-versa.
  const nomeCandidato = input.isFromMe ? null : input.profileName;
  const fotoCandidata = input.isFromMe ? null : input.photoUrl;

  let existing: any = null;
  if (lid) {
    const { data } = await supabase
      .from("wa_contacts")
      .select("id, profile_name, phone_e164, lid, photo_url, photo_updated_at, phone_unknown")
      .eq("org_id", orgId)
      .eq("lid", lid)
      .maybeSingle();
    existing = data ?? null;
  }
  if (!existing && phoneE164) {
    const { data } = await supabase
      .from("wa_contacts")
      .select("id, profile_name, phone_e164, lid, photo_url, photo_updated_at, phone_unknown")
      .eq("org_id", orgId)
      .eq("phone_e164", phoneE164)
      .maybeSingle();
    existing = data ?? null;
  }

  const nomeFinal = (n: string | null | undefined) => {
    const atual = (n ?? "").trim();
    if (!isGenericContactName(atual)) return atual;

    return pickDisplayName({
      directoryName: dir?.name ?? null,
      profileName: nomeCandidato ?? null,
      phone: phoneE164 ?? undefined,
      lid,
    });
  };

  if (existing) {
    const patch: Record<string, unknown> = {};
    const nome = nomeFinal(existing.profile_name);
    if (nome && nome !== existing.profile_name) patch.profile_name = nome;
    if (lid && existing.lid !== lid) patch.lid = lid;
    if (phoneE164 && existing.phone_e164 !== phoneE164 && !existing.phone_e164?.startsWith("+lid")) {
      // só troca o telefone quando o atual era desconhecido/derivado do lid
      if (existing.phone_unknown) {
        patch.phone_e164 = phoneE164;
        patch.phone_unknown = false;
      }
    }
    const foto = fotoCandidata ?? dir?.img_url ?? null;
    if (foto && foto !== existing.photo_url) {
      patch.photo_url = foto;
      patch.photo_updated_at = new Date().toISOString();
    }
    if (Object.keys(patch).length) {
      await supabase.from("wa_contacts").update(patch).eq("id", existing.id);
    }
    return existing.id as string;
  }

  const phoneParaGravar = phoneE164 ?? `+${(lid ?? "").replace(/\D/g, "")}`;
  const { data: created, error } = await supabase
    .from("wa_contacts")
    .insert({
      org_id: orgId,
      phone_e164: phoneParaGravar,
      phone_unknown: !phoneE164,
      lid,
      wa_id: lid,
      profile_name: nomeFinal(null),
      photo_url: fotoCandidata ?? dir?.img_url ?? null,
      photo_updated_at: fotoCandidata || dir?.img_url ? new Date().toISOString() : null,
      last_inbound_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("[wa identity] insert contato", error.message);
    // corrida: tenta ler de novo
    const { data: again } = await supabase
      .from("wa_contacts")
      .select("id")
      .eq("org_id", orgId)
      .eq("phone_e164", phoneParaGravar)
      .maybeSingle();
    return again?.id ?? null;
  }
  return created.id as string;
}

/** Renova a foto do contato respeitando a expiração de 48h do WhatsApp. */
export async function refreshContactPhoto(
  supabase: Supa,
  contact: {
    id: string;
    phone_e164: string | null;
    lid: string | null;
    photo_url: string | null;
    photo_updated_at: string | null;
  },
  force = false,
) {
  const idade = contact.photo_updated_at ? Date.now() - Date.parse(contact.photo_updated_at) : Infinity;
  if (!force && contact.photo_url && idade < PHOTO_TTL_MS) return contact.photo_url;

  const alvo = contact.lid ?? contact.phone_e164?.replace(/\D/g, "");
  if (!alvo) return contact.photo_url;

  const res = await zapiGet<{ link?: string }>(`/profile-picture?phone=${encodeURIComponent(alvo)}`);
  const link = typeof res?.link === "string" && res.link.startsWith("http") ? res.link : null;

  await supabase
    .from("wa_contacts")
    .update({ photo_url: link, photo_updated_at: new Date().toISOString() })
    .eq("id", contact.id);

  return link;
}

export { formatBrPhone };
