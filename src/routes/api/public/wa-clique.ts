import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Página-ponte do anúncio de WhatsApp (/whatsapp): guarda o clique do anúncio com um código curto que vai
 * na 1ª mensagem do cliente ("... (cód. 7K2QX)"). Quando a SDR cadastra o lead pela extensão, o código liga
 * o cadastro a este clique e o "Lead" vai para a Meta com fbc/fbp/IP/navegador DO CLIENTE (não da SDR).
 * Conversa que não vira cadastro nunca vira Lead na Meta.
 *
 * Grava em lead_events: event "wa.clique", step = código, detail = dados do clique.
 */
const txt = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().slice(0, max) || undefined : v),
    z.string().optional().nullable(),
  );

const schema = z.object({
  codigo: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{5}$/),
  fbclid: txt(500),
  fbc: txt(600),
  fbp: txt(255),
  visitor_id: txt(120),
  page_url: txt(800),
  referrer: txt(500),
  utm_source: txt(120),
  utm_medium: txt(120),
  utm_campaign: txt(200),
  utm_content: txt(200),
  utm_term: txt(200),
  ad_id: txt(40),
  adset_id: txt(40),
  campaign_id: txt(40),
});

export const Route = createFileRoute("/api/public/wa-clique")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const p = schema.safeParse(body);
        if (!p.success) return Response.json({ ok: false }, { status: 400 });
        const client_ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          null;
        const user_agent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await (supabaseAdmin as any).from("lead_events").insert({
          event: "wa.clique",
          step: p.data.codigo,
          source: "pagina_ponte_whatsapp",
          result: "ok",
          detail: { ...p.data, client_ip, user_agent, em: new Date().toISOString() },
        });
        if (error) return Response.json({ ok: false }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
