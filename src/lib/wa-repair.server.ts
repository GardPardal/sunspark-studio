// Reparo e recuperação do histórico do WhatsApp a partir dos eventos preservados.

import { normalizeZapiWebhook, previewFor } from "@/lib/wa-normalize.server";
import { persistNormalizedMessage } from "@/lib/wa-store.server";

type Supa = any;

/**
 * Reprocessa os callbacks brutos guardados em wa_events e grava as mensagens
 * que se perderam. Idempotente: mensagens já existentes não são duplicadas.
 */
export async function reingestPreservedEvents(supabase: Supa, orgId: string, limit = 1000) {
  const { data: eventos } = await supabase
    .from("wa_events")
    .select("id, payload")
    .eq("org_id", orgId)
    .order("received_at", { ascending: true })
    .limit(limit);

  let analisados = 0;
  let recuperados = 0;
  let jaExistiam = 0;
  let semConteudo = 0;

  for (const ev of eventos ?? []) {
    const norm = normalizeZapiWebhook(ev.payload);
    if (norm.kind !== "message") continue;
    if (norm.isGroup) continue;
    analisados++;
    if (!norm.text && !norm.media.url && norm.msgType === "unsupported") {
      semConteudo++;
      continue;
    }
    const res = await persistNormalizedMessage(supabase, orgId, norm);
    if (res.ok) {
      if (res.duplicated) jaExistiam++;
      else recuperados++;
    }
  }

  return { analisados, recuperados, jaExistiam, semConteudo };
}

/**
 * Remove apenas as linhas de preenchimento criadas pelo processamento antigo
 * ("[Mensagem recebida]"/"[Mensagem enviada]" sem identificador do provedor).
 * Elas não contêm conteúdo real e o conteúdo verdadeiro volta pelos eventos.
 */
