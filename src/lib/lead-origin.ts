/**
 * Classificação de origem do lead usada pelo Kanban do CRM.
 * Fica fora da rota para ser reutilizada no servidor (filtro de origem paginado).
 */
export type LeadOriginSource = {
  origem?: string | null;
  mensagem?: string | null;
  captacao_metodo?: string | null;
  utm_source?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  quiz_data?: unknown;
};

export type LeadOriginInfo = {
  label: string;
  key: string;
  className: string;
};

export function getLeadOriginInfo(lead: LeadOriginSource): LeadOriginInfo {
  const orig = (lead.origem || "").toLowerCase();
  const msg = (lead.mensagem || "").toLowerCase();
  const capt = (lead.captacao_metodo || "").toLowerCase();
  const utm = (lead.utm_source || "").toLowerCase();

  // 1. Quiz Site (Tráfego Interno LZ7 / Solar OS)
  if (
    orig.includes("quiz") ||
    orig.includes("trafego interno") ||
    orig.includes("tráfego interno") ||
    orig.includes("interno") ||
    msg.includes("quiz") ||
    msg.includes("qualificação via quiz") ||
    msg.includes("qualificacao via quiz") ||
    capt.includes("quiz") ||
    capt.includes("site") ||
    capt.includes("landing") ||
    utm.includes("quiz") ||
    lead.quiz_data
  ) {
    return {
      label: "Quiz Site (Tráfego Interno)",
      key: "quiz",
      className:
        "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-semibold",
    };
  }

  // 2. Tráfego Conecta (Tráfego Pago / SDR Stephany)
  if (
    orig.includes("conecta") ||
    orig.includes("trafego pago") ||
    orig.includes("tráfego pago") ||
    orig.includes("pago") ||
    orig.includes("sdr") ||
    orig.includes("meta whatsapp") ||
    msg.includes("conecta") ||
    msg.includes("sdr") ||
    capt.includes("conecta") ||
    capt.includes("sdr") ||
    capt.includes("trafego_pago")
  ) {
    return {
      label: "Tráfego Pago (Conecta)",
      key: "conecta",
      className:
        "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-semibold",
    };
  }

  // 3. Prospecção Ativa (PAP / Consultores)
  if (
    orig.includes("pap") ||
    orig.includes("prospec") ||
    capt.includes("pap") ||
    capt.includes("prospec")
  ) {
    return {
      label: "PAP / Prospecção",
      key: "pap",
      className:
        "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-semibold",
    };
  }

  // 4. Indicações
  if (orig.includes("indica") || capt.includes("indica")) {
    return {
      label: "Indicação",
      key: "indicacao",
      className:
        "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-semibold",
    };
  }

  // 5. WhatsApp IA (LIZ)
  if (orig.includes("whatsapp ia") || capt.includes("liz_whatsapp") || orig.includes("liz")) {
    return {
      label: "WhatsApp IA",
      key: "whatsapp_ia",
      className:
        "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-500/30 font-semibold",
    };
  }

  // 6. Meta Ads
  if (
    lead.fbclid ||
    utm.includes("facebook") ||
    utm.includes("meta") ||
    orig.includes("meta ads")
  ) {
    return {
      label: "Meta Ads",
      key: "meta",
      className:
        "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-semibold",
    };
  }

  // 7. Google Ads
  if (lead.gclid || utm.includes("google") || orig.includes("google")) {
    return {
      label: "Google Ads",
      key: "google",
      className:
        "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-semibold",
    };
  }

  // 8. Ploomes CRM
  if (orig.includes("ploomes")) {
    return {
      label: "Ploomes CRM",
      key: "ploomes",
      className:
        "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30 font-semibold",
    };
  }

  return {
    label: lead.origem || "Orgânico",
    key: "outro",
    className: "bg-secondary text-secondary-foreground font-medium",
  };
}
