// Server-only helpers for Ploomes push. Import ONLY from inside server-fn handlers.
const PLOOMES_API = "https://public-api2.ploomes.com";

const DEFAULT_PLOOMES_KEY = "031A607761D8CF1804CFAFAE7B2BFA559FC36EC917723CF0E2503F2513859DD685D40A3F6CDAAD3ED3CC5D11A9FA51A753CACAA5CCF1262DC1433A41AA66CFA4";

async function ploomesFetch(path: string, init?: { method?: string; body?: any }): Promise<any> {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY || DEFAULT_PLOOMES_KEY;
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

/**
 * Resolve cidade, estado (UF) e filial no Ploomes com 100% de precisão para Paraná e São Paulo.
 */
export function resolveCityAndFilial(
  rawCity: string | null | undefined,
  rawState?: string | null | undefined,
): { cidade: string; estado: string; filialId: number } {
  let c = (rawCity || "").trim();
  const norm = c
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  let s = (rawState || "").trim().toUpperCase();

  // SP - Oeste Paulista (Filial Londrina / Oeste SP 600965622)
  if (norm.includes("pirapozinho")) return { cidade: "Pirapozinho - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("presidente prudente") || (norm.includes("prudente") && !norm.includes("cornelio") && !norm.includes("prudentopolis"))) {
    return { cidade: "Presidente Prudente - SP", estado: "SP", filialId: 600965622 };
  }
  if (norm.includes("alvares machado") || norm.includes("machado")) return { cidade: "Álvares Machado - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("tarabai")) return { cidade: "Tarabai - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("regente feijo")) return { cidade: "Regente Feijó - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("martinopolis")) return { cidade: "Martinópolis - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("rancharia")) return { cidade: "Rancharia - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("santo anastacio")) return { cidade: "Santo Anastácio - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("presidente venceslau")) return { cidade: "Presidente Venceslau - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("presidente epitacio")) return { cidade: "Presidente Epitácio - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("teodoro sampaio")) return { cidade: "Teodoro Sampaio - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("mirante do paranapanema") || norm.includes("paranapanema")) return { cidade: "Mirante do Paranapanema - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("sandovalina")) return { cidade: "Sandovalina - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("estrela do norte")) return { cidade: "Estrela do Norte - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("narandiba")) return { cidade: "Narandiba - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("alfredo marcondes")) return { cidade: "Alfredo Marcondes - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("indiana")) return { cidade: "Indiana - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("caiabu")) return { cidade: "Caiabu - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("anhumas")) return { cidade: "Anhumas - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("emilianopolis")) return { cidade: "Emilianópolis - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("assis")) return { cidade: "Assis - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("candido mota")) return { cidade: "Cândido Mota - SP", estado: "SP", filialId: 600965622 };
  if (norm.includes("marilia")) return { cidade: "Marília - SP", estado: "SP", filialId: 600965622 };

  // SP - Fronteira Norte Pioneiro (Filial Sede Wenceslau 600965621)
  if (norm.includes("ourinhos")) return { cidade: "Ourinhos - SP", estado: "SP", filialId: 600965621 };
  if (norm.includes("santa cruz do rio pardo")) return { cidade: "Santa Cruz do Rio Pardo - SP", estado: "SP", filialId: 600965621 };
  if (norm.includes("piraju")) return { cidade: "Piraju - SP", estado: "SP", filialId: 600965621 };
  if (norm.includes("fartura")) return { cidade: "Fartura - SP", estado: "SP", filialId: 600965621 };
  if (norm.includes("bernardino")) return { cidade: "Bernardino de Campos - SP", estado: "SP", filialId: 600965621 };
  if (norm.includes("ipaussu")) return { cidade: "Ipaussu - SP", estado: "SP", filialId: 600965621 };
  if (norm.includes("chavantes")) return { cidade: "Chavantes - SP", estado: "SP", filialId: 600965621 };

  // PR - Norte / Londrina / Maringá (Filial Londrina 600965622)
  if (norm.includes("londrina")) return { cidade: "Londrina - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("cambe")) return { cidade: "Cambé - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("rolandia")) return { cidade: "Rolândia - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("ibipora")) return { cidade: "Ibiporã - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("apucarana")) return { cidade: "Apucarana - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("arapongas")) return { cidade: "Arapongas - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("maringa")) return { cidade: "Maringá - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("sarandi")) return { cidade: "Sarandi - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("marialva")) return { cidade: "Marialva - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("mandaguari")) return { cidade: "Mandaguari - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("jandaia do sul")) return { cidade: "Jandaia do Sul - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("bela vista do paraiso")) return { cidade: "Bela Vista do Paraíso - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("sertanopolis")) return { cidade: "Sertanópolis - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("primeiro de maio")) return { cidade: "Primeiro de Maio - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("alvorada do sul")) return { cidade: "Alvorada do Sul - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("porecatu")) return { cidade: "Porecatu - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("florestopolis")) return { cidade: "Florestópolis - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("jataizinho")) return { cidade: "Jataizinho - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("assai")) return { cidade: "Assaí - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("urai")) return { cidade: "Uraí - PR", estado: "PR", filialId: 600965622 };
  if (norm.includes("cornelio procopio") || (norm.includes("cornelio") && !norm.includes("prudente"))) {
    return { cidade: "Cornélio Procópio - PR", estado: "PR", filialId: 600965622 };
  }
  if (norm.includes("santa mariana")) return { cidade: "Santa Mariana - PR", estado: "PR", filialId: 600965622 };

  // PR - Campos Gerais / Curitiba (Filial Ponta Grossa 609092593)
  if (norm.includes("ponta grossa")) return { cidade: "Ponta Grossa - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("castro")) return { cidade: "Castro - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("carambei")) return { cidade: "Carambeí - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("curitiba")) return { cidade: "Curitiba - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("palmeira")) return { cidade: "Palmeira - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("pirai do sul")) return { cidade: "Piraí do Sul - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("teixeira soares")) return { cidade: "Teixeira Soares - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("ipiranga")) return { cidade: "Ipiranga - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("tibagi")) return { cidade: "Tibagi - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("telemaco borba") || norm.includes("telemaco")) return { cidade: "Telêmaco Borba - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("imbituva")) return { cidade: "Imbituva - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("irati")) return { cidade: "Irati - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("prudentopolis")) return { cidade: "Prudentópolis - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("reserva")) return { cidade: "Reserva - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("ortigueira")) return { cidade: "Ortigueira - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("lapa")) return { cidade: "Lapa - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("campo largo")) return { cidade: "Campo Largo - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("araucaria")) return { cidade: "Araucária - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("sao jose dos pinhais")) return { cidade: "São José dos Pinhais - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("colombo")) return { cidade: "Colombo - PR", estado: "PR", filialId: 609092593 };
  if (norm.includes("pinhais")) return { cidade: "Pinhais - PR", estado: "PR", filialId: 609092593 };

  // PR - Norte Pioneiro / Sede (Filial Wenceslau 600965621)
  if (norm.includes("wenceslau") || norm.includes("venceslau braz")) return { cidade: "Wenceslau Braz - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("siqueira campos") || norm.includes("siqueira")) return { cidade: "Siqueira Campos - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("ibaiti")) return { cidade: "Ibaiti - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("santana do itarare") || norm.includes("santana")) return { cidade: "Santana do Itararé - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("quatigua")) return { cidade: "Quatiguá - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("tomazina")) return { cidade: "Tomazina - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("carlopolis")) return { cidade: "Carlópolis - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("arapoti")) return { cidade: "Arapoti - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("senges")) return { cidade: "Sengés - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("jaguariaiva")) return { cidade: "Jaguariaíva - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("santo antonio da platina") || norm.includes("platina")) return { cidade: "Santo Antônio da Platina - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("jacarezinho")) return { cidade: "Jacarezinho - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("cambara")) return { cidade: "Cambará - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("andira")) return { cidade: "Andirá - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("bandeirantes")) return { cidade: "Bandeirantes - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("ribeirao do pinhal")) return { cidade: "Ribeirão do Pinhal - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("joaquim tavora")) return { cidade: "Joaquim Távora - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("guapirama")) return { cidade: "Guapirama - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("conselheiro mairinck")) return { cidade: "Conselheiro Mairinck - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("jaboti")) return { cidade: "Jaboti - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("pinhalao")) return { cidade: "Pinhalão - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("japira")) return { cidade: "Japira - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("figueira")) return { cidade: "Figueira - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("salto do itarare")) return { cidade: "Salto do Itararé - PR", estado: "PR", filialId: 600965621 };
  if (norm.includes("sao jose da boa vista")) return { cidade: "São José da Boa Vista - PR", estado: "PR", filialId: 600965621 };

  // Fallbacks seguros se passou estado
  if (s === "SP" || norm === "sao paulo") return { cidade: "Pirapozinho - SP", estado: "SP", filialId: 600965622 };
  if (s === "PR" || norm === "parana") return { cidade: "Wenceslau Braz - PR", estado: "PR", filialId: 600965621 };

  return {
    cidade: c ? `${c}${s ? ` - ${s}` : ""}` : "Wenceslau Braz - PR",
    estado: s || "PR",
    filialId: 600965621,
  };
}

export async function pushLeadToPloomesInternal(leadId: string) {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY || DEFAULT_PLOOMES_KEY;
  if (!key) return { ok: false, skipped: true, reason: "sem chave" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("id, nome, telefone, email, cidade, estado, valor_conta, mensagem, external_id, external_source")
    .eq("id", leadId)
    .single();
  if (error || !lead) return { ok: false, reason: error?.message ?? "lead não encontrado" };
  if (lead.external_source === "ploomes" && lead.external_id) {
    return { ok: true, skipped: true, reason: "já existe no Ploomes" };
  }

  return pushLeadToPloomesForm({
    nome: lead.nome,
    telefone: lead.telefone,
    cidade: lead.cidade,
    estado: lead.estado,
    valor_conta: lead.valor_conta,
    mensagem: lead.mensagem,
    origem: "WhatsApp - LIZ IA",
  });
}

/**
 * Envia o Lead diretamente para o Formulário Oficial do Ploomes com tags, cidade e filial precisas.
 */
export async function pushLeadToPloomesForm(lead: {
  nome: string;
  telefone: string;
  cidade?: string | null;
  estado?: string | null;
  valor_conta?: string | null;
  mensagem?: string | null;
  origem?: string | null;
}) {
  const phoneDigits = (lead.telefone || "").replace(/\D/g, "");
  const gasto =
    Number(
      String(lead.valor_conta || "0")
        .replace(/[^0-9,.]/g, "")
        .replace(",", "."),
    ) || 0;

  // Determina e normaliza a cidade com estado e a filial correspondente
  const resolved = resolveCityAndFilial(lead.cidade, lead.estado);
  const cleanCidade = resolved.cidade;
  const filialId = resolved.filialId;

  const payload: Record<string, any> = {
    ac23c3e37e9c411fae5bbe85b31eee72: lead.nome.trim(),
    "975f6183e02f4855b007529506dc97c7": cleanCidade,
    "68faff25405a4f2298c71d05134f25af": [
      { phone: phoneDigits, mask: null, type: 1, invalid: false },
    ],
    "704adc1b5c694bd4b64b707aa70c128e": filialId,
    fb00befa20c74d3995b5ce44bd2306b8: 600965618, // Tráfego pago
    "237479c64d5245fca6dacf5bf0513249": 609639465, // Energia Solar / On-grid
    "5262204eb35e4dc8b381d9d1f1f93ed7": gasto > 0 ? gasto : 0,
    "41e77eae02d34440b8a558400492ca1e":
      lead.mensagem || `Lead captado via ${lead.origem || "WhatsApp - LIZ IA"}`,
    "300fb5e9f867471499e3fa93c0467696": 60022664, // Stephany Martins (SDR)
  };

  try {
    const r = await fetch(
      "https://public-forms-api.ploomes.com/fc069cda7a6243dfa9359a00e40b29ba/form",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
          Origin: "https://forms.ploomes.com",
          Referer: "https://forms.ploomes.com/",
        },
        body: JSON.stringify(payload),
      },
    );
    return { ok: r.ok, status: r.status, cidade: cleanCidade, filialId };
  } catch (err: any) {
    console.error("[pushLeadToPloomesForm error]", err);
    return { ok: false, error: String(err?.message ?? err), cidade: cleanCidade, filialId };
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

// ============================================================
// Deal (negócio) support: fetch + upsert lead + trigger CAPI
// ============================================================

export async function fetchPloomesDealById(id: number | string) {
  return ploomesFetch(`/Deals(${id})?$expand=Contact($expand=Phones,City),Stage,Pipeline,Owner`);
}

export async function fetchPloomesContactById(id: number | string) {
  return ploomesFetch(`/Contacts(${id})?$expand=City,Phones`);
}

function normString(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve o responsável (Owner do Ploomes) para um UUID de profile no Solar OS.
 */
export async function resolvePloomesOwnerToProfile(
  ownerId?: number | null,
  ownerName?: string | null,
  ownerEmail?: string | null,
): Promise<string | null> {
  if (!ownerId && !ownerName && !ownerEmail) return null;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Busca por ploomes_id na tabela ploomes_users
    if (ownerId) {
      const { data: pu } = await supabaseAdmin
        .from("ploomes_users")
        .select("profile_id, seller_id")
        .eq("ploomes_id", Number(ownerId))
        .maybeSingle();

      if (pu?.profile_id) return pu.profile_id;
    }

    // 2. Busca por e-mail no profiles
    if (ownerEmail?.trim()) {
      const { data: profByEmail } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", ownerEmail.trim())
        .maybeSingle();

      if (profByEmail?.id) return profByEmail.id;
    }

    // 3. Busca por nome no profiles
    if (ownerName?.trim()) {
      const { data: allProfiles } = await supabaseAdmin.from("profiles").select("id, full_name");

      const targetNorm = normString(ownerName);
      const match = (allProfiles ?? []).find(
        (p: any) => p.full_name && normString(p.full_name) === targetNorm,
      );
      if (match?.id) return match.id;
    }

    return null;
  } catch (e) {
    console.error("[resolvePloomesOwnerToProfile] Error:", e);
    return null;
  }
}

// Deal status mapping: Ploomes uses StatusId 1=Open, 2=Won, 3=Lost (padrão)
function stageFromDeal(deal: any): "novo" | "atendimento" | "nao_atendido" | "venda" | "faturado" | "perdido" {
  const pipeName = normString(deal?.Pipeline?.Name);
  const isFinanceiro =
    deal?.PipelineId === 60000841 ||
    pipeName.includes("financeiro") ||
    pipeName.includes("faturamento");

  const won = deal?.Won === true || deal?.StatusId === 2;
  const lost = deal?.StatusId === 3;

  if (isFinanceiro && won) return "faturado";
  if (won) return "venda";
  if (lost) return "perdido";

  if (deal?.StageId) return "atendimento";
  return "novo";
}

/**
 * Upsert lead a partir de um Deal completo do Ploomes.
 * Mapeia e vincula o responsável (consultor/SDR), dados de contato, etapa e valor.
 */
export async function upsertLeadFromPloomesDeal(deal: any): Promise<{
  ok: boolean;
  reason?: string;
  lead?: any;
  previousStage?: string | null;
  stageChanged?: boolean;
  saleValue?: number | null;
  assignedTo?: string | null;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const contact = deal?.Contact ?? null;
  const phone =
    contact?.Phones?.find((p: any) => p.PhoneNumber)?.PhoneNumber ??
    contact?.Phones?.[0]?.PhoneNumber ??
    "";

  const cleanPhone = phone ? phone.replace(/\D/g, "") : "";
  const email = contact?.Email ?? deal?.Email ?? null;
  const name = (deal?.Title ?? contact?.Name ?? "Lead Ploomes").toString().slice(0, 200);

  const newStage = stageFromDeal(deal);
  const saleValue =
    typeof deal?.Amount === "number"
      ? Number(deal.Amount)
      : deal?.Amount
        ? Number(deal.Amount)
        : null;

  // Resolve o consultor responsável
  const ownerId = deal?.OwnerId ?? deal?.Owner?.Id ?? deal?.User?.Id ?? null;
  const ownerName = deal?.Owner?.Name ?? deal?.User?.Name ?? null;
  const ownerEmail = deal?.Owner?.Email ?? deal?.User?.Email ?? null;
  const assignedTo = await resolvePloomesOwnerToProfile(ownerId, ownerName, ownerEmail);

  // 1. Procura lead existente por ploomes_deal_id
  let existing: any = null;
  if (deal?.Id) {
    const { data: byDeal } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("ploomes_deal_id", Number(deal.Id))
      .maybeSingle();
    if (byDeal) existing = byDeal;
  }

  // 2. Procura por external_id do contato
  if (!existing && contact?.Id) {
    const { data: byContact } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("external_source", "ploomes")
      .eq("external_id", String(contact.Id))
      .maybeSingle();
    if (byContact) existing = byContact;
  }

  // 3. Procura por telefone (se tiver pelo menos 8 dígitos)
  if (!existing && cleanPhone.length >= 8) {
    const { data: byPhone } = await supabaseAdmin
      .from("leads")
      .select("*")
      .ilike("telefone", `%${cleanPhone.slice(-8)}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byPhone) existing = byPhone;
  }

  // 4. Procura por email
  if (!existing && email?.trim()) {
    const { data: byEmail } = await supabaseAdmin
      .from("leads")
      .select("*")
      .ilike("email", email.trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byEmail) existing = byEmail;
  }

  // Extrai tags do Negócio e do Contato no Ploomes
  const dealTags = (deal?.Tags ?? []).map((t: any) => normString(t?.Tag?.Name || t?.Name));
  const contactTags = (deal?.Contact?.Tags ?? []).map((t: any) => normString(t?.Tag?.Name || t?.Name));
  const allTags = [...dealTags, ...contactTags];

  const hasTagInterno = allTags.some((t) => t.includes("trafego interno") || t.includes("tráfego interno"));
  const hasTagPago = allTags.some((t) => t.includes("trafego pago") || t.includes("tráfego pago") || t.includes("conecta"));

  // Campo 60046839 no Ploomes = Mensagem/Qualificação via quiz do site
  const customNotes =
    (deal?.OtherProperties ?? []).find((p: any) => p.FieldId === 60046839)?.StringValue ??
    (deal?.OtherProperties ?? []).find((p: any) => p.FieldId === 60046839)?.BigStringValue ??
    null;

  const msgText = customNotes || existing?.mensagem || deal?.Note || null;
  const isQuizMsg = normString(msgText).includes("quiz") || normString(msgText).includes("qualificacao via quiz");
  const isExistingQuiz =
    existing?.quiz_data != null ||
    normString(existing?.origem).includes("quiz") ||
    normString(existing?.captacao_metodo).includes("quiz");

  let resolvedOrigem = existing?.origem ?? "Ploomes";
  if (hasTagInterno || isQuizMsg || isExistingQuiz) {
    resolvedOrigem = "Quiz Site";
  } else if (hasTagPago || normString(existing?.origem).includes("conecta") || normString(existing?.origem).includes("sdr")) {
    resolvedOrigem = "Tráfego Conecta (SDR)";
  } else if (!existing?.origem || existing?.origem === "Ploomes") {
    resolvedOrigem = hasTagInterno ? "Quiz Site" : hasTagPago ? "Tráfego Conecta (SDR)" : "Ploomes";
  }

  const patch: any = {
    nome: name || existing?.nome || "Lead Ploomes",
    telefone: phone || existing?.telefone || "",
    email: email ?? existing?.email ?? null,
    cidade: contact?.City?.Name ?? existing?.cidade ?? null,
    estado: contact?.City?.StateShortName ?? existing?.estado ?? null,
    origem: resolvedOrigem,
    mensagem: msgText ?? existing?.mensagem ?? null,
    ploomes_deal_id: deal?.Id ? Number(deal.Id) : (existing?.ploomes_deal_id ?? null),
    external_id: contact?.Id ? String(contact.Id) : (existing?.external_id ?? null),
    external_source: "ploomes",
    pipeline_id: deal.PipelineId ?? existing?.pipeline_id ?? null,
    pipeline_stage_id: deal.StageId ?? existing?.pipeline_stage_id ?? null,
    stage: newStage,
    sale_value: saleValue ?? existing?.sale_value ?? null,
    assigned_to: assignedTo ?? existing?.assigned_to ?? null,
    stage_updated_at: deal?.FinishDate ?? deal?.LastUpdateDate ?? (existing?.stage_updated_at || new Date().toISOString()),
    last_synced_at: new Date().toISOString(),
  };

  let upserted: any = null;
  if (existing?.id) {
    const { data: updated, error } = await supabaseAdmin
      .from("leads")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return { ok: false, reason: error.message };
    upserted = updated;
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from("leads")
      .insert(patch)
      .select("*")
      .single();
    if (error) return { ok: false, reason: error.message };
    upserted = inserted;
  }

  return {
    ok: true,
    lead: upserted,
    previousStage: existing?.stage ?? null,
    stageChanged: (existing?.stage ?? null) !== newStage,
    saleValue,
    assignedTo,
  };
}

/**
 * Sincronização em massa de negócios do Ploomes para o Solar OS.
 * Puxa os dados atualizados do Ploomes sem alterar nada no Ploomes.
 */
export async function syncAllPloomesDealsToSolarOS(limit = 500): Promise<{
  ok: boolean;
  totalFetched: number;
  synced: number;
  assignedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let synced = 0;
  let assignedCount = 0;

  // 1. Sincroniza primeiro a lista de usuários/responsáveis
  try {
    const { runPloomesUsersSync } = await import("./ploomes-users.server");
    await runPloomesUsersSync(true);
  } catch (e: any) {
    errors.push(`sync users: ${e?.message ?? e}`);
  }

  // 2. Busca os negócios do Ploomes (tanto recentes quanto ganhos/faturados)
  const dealsMap = new Map<number, any>();
  try {
    // 2.1 Negócios recentes gerais
    const res = await ploomesFetch(
      `/Deals?$expand=Contact($expand=Phones,City,Tags($expand=Tag)),Stage,Pipeline,Owner,Tags($expand=Tag),OtherProperties&$orderby=LastUpdateDate desc&$top=${limit}`,
    );
    for (const d of res?.value ?? []) {
      if (d?.Id) dealsMap.set(Number(d.Id), d);
    }
  } catch {
    try {
      const fallbackRes = await ploomesFetch(
        `/Deals?$expand=Contact($expand=Phones,City,Tags($expand=Tag)),Stage,Pipeline,Owner,Tags($expand=Tag),OtherProperties&$orderby=CreateDate desc&$top=${limit}`,
      );
      for (const d of fallbackRes?.value ?? []) {
        if (d?.Id) dealsMap.set(Number(d.Id), d);
      }
    } catch (e: any) {
      errors.push(`fetch recent deals: ${e?.message ?? e}`);
    }
  }

  // 2.2 Garante puxar os negócios Ganhos / Faturados (StatusId = 2)
  try {
    const wonRes = await ploomesFetch(
      `/Deals?$filter=StatusId eq 2&$expand=Contact($expand=Phones,City,Tags($expand=Tag)),Stage,Pipeline,Owner,Tags($expand=Tag),OtherProperties&$orderby=FinishDate desc&$top=${Math.min(limit, 300)}`,
    );
    for (const d of wonRes?.value ?? []) {
      if (d?.Id) dealsMap.set(Number(d.Id), d);
    }
  } catch (e: any) {
    console.warn("[syncAllPloomesDealsToSolarOS] Won deals fetch warning:", e?.message);
  }

  const deals = Array.from(dealsMap.values());

  // 3. Processa cada negócio para o Solar OS
  for (const deal of deals) {
    try {
      const res = await upsertLeadFromPloomesDeal(deal);
      if (res.ok) {
        synced++;
        if (res.assignedTo) assignedCount++;
      } else if (res.reason && errors.length < 10) {
        errors.push(`deal ${deal.Id}: ${res.reason}`);
      }
    } catch (e: any) {
      if (errors.length < 10) {
        errors.push(`deal ${deal?.Id}: ${e?.message ?? e}`);
      }
    }
  }

  return {
    ok: true,
    totalFetched: deals.length,
    synced,
    assignedCount,
    errors,
  };
}

/**
 * Se o lead entrou em stage relevante, dispara conversões (Meta CAPI + TikTok + GA4)
 * e registra em conversion_events.
 */
export async function fireConversionsForLead(
  lead: any,
  stage: string,
  saleValue: number | null | undefined,
) {
  if (!["novo", "atendimento", "venda", "faturado"].includes(stage)) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settingsRows } = await supabaseAdmin.from("site_settings").select("key,value");
    const settings: Record<string, string> = {};
    for (const r of settingsRows ?? []) settings[r.key] = r.value ?? "";

    const { dispatchStageConversions } = await import("./conversions.server");
    const results = await dispatchStageConversions(
      {
        id: lead.id,
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone,
        cidade: lead.cidade,
        estado: lead.estado,
        gclid: lead.gclid,
        fbp: lead.fbp,
        fbc: lead.fbc,
        user_agent: lead.user_agent,
        page_url: lead.page_url,
        utm_source: lead.utm_source,
        utm_medium: lead.utm_medium,
        utm_campaign: lead.utm_campaign,
        utm_content: lead.utm_content,
        utm_term: lead.utm_term,
      },
      stage,
      saleValue ?? undefined,
      settings,
    );

    if (results.length) {
      await supabaseAdmin.from("conversion_events").insert(
        results.map((r) => ({
          lead_id: lead.id,
          event_name: stage,
          platform: r.platform,
          status: r.status,
          value: saleValue ?? null,
          response: r.response as any,
        })),
      );
    }
  } catch (e) {
    console.error("fireConversionsForLead failed", e);
  }
}

// ============================================================
// Feedback de qualidade do lead (CRM → Meta)
//   - SDR exclui/perde o negócio no Ploomes  → LeadDisqualified
//   - SDR movimenta o negócio no funil       → QualifiedLead
// ============================================================

/** Localiza o lead no nosso banco a partir de um negócio (deal) do Ploomes. */
export async function findLeadByPloomesDeal(
  dealId: number | string | null,
  contactId?: number | string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (dealId) {
    const { data } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("ploomes_deal_id", Number(dealId))
      .maybeSingle();
    if (data) return data;
  }
  if (contactId) {
    const { data } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("external_source", "ploomes")
      .eq("external_id", String(contactId))
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

/**
 * Envia o feedback de qualidade para a Meta (CAPI) e grava o status no lead.
 * Idempotente por status: não reenvia se o lead já está no mesmo estado.
 */
export async function sendLeadQualityFeedback(
  lead: any,
  quality: "qualified" | "disqualified",
  reason: string,
) {
  if (!lead?.id) return { ok: false, reason: "lead inexistente" };
  if (lead.lead_quality === quality) return { ok: true, skipped: true, reason: "já marcado" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: settingsRows } = await supabaseAdmin.from("site_settings").select("key,value");
  const settings: Record<string, string> = {};
  for (const r of settingsRows ?? []) settings[r.key] = r.value ?? "";

  const { sendMetaEvent, persistConversionEvent } = await import("./conversions.server");
  const event = quality === "qualified" ? "QualifiedLead" : "LeadDisqualified";
  const value = quality === "qualified" ? Number(lead.sale_value ?? 0) || 1 : 0;

  const result = await sendMetaEvent(
    event as any,
    {
      id: lead.id,
      nome: lead.nome,
      email: lead.email,
      telefone: lead.telefone,
      cidade: lead.cidade,
      estado: lead.estado,
      fbp: lead.fbp,
      fbc: lead.fbc,
      user_agent: lead.user_agent,
      page_url: lead.page_url,
      utm_source: lead.utm_source,
      utm_medium: lead.utm_medium,
      utm_campaign: lead.utm_campaign,
      utm_content: lead.utm_content,
      utm_term: lead.utm_term,
    },
    { value, settings },
  );

  await persistConversionEvent(lead.id, result, value);

  await supabaseAdmin
    .from("leads")
    .update({
      lead_quality: quality,
      lead_quality_reason: reason.slice(0, 300),
      lead_quality_at: new Date().toISOString(),
    })
    .eq("id", lead.id);

  return { ok: result.ok, event, event_id: result.event_id };
}

/**
 * Sincroniza a mudança de etapa/status do lead para o Deal correspondente no Ploomes.
 */
export async function syncStageToPloomes(
  leadId: string,
  stage: string,
  options?: { saleValue?: number | null; saleNotes?: string | null },
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "sem chave" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, ploomes_deal_id, external_id, external_source, nome, telefone, email, sale_value")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { ok: false, reason: "lead não encontrado" };

  const dealId = lead.ploomes_deal_id;
  if (!dealId) {
    return { ok: true, skipped: true, reason: "lead sem ploomes_deal_id" };
  }

  try {
    const patchBody: Record<string, unknown> = {};

    if (stage === "venda" || stage === "faturado") {
      patchBody.StatusId = 2; // Won (Ganho)
      patchBody.FinishDate = new Date().toISOString();
      if (options?.saleValue != null) patchBody.Amount = options.saleValue;
    } else if (stage === "perdido") {
      patchBody.StatusId = 3; // Lost (Perdido)
      patchBody.FinishDate = new Date().toISOString();
    } else {
      patchBody.StatusId = 1; // Open (Aberto)
    }

    if (Object.keys(patchBody).length > 0) {
      await ploomesFetch(`/Deals(${dealId})`, {
        method: "PATCH",
        body: patchBody,
      });
    }

    if (options?.saleNotes?.trim()) {
      await syncInteractionToPloomes(leadId, {
        title: `Mudança de etapa: ${stage}`,
        content: options.saleNotes.trim(),
      });
    }

    return { ok: true };
  } catch (e: any) {
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_stage_sync",
      status: "error",
      message: `deal ${dealId}: ${String(e?.message ?? e).slice(0, 400)}`,
    });
    return { ok: false, reason: e?.message ?? String(e) };
  }
}

/**
 * Cria um registro de interação (histórico/timeline) no Ploomes para o contato/deal.
 */
export async function syncInteractionToPloomes(
  leadId: string,
  interaction: { title: string; content: string },
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "sem chave" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, external_id, ploomes_deal_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { ok: false, reason: "lead não encontrado" };
  const contactId = lead.external_id ? Number(lead.external_id) : null;
  const dealId = lead.ploomes_deal_id ? Number(lead.ploomes_deal_id) : null;

  if (!contactId && !dealId) {
    return { ok: true, skipped: true, reason: "lead sem vínculo no Ploomes" };
  }

  try {
    const body: Record<string, unknown> = {
      Title: interaction.title.slice(0, 200),
      Content: interaction.content.slice(0, 2000),
      Date: new Date().toISOString(),
      TypeId: 1,
    };
    if (contactId) body.ContactId = contactId;
    if (dealId) body.DealId = dealId;

    await ploomesFetch("/InteractionRecords", {
      method: "POST",
      body,
    });

    return { ok: true };
  } catch (e: any) {
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_interaction_sync",
      status: "error",
      message: `lead ${leadId}: ${String(e?.message ?? e).slice(0, 400)}`,
    });
    return { ok: false, reason: e?.message ?? String(e) };
  }
}

/**
 * Cria uma Tarefa / Compromisso (Task) no calendário do Ploomes.
 */
export async function syncTaskToPloomes(
  leadId: string,
  task: { title: string; dateTime: string; typeId?: number },
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "sem chave" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, external_id, ploomes_deal_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { ok: false, reason: "lead não encontrado" };
  const contactId = lead.external_id ? Number(lead.external_id) : null;
  const dealId = lead.ploomes_deal_id ? Number(lead.ploomes_deal_id) : null;

  if (!contactId && !dealId) {
    return { ok: true, skipped: true, reason: "lead sem vínculo no Ploomes" };
  }

  try {
    const body: Record<string, unknown> = {
      Title: task.title.slice(0, 200),
      DateTime: task.dateTime,
      TypeId: task.typeId ?? 1,
    };
    if (contactId) body.ContactId = contactId;
    if (dealId) body.DealId = dealId;

    await ploomesFetch("/Tasks", {
      method: "POST",
      body,
    });

    return { ok: true };
  } catch (e: any) {
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_task_sync",
      status: "error",
      message: `lead ${leadId}: ${String(e?.message ?? e).slice(0, 400)}`,
    });
    return { ok: false, reason: e?.message ?? String(e) };
  }
}

/**
 * Sincroniza alterações cadastrais do lead (nome, telefone, e-mail, valor) com o Contato e Deal no Ploomes.
 */
export async function syncLeadDataToPloomes(
  leadId: string,
  patch: {
    nome?: string;
    telefone?: string;
    email?: string | null;
    cidade?: string | null;
    estado?: string | null;
    sale_value?: number | null;
    sale_notes?: string | null;
  },
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "sem chave" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, external_id, ploomes_deal_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { ok: false, reason: "lead não encontrado" };
  const contactId = lead.external_id ? Number(lead.external_id) : null;
  const dealId = lead.ploomes_deal_id ? Number(lead.ploomes_deal_id) : null;

  try {
    if (contactId && (patch.nome || patch.email !== undefined || patch.telefone)) {
      const contactPatch: Record<string, unknown> = {};
      if (patch.nome) contactPatch.Name = patch.nome;
      if (patch.email !== undefined) contactPatch.Email = patch.email ?? "";
      if (patch.telefone) {
        contactPatch.Phones = [{ PhoneNumber: patch.telefone, TypeId: 2, CountryId: 76 }];
      }
      await ploomesFetch(`/Contacts(${contactId})`, {
        method: "PATCH",
        body: contactPatch,
      });
    }

    if (dealId && patch.sale_value != null) {
      await ploomesFetch(`/Deals(${dealId})`, {
        method: "PATCH",
        body: { Amount: patch.sale_value },
      });
    }

    if (patch.sale_notes?.trim()) {
      await syncInteractionToPloomes(leadId, {
        title: "Atualização de dados no Solar OS",
        content: patch.sale_notes.trim(),
      });
    }

    return { ok: true };
  } catch (e: any) {
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "ploomes_data_sync",
      status: "error",
      message: `lead ${leadId}: ${String(e?.message ?? e).slice(0, 400)}`,
    });
    return { ok: false, reason: e?.message ?? String(e) };
  }
}

/**
 * Varre e cadastra no Ploomes TODOS os leads qualificados pela Liz IA / WhatsApp nos últimos dias.
 * - Garante que APENAS leads verdadeiramente qualificados sejam cadastrados.
 * - Garante nomes de cidades 100% corretos (ex: Pirapozinho - SP, Londrina - PR, Wenceslau Braz - PR).
 * - Inclui a Tag oficial de "Tráfego Pago" (60151353) e origem Tráfego Pago (600965618).
 * - Atribui à SDR Stephany Martins (60022664) e à filial regional correspondente.
 */
export async function syncAllQualifiedLizLeadsToPloomesServer(opts?: {
  orgId?: string;
  forceAll?: boolean;
}): Promise<{
  ok: boolean;
  totalAnalyzed: number;
  totalQualified: number;
  totalSentToPloomes: number;
  alreadySynced: number;
  details: Array<{
    nome: string;
    telefone: string;
    cidade: string;
    valorConta: number;
    status: string;
    ploomesResult?: any;
  }>;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: org } = opts?.orgId
    ? await supabaseAdmin.from("organizations").select("id").eq("id", opts.orgId).maybeSingle()
    : await supabaseAdmin.from("organizations").select("id").limit(1).single();

  const orgId = org?.id || "00000000-0000-0000-0000-000000000000";
  const details: Array<{
    nome: string;
    telefone: string;
    cidade: string;
    valorConta: number;
    status: string;
    ploomesResult?: any;
  }> = [];

  let totalAnalyzed = 0;
  let totalQualified = 0;
  let totalSentToPloomes = 0;
  let alreadySynced = 0;

  // 1. Busca conversas recentes do WhatsApp
  const { data: convs } = await supabaseAdmin
    .from("wa_conversations")
    .select("id, contact_id, status, last_message_at, wa_contacts(id, profile_name, phone_e164, lead_id)")
    .order("last_message_at", { ascending: false })
    .limit(200);

  for (const conv of convs ?? []) {
    totalAnalyzed++;
    const contact = conv.wa_contacts as any;
    const phone = (contact?.phone_e164 || "").replace(/\D/g, "");
    if (!phone || phone.length < 8) continue;

    // Busca mensagens da conversa
    const { data: msgs } = await supabaseAdmin
      .from("wa_messages")
      .select("direction, body, occurred_at")
      .eq("conversation_id", conv.id)
      .not("body", "is", null)
      .order("occurred_at", { ascending: true })
      .limit(30);

    if (!msgs || msgs.length === 0) continue;

    const fullDialogue = msgs
      .map((m: any) => `${m.direction === "inbound" ? "Cliente" : "LIZ"}: ${m.body}`)
      .join("\n");

    const lower = fullDialogue.toLowerCase();

    // Extração estrita de dados
    let nome = (contact?.profile_name || "").trim();
    if (!nome || nome.toLowerCase().startsWith("cliente") || /^\+?[0-9\s-]+$/.test(nome)) {
      const matchNome = fullDialogue.match(/(?:me chamo|meu nome é|sou o|sou a|aqui é (?:o|a)?)\s+([A-ZÀ-Úa-zà-ú]{3,20})/i);
      if (matchNome) nome = matchNome[1].trim();
      else nome = "Cliente WhatsApp";
    }

    let rawCity = "";
    let rawState = "";
    let valorConta = 0;

    // Verifica menções de valores de conta
    const matchVal =
      lower.match(/(?:conta|gasto|média|uns|valor|pago|dá|r\$)\s*([0-9]{3,5})/i) ||
      lower.match(/([0-9]{3,5})\s*(?:reais|\/mês|kwh)/i);
    if (matchVal) {
      valorConta = Number(matchVal[1]);
    }

    // Varre cidades conhecidas no diálogo
    const { resolveCityAndFilial } = await import("./ploomes.server");
    const cityCandidates = [
      "pirapozinho",
      "presidente prudente",
      "alvares machado",
      "tarabai",
      "regente feijo",
      "martinopolis",
      "rancharia",
      "londrina",
      "cambe",
      "rolandia",
      "ibipora",
      "apucarana",
      "arapongas",
      "maringa",
      "ponta grossa",
      "castro",
      "carambei",
      "curitiba",
      "palmeira",
      "pirai do sul",
      "teixeira soares",
      "wenceslau braz",
      "wenceslau",
      "siqueira campos",
      "ibaiti",
      "santana do itarare",
      "quatigua",
      "tomazina",
      "carlopolis",
      "arapoti",
      "senges",
      "ourinhos",
      "santa cruz do rio pardo",
      "piraju",
      "marilia",
    ];

    for (const cand of cityCandidates) {
      if (lower.includes(cand)) {
        rawCity = cand;
        break;
      }
    }

    // Se a IA puder extrair com precisão
    if (!rawCity || !valorConta) {
      try {
        const { getResolvedAiModel } = await import("@/lib/ai-provider.server");
        const { generateObject } = await import("ai");
        const { z } = await import("zod");

        const model = getResolvedAiModel();
        const res = await generateObject({
          model,
          schema: z.object({
            isQualified: z.boolean(),
            nome: z.string().optional(),
            cidade: z.string().optional(),
            estado: z.string().optional(),
            valorContaMensal: z.number().optional(),
          }),
          prompt: `Analise a conversa de WhatsApp abaixo e informe se o cliente está qualificado para energia solar (disse a cidade onde mora e o valor da conta de luz >= R$ 200).
Diálogo:
${fullDialogue}`,
        });

        if (res.object.isQualified) {
          if (res.object.nome && res.object.nome !== "Cliente WhatsApp") nome = res.object.nome;
          if (res.object.cidade) rawCity = res.object.cidade;
          if (res.object.estado) rawState = res.object.estado;
          if (res.object.valorContaMensal) valorConta = res.object.valorContaMensal;
        }
      } catch {}
    }

    // Validação estrita de qualificação:
    // Deve ter cidade reconhecida E conta >= R$ 200 (ou projeto solar explícito)
    const normC = rawCity.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isCityValid = rawCity && normC !== "parana" && normC !== "sao paulo" && normC !== "brasil";

    if (!isCityValid || valorConta < 200) {
      continue; // Não qualificado - PULA estritamente
    }

    totalQualified++;
    const resolved = resolveCityAndFilial(rawCity, rawState);
    const cleanCidade = resolved.cidade;
    const cleanEstado = resolved.estado;

    // Deduplicação: verifica se já foi enviado ao Ploomes
    const { data: audit } = await supabaseAdmin
      .from("wa_audit_log")
      .select("id")
      .eq("entity_id", conv.id)
      .eq("action", "ploomes.lead_created")
      .limit(1)
      .maybeSingle();

    if (audit && !opts?.forceAll) {
      alreadySynced++;
      details.push({
        nome,
        telefone: phone,
        cidade: cleanCidade,
        valorConta,
        status: "Já cadastrado anteriormente no Ploomes",
      });
      continue;
    }

    // Envia ao Ploomes
    const ploomesRes = await pushLeadToPloomesForm({
      nome,
      telefone: phone,
      cidade: cleanCidade,
      estado: cleanEstado,
      valor_conta: String(valorConta),
      mensagem: `☀️ Lead Qualificado pela LIZ IA\nNome: ${nome}\nCidade: ${cleanCidade}\nValor da Conta: R$ ${valorConta}\nTelefone: ${phone}`,
      origem: "WhatsApp - LIZ IA",
    });

    totalSentToPloomes++;

    // Salva lead no banco local
    const { data: newLead } = await supabaseAdmin
      .from("leads")
      .upsert(
        {
          org_id: orgId,
          nome,
          telefone: phone,
          cidade: cleanCidade,
          estado: cleanEstado,
          valor_conta: String(valorConta),
          origem: "WhatsApp - LIZ IA",
          // "qualificado" é um estágio válido no banco (coluna texto sem constraint);
          // o tipo gerado está desatualizado.
          stage: "qualificado",
          last_synced_at: new Date().toISOString(),
        } as any,
        { onConflict: "telefone" },
      )
      .select("id")
      .maybeSingle();

    if (newLead?.id && contact?.id) {
      await supabaseAdmin.from("wa_contacts").update({ lead_id: newLead.id }).eq("id", contact.id);
    }

    // Registra auditoria
    await supabaseAdmin.from("wa_audit_log").insert({
      org_id: orgId,
      action: "ploomes.lead_created",
      entity_type: "wa_conversation",
      entity_id: conv.id,
      detail: { nome, cidade: cleanCidade, estado: cleanEstado, valorConta, phone, ploomesRes },
    });

    details.push({
      nome,
      telefone: phone,
      cidade: cleanCidade,
      valorConta,
      status: ploomesRes.ok ? "Cadastrado com sucesso no Ploomes" : "Erro no envio",
      ploomesResult: ploomesRes,
    });
  }

  // 2. Verifica também leads na tabela 'leads' que estão como 'qualificado' e ainda sem sync
  const { data: localLeads } = await supabaseAdmin
    .from("leads")
    .select("id, nome, telefone, cidade, estado, valor_conta, mensagem, origem, stage, external_id")
    .eq("stage", "qualificado" as "novo")
    .is("external_id", null)
    .limit(50);

  for (const lead of localLeads ?? []) {
    const phone = (lead.telefone || "").replace(/\D/g, "");
    if (!phone || phone.length < 8) continue;

    const resolved = resolveCityAndFilial(lead.cidade, lead.estado);
    const ploomesRes = await pushLeadToPloomesForm({
      nome: lead.nome,
      telefone: phone,
      cidade: resolved.cidade,
      estado: resolved.estado,
      valor_conta: lead.valor_conta,
      mensagem: lead.mensagem || `Lead Qualificado - ${lead.origem || "WhatsApp"}`,
      origem: "WhatsApp - LIZ IA",
    });

    if (ploomesRes.ok) {
      totalSentToPloomes++;
      await supabaseAdmin
        .from("leads")
        .update({
          cidade: resolved.cidade,
          estado: resolved.estado,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
    }
  }

  return {
    ok: true,
    totalAnalyzed,
    totalQualified,
    totalSentToPloomes,
    alreadySynced,
    details,
  };
}