export async function removeLegacyPlaceholders(supabase: Supa, orgId: string) {
  const { data, error } = await supabase
    .from("wa_messages")
    .delete()
    .eq("org_id", orgId)
    .in("body", ["[Mensagem recebida]", "[Mensagem enviada]"])
    .select("id");
  if (error) {
    console.error("[wa repair] placeholders", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/** Recalcula prévia, horário e não lidas de cada conversa a partir das mensagens reais. */
export async function recalcConversations(supabase: Supa, orgId: string) {
  const { data: convs } = await supabase
    .from("wa_conversations")
    .select("id")
    .eq("org_id", orgId)
    .limit(1000);

  let atualizadas = 0;
  for (const c of convs ?? []) {
    const { data: ultima } = await supabase
      .from("wa_messages")
      .select("body, msg_type, media_filename, occurred_at")
      .eq("conversation_id", c.id)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ultima) continue;
    await supabase
      .from("wa_conversations")
      .update({ summary: previewFor(ultima), last_message_at: ultima.occurred_at })
      .eq("id", c.id);
    atualizadas++;
  }
  return atualizadas;
}

/** Conversas sem nenhuma mensagem real (nada a exibir). */
export async function countEmptyConversations(supabase: Supa, orgId: string) {
  const { data: convs } = await supabase
    .from("wa_conversations")
    .select("id")
    .eq("org_id", orgId)
    .limit(1000);
  let vazias = 0;
  for (const c of convs ?? []) {
    const { count } = await supabase
      .from("wa_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", c.id);
    if (!count) vazias++;
  }
  return vazias;
}

/** Corrige nome, telefone e foto dos contatos usando a agenda sincronizada. */
export async function repairContactIdentities(supabase: Supa, orgId: string, refreshPhotos = true) {
  const { pickDisplayName, isGenericContactName } = await import("@/lib/wa-normalize.server");
  const { refreshContactPhoto } = await import("@/lib/wa-identity.server");

  const { data: contatos } = await supabase
    .from("wa_contacts")
    .select("id, profile_name, phone_e164, phone_unknown, lid, photo_url, photo_updated_at")
    .eq("org_id", orgId)
    .limit(2000);

  const { data: directory } = await supabase
    .from("wa_directory")
    .select("lid, phone_e164, name, img_url")
    .eq("org_id", orgId)
    .limit(5000);

  const porLid = new Map((directory ?? []).filter((d: any) => d.lid).map((d: any) => [d.lid, d]));
  const porPhone = new Map(
    (directory ?? []).filter((d: any) => d.phone_e164).map((d: any) => [d.phone_e164, d]),
  );

  let nomesCorrigidos = 0;
  let telefonesResolvidos = 0;
  let fotos = 0;
  let semDadosPublicos = 0;

  for (const c of contatos ?? []) {
    const d: any = (c.lid ? porLid.get(c.lid) : null) ?? porPhone.get(c.phone_e164 ?? "");
    const patch: Record<string, unknown> = {};

    // 1) resolve o telefone antes do nome, para o nome já usar o número real
    let telefone = c.phone_unknown ? null : c.phone_e164;
    let nomeAgenda: string | null = d?.name ?? null;
    if (c.phone_unknown && d?.phone_e164) {
      patch.phone_e164 = d.phone_e164;
      patch.phone_unknown = false;
      telefone = d.phone_e164;
      telefonesResolvidos++;
    }
    // 2) fallback: consulta o chat direto na Z-API quando a agenda não tem o número
    if (!telefone && c.lid) {
      const meta = await fetchChatIdentity(c.lid);
      if (meta?.phone) {
        patch.phone_e164 = meta.phone;
        patch.phone_unknown = false;
        telefone = meta.phone;
        telefonesResolvidos++;
      }
      if (!nomeAgenda && meta?.name) nomeAgenda = meta.name;
    }


    const nomeAtual = (c.profile_name ?? "").trim();
    if (isGenericContactName(nomeAtual)) {
      const novo = pickDisplayName({
        directoryName: d?.name ?? null,
        phone: telefone,
        lid: c.lid,
      });
      if (novo && novo !== nomeAtual) {
        patch.profile_name = novo;
        nomesCorrigidos++;
      }
      if (!d?.name) semDadosPublicos++;
    }


    if (Object.keys(patch).length) {
      await supabase.from("wa_contacts").update(patch).eq("id", c.id);
    }

    if (refreshPhotos) {
      const link = await refreshContactPhoto(supabase, {
        id: c.id,
        phone_e164: c.phone_e164,
        lid: c.lid,
        photo_url: c.photo_url,
        photo_updated_at: c.photo_updated_at,
      });
      if (link) fotos++;
    }
  }

  return {
    contatos: contatos?.length ?? 0,
    nomesCorrigidos,
    telefonesResolvidos,
    fotos,
    semDadosPublicos,
  };
}

/**
 * Contatos criados pelo processamento antigo guardaram identificadores LID no
 * campo de telefone. Aqui eles são fundidos ao contato correto (ou marcados
 * como "sem número"), sem perder mensagens.
 */
export async function mergeLegacyLidContacts(supabase: Supa, orgId: string) {
  const { data: contatos } = await supabase
    .from("wa_contacts")
    .select("id, phone_e164, phone_unknown, lid, profile_name, created_at")
    .eq("org_id", orgId)
    .limit(3000);

  const porLid = new Map<string, any>();
  for (const c of contatos ?? []) {
    if (c.lid) porLid.set(String(c.lid).split("@")[0], c);
  }

  let fundidos = 0;
  let marcados = 0;
  let mensagensMovidas = 0;

  for (const c of contatos ?? []) {
    const digits = (c.phone_e164 ?? "").replace(/\D/g, "");
    if (!digits) continue;
    const pareceLid = digits.length > 13 || porLid.has(digits);
    if (!pareceLid || c.lid) continue;

    const alvo = porLid.get(digits);
    if (alvo && alvo.id !== c.id) {
      const { data: movidas } = await supabase
        .from("wa_messages")
        .update({ contact_id: alvo.id })
        .eq("contact_id", c.id)
        .select("id");
      mensagensMovidas += movidas?.length ?? 0;
      await supabase.from("wa_conversations").update({ contact_id: alvo.id }).eq("contact_id", c.id);
      await supabase.from("wa_contacts").delete().eq("id", c.id);
      fundidos++;
    } else {
      await supabase
        .from("wa_contacts")
        .update({
          lid: `${digits}@lid`,
          phone_unknown: true,
          profile_name: "Contato sem número (WhatsApp privado)",
        })
        .eq("id", c.id);
      porLid.set(digits, { ...c, lid: `${digits}@lid` });
      marcados++;
    }
  }

  return { fundidos, marcados, mensagensMovidas };
}
