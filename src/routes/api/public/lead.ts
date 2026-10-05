import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Endpoint público de captação de leads para o site WordPress/Elementor.
 *
 * Uso no Elementor (Form > Actions After Submit > Webhook):
 *   URL: https://app.lz7energia.com.br/api/public/lead
 *
 * Também aceita JSON:
 *   POST { nome, telefone, email?, cidade?, estado?, valor_conta?, mensagem?, origem?, utm_* }
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

/**
 * Campo opcional que é cortado no limite em vez de recusar o lead.
 * (Antes, um link de anúncio da Meta com fbclid/UTMs passava de 500 caracteres,
 * o endpoint devolvia 400 e o lead ia para o WhatsApp sem ficar registrado.)
 */
const txt = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().slice(0, max) || undefined : v),
    z.string().optional().nullable(),
  );

const schema = z.object({
  nome: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().slice(0, 120) : v),
    z.string().min(2),
  ),
  telefone: z.string().trim().min(8).max(40),
  // e-mail inválido não derruba o lead: só é descartado
  email: z.preprocess((v) => {
    if (typeof v !== "string") return v;
    const e = v.trim().slice(0, 160);
    return z.string().email().safeParse(e).success ? e : undefined;
  }, z.string().optional().nullable()),
  cidade: txt(120),
  estado: txt(60),
  valor_conta: txt(60),
  mensagem: txt(2000),
  origem: txt(80),
  utm_source: txt(120),
  utm_medium: txt(120),
  utm_campaign: txt(160),
  utm_term: txt(160),
  utm_content: txt(160),
  gclid: txt(255),
  fbclid: txt(500),
  fbp: txt(255),
  fbc: txt(600),
  page_url: txt(500),
  referrer: txt(500),
  /** event_id gerado no navegador junto com o fbq('track','Lead') — garante dedup Pixel ↔ CAPI. */
  event_id: txt(120),
  /** ID anônimo do visitante (o mesmo external_id do Pixel). NÃO é o external_id do lead (Ploomes). */
  external_id: txt(120),
});

/** Registra a tentativa que não virou lead, com os dados, para dar para recuperar. */
async function logLeadFailure(reason: string, raw: Record<string, unknown>) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pick = (k: string) => String(raw[k] ?? "").slice(0, 200);
    await supabaseAdmin.from("integration_sync_log").insert({
      provider: "site_lead_falha",
      status: "error",
      items_imported: 0,
      message: `${reason} | nome=${pick("nome")} | telefone=${pick("telefone")} | cidade=${pick("cidade")}/${pick("estado")} | origem=${pick("origem")} | ${String(raw["mensagem"] ?? "").slice(0, 800)}`,
    });
  } catch (e) {
    console.error("[api/public/lead] log falha:", e);
  }
}

/** Elementor manda campos como form_fields[nome]; normalizamos os aliases mais comuns. */
function normalize(raw: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k
      .replace(/^form_fields\[(.+)\]$/, "$1")
      .trim()
      .toLowerCase();
    if (v === "" || v == null) continue;
    out[key] = typeof v === "string" ? v : String(v);
  }
  const pick = (...keys: string[]) => {
    for (const k of keys) if (out[k]) return out[k] as string;
    return undefined;
  };
  return {
    nome: pick("nome", "name", "your-name", "field_nome"),
    telefone: pick("telefone", "phone", "whatsapp", "celular", "tel"),
    email: pick("email", "e-mail", "your-email"),
    cidade: pick("cidade", "city"),
    estado: pick("estado", "state", "uf"),
    valor_conta: pick("valor_conta", "conta", "valor", "media_conta"),
    mensagem: pick("mensagem", "message", "obs", "observacao"),
    origem: pick("origem", "source") ?? "wordpress",
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_term: pick("utm_term"),
    utm_content: pick("utm_content"),
    gclid: pick("gclid"),
    fbclid: pick("fbclid"),
    fbp: pick("fbp", "_fbp"),
    fbc: pick("fbc", "_fbc"),
    external_id: pick("external_id", "visitor_id", "lz7_eid"),
    page_url: pick("page_url", "referrer_url", "page_title_url"),
    referrer: pick("referrer", "referer"),
    event_id: pick("event_id", "eventid"),
  };
}

