import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Ploomes-Signature",
};

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/ploomes/webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async () =>
        json(200, { ok: true, hint: "POST aqui com o payload do Ploomes" }),

      POST: async ({ request }) => {
        // Autenticação simples via secret compartilhado
        const secret = process.env.PLOOMES_WEBHOOK_SECRET;
        if (secret) {
          const url = new URL(request.url);
          const provided =
            request.headers.get("x-ploomes-signature") ??
            request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
            url.searchParams.get("secret");
          if (provided !== secret) {
            return json(401, { ok: false, error: "unauthorized" });
          }
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return json(400, { ok: false, error: "json inválido" });
        }

        // Payload pode vir como Contact único, array, ou wrapper { Contact: {...} }
        const contacts: any[] = Array.isArray(payload)
          ? payload
          : payload?.value ??
            payload?.Contacts ??
            (payload?.Contact ? [payload.Contact] : payload?.Id ? [payload] : []);

        if (!contacts.length) {
          return json(400, { ok: false, error: "nenhum contato no payload" });
        }

        const { upsertLeadFromPloomesContact } = await import(
          "@/lib/ploomes.server"
        );
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        let ok = 0;
        let fail = 0;
        const errors: string[] = [];

        for (const c of contacts) {
          // Se veio só o Id, buscar contato completo no Ploomes
          let contact = c;
          if (!contact?.Phones && contact?.Id) {
            try {
              const key =
                process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
              if (key) {
                const res = await fetch(
                  `https://public-api2.ploomes.com/Contacts(${contact.Id})?$expand=City,Phones`,
                  { headers: { "User-Key": key, Accept: "application/json" } },
                );
                if (res.ok) {
                  const j = await res.json();
                  contact = j?.value?.[0] ?? j;
                }
              }
            } catch {
              /* usa o que veio */
            }
          }
          const r = await upsertLeadFromPloomesContact(contact);
          if (r.ok) ok++;
          else {
            fail++;
            if (errors.length < 3 && r.reason) errors.push(r.reason);
          }
        }

        await supabaseAdmin.from("integration_sync_log").insert({
          provider: "ploomes_webhook",
          status: fail ? "partial" : "success",
          items_imported: ok,
          message: fail ? `${fail} falhas: ${errors.join(" | ")}` : null,
        });

        return json(200, { ok: true, processed: ok, failed: fail });
      },
    },
  },
});