export const Route = createFileRoute("/api/public/lead")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") ?? "";
          let raw: Record<string, unknown> = {};
          if (contentType.includes("application/json")) {
            raw = (await request.json()) as Record<string, unknown>;
          } else {
            const fd = await request.formData();
            for (const [k, v] of fd.entries()) raw[k] = typeof v === "string" ? v : "";
          }

          const normalized = normalize(raw);
          const parsed = schema.safeParse(normalized);
          if (!parsed.success) {
            await logLeadFailure(
              `dados inválidos: ${parsed.error.issues.map((i) => i.path.join(".")).join(",")}`,
              normalized,
            );
            return Response.json(
              {
                ok: false,
                error: "Dados inválidos",
                issues: parsed.error.issues.map((i) => i.path.join(".")),
              },
              { status: 400, headers: CORS },
            );
          }

          // external_id do navegador fica fora do cadastro: no lead, external_id é o contato do Ploomes
          const { event_id, external_id: visitorId, ...leadData } = parsed.data;
          const uf = (leadData.estado ?? "").toUpperCase();
          if (uf && uf !== "PR" && uf !== "SP") {
            return Response.json(
              {
                ok: false,
                error: "Fora da área de atuação",
                detail: "Atendemos apenas Paraná e São Paulo.",
              },
              { status: 400, headers: CORS },
            );
          }
          // Cobertura: até 350 km de Londrina, Wenceslau Braz ou Ponta Grossa.
          // Aplica-se ao quiz e aos formulários do site que informam cidade + UF.
          if (leadData.cidade && uf) {
            const { cidadeNaCobertura } = await import("@/lib/geo/cobertura");
            if (!cidadeNaCobertura(leadData.cidade, uf)) {
              return Response.json(
                {
                  ok: false,
                  error: "Fora da área de atuação",
                  detail:
                    "Atendemos cidades a até 350 km das bases de Londrina, Wenceslau Braz e Ponta Grossa.",
                },
                { status: 400, headers: CORS },
              );
            }
          }
          const user_agent = request.headers.get("user-agent") ?? null;
          const client_ip =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            request.headers.get("x-real-ip") ||
            null;

          // ---- Central de Leads: normaliza, deduplica por telefone e enfileira para o Ploomes ----
          let inserted: { id: string } | null = null;
          try {
            const { ingestLead } = await import("@/lib/leads/lead-core.server");
            const origem = leadData.origem || "quiz-site";
            const r = await ingestLead(
              {
                ...leadData,
                origem,
                origem_principal: /quiz|site|wordpress|landing/i.test(origem) ? "Site" : origem,
                canal: "Formulário do site",
                sistema_entrada: "site",
                user_agent,
              },
              { syncPolicy: "immediate", source: "site" },
            );
            inserted = { id: r.leadId };
            // Identificadores para a Meta ligar as próximas etapas (qualificação, visita,
            // venda) a ESTE clique: o cadastro por telefone mantém o primeiro _fbc; aqui
            // fica o mais recente, que é o anúncio que trouxe a pessoa agora.
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const clique: Record<string, string> = {};
              if (leadData.fbc) clique.fbc = leadData.fbc;
              if (leadData.fbp) clique.fbp = leadData.fbp;
              if (leadData.fbclid) clique.fbclid = leadData.fbclid;
              if (Object.keys(clique).length)
                await (supabaseAdmin as any).from("leads").update(clique).eq("id", r.leadId);
              const rede: Record<string, string> = {};
              if (client_ip) rede.client_ip = client_ip;
              if (visitorId) rede.visitor_id = visitorId;
              if (Object.keys(rede).length)
                await (supabaseAdmin as any).from("leads").update(rede).eq("id", r.leadId);
            } catch (e) {
              console.warn("[api/public/lead] identificadores meta:", e);
            }
            // Marca a passagem pelo quiz (vale para lead que já existia: o cadastro por
            // telefone não sobrescreve origem/mensagem). O sync usa isso para aplicar a
            // regra do quiz no Ploomes: somente criação, Comercial/Qualificação, Stephany.
            if (/quiz/i.test(origem)) {
              const { logLeadEvent } = await import("@/lib/leads/lead-core.server");
              const { QUIZ_EVENT } = await import("@/lib/leads/ploomes-sync.server");
              await logLeadEvent({
                lead_id: r.leadId,
                phone: r.lead.telefone_e164 ?? null,
                event: QUIZ_EVENT,
                source: origem,
                step: "site",
                result: r.created ? "lead novo" : "lead já existia",
                detail: {
                  mensagem: leadData.mensagem ?? null,
                  cidade: leadData.cidade ?? null,
                  estado: leadData.estado ?? null,
                  valor_conta: leadData.valor_conta ?? null,
                },
              });
            }
            // Tenta sincronizar já; se falhar, o agendador reprocessa a fila.
            if (r.enqueued) {
              const { processLeadSyncQueue } = await import("@/lib/leads/ploomes-sync.server");
              processLeadSyncQueue(3, "inline-site").catch((e) =>
                console.error("[api/public/lead] sync inline:", e),
              );
            }
          } catch (error) {
            console.error("[api/public/lead] ingest failed:", error);
            await logLeadFailure(
              `falha ao gravar: ${(error as Error)?.message ?? error}`,
              normalized,
            );
            return Response.json(
              { ok: false, error: "Falha ao registrar lead" },
              { status: 500, headers: CORS },
            );
          }

          // ---- Meta CAPI (server-side) — devolve o lead como conversão para a Meta ----
          let meta: Record<string, unknown> = { ok: false, reason: "sem_lead_id" };
          if (inserted?.id) {
            try {
              const { dispatchEvent } = await import("@/lib/conversion-events.service");
              const r = await dispatchEvent({
                event: "Lead",
                eventId: event_id ?? null,
                timelineOnLeadId: inserted.id,
                lead: {
                  id: inserted.id,
                  nome: leadData.nome,
                  email: leadData.email ?? null,
                  telefone: leadData.telefone,
                  cidade: leadData.cidade ?? null,
                  estado: leadData.estado ?? null,
                  gclid: leadData.gclid ?? null,
                  fbp: leadData.fbp ?? null,
                  fbc: leadData.fbc ?? null,
                  visitor_id: visitorId ?? null,
                  user_agent,
                  client_ip,
                  page_url: leadData.page_url ?? null,
                  utm_source: leadData.utm_source ?? null,
                  utm_medium: leadData.utm_medium ?? null,
                  utm_campaign: leadData.utm_campaign ?? null,
                  utm_content: leadData.utm_content ?? null,
                  utm_term: leadData.utm_term ?? null,
                },
              });
              meta = {
                ok: r.ok,
                status: r.status_detail,
                event_id: r.event_id,
                fbtrace_id: r.fbtrace_id,
                match_quality: r.match_quality,
                test_mode: r.test_mode,
              };
            } catch (err) {
              console.error("[api/public/lead] meta capi failed:", err);
              meta = { ok: false, reason: "erro_capi" };
            }
          }

          return Response.json(
            { ok: true, lead_id: inserted?.id ?? null, meta },
            { status: 200, headers: CORS },
          );
        } catch (e) {
          console.error("[api/public/lead] error:", e);
          return Response.json(
            { ok: false, error: "Erro inesperado" },
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
