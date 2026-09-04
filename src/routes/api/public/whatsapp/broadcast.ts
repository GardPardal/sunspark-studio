import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendZApiText } from "@/lib/zapi.server";

/**
 * Normaliza qualquer telefone brasileiro para o padrão WhatsApp:
 * 55 + DDD (2 dígitos) + 9 (dígito 9 obrigatório) + 8 dígitos = 13 dígitos
 */
function normalizeBrPhone(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";

  // Se já tem DDI 55
  if (digits.startsWith("55")) {
    // 55 + DDD (2) + 8 dígitos (12 dígitos totais) -> Adiciona o 9 após o DDD
    if (digits.length === 12) {
      const ddd = digits.slice(2, 4);
      const num = digits.slice(4);
      return `55${ddd}9${num}`;
    }
    // 55 + DDD (2) + 9 dígitos (13 dígitos totais)
    if (digits.length === 13) {
      return digits;
    }
  } else {
    // DDD (2) + 8 dígitos (10 dígitos totais) -> Adiciona 55 + DDD + 9 + 8 dígitos
    if (digits.length === 10) {
      const ddd = digits.slice(0, 2);
      const num = digits.slice(2);
      return `55${ddd}9${num}`;
    }
    // DDD (2) + 9 dígitos (11 dígitos totais) -> Adiciona 55
    if (digits.length === 11) {
      return `55${digits}`;
    }
  }

  return digits;
}

export const Route = createFileRoute("/api/public/whatsapp/broadcast")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({ status: "ready" }), {
          headers: { "content-type": "application/json" },
        });
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as any;
          const rawPhones: string[] = Array.isArray(body.phones) ? body.phones : [];
          const message: string = typeof body.message === "string" ? body.message.trim() : "";
          const delayMs: number = Math.max(1500, Number(body.delayMs) || 4000);

          if (!rawPhones.length || !message) {
            return new Response(
              JSON.stringify({ error: "Lista de telefones e mensagem são obrigatórios" }),
              { status: 400, headers: { "content-type": "application/json" } }
            );
          }

          const { data: org } = await supabaseAdmin.from("organizations").select("id").limit(1).single();
          const orgId = org?.id || "00000000-0000-0000-0000-000000000000";

          const results: Array<{
            phone: string;
            formattedPhone: string;
            status: "sent" | "failed";
            messageId?: string | null;
            error?: string;
          }> = [];

          for (let i = 0; i < rawPhones.length; i++) {
            const rawPhone = rawPhones[i];
            const cleanDigits = normalizeBrPhone(rawPhone);
            const phoneE164 = `+${cleanDigits}`;

            if (cleanDigits.length < 12) {
              results.push({
                phone: rawPhone,
                formattedPhone: cleanDigits,
                status: "failed",
                error: "Número de telefone inválido (menos de 12 dígitos)",
              });
              continue;
            }

            try {
              // 1. Upsert Contato no WhatsApp Hub
              let contactId: string | null = null;
              const { data: exContact } = await supabaseAdmin
                .from("wa_contacts")
                .select("id")
                .eq("phone_e164", phoneE164)
                .maybeSingle();

              if (exContact) {
                contactId = exContact.id;
              } else {
                const { data: newContact } = await supabaseAdmin
                  .from("wa_contacts")
                  .insert({
                    org_id: orgId,
                    phone_e164: phoneE164,
                    profile_name: `Time LZ7 (${cleanDigits.slice(-4)})`,
                    last_inbound_at: new Date().toISOString(),
                  })
                  .select("id")
                  .single();
                contactId = newContact?.id ?? null;
              }

              // 2. Upsert Conversa
              let convId: string | null = null;
              if (contactId) {
                const { data: exConv } = await supabaseAdmin
                  .from("wa_conversations")
                  .select("id")
                  .eq("contact_id", contactId)
                  .maybeSingle();

                if (exConv) {
                  convId = exConv.id;
                } else {
                  const { data: newConv } = await supabaseAdmin
                    .from("wa_conversations")
                    .insert({
                      org_id: orgId,
                      contact_id: contactId,
                      status: "humano",
                      last_message_at: new Date().toISOString(),
                      summary: "Apresentação da LIZ para o time LZ7",
                    })
                    .select("id")
                    .single();
                  convId = newConv?.id ?? null;
                }
              }

              // 3. Envia mensagem via Z-API com número formatado de 13 dígitos
              const zRes = await sendZApiText(cleanDigits, message);
              const messageId = zRes?.messageId || zRes?.id || zRes?.zaapId || null;

              // 4. Grava mensagem enviada no histórico
              if (convId && contactId) {
                await supabaseAdmin.from("wa_messages").insert({
                  org_id: orgId,
                  contact_id: contactId,
                  conversation_id: convId,
                  direction: "outbound",
                  msg_type: "text",
                  body: message,
                  status: "sent",
                  source: "zapi",
                  provider_message_id: messageId,
                  ai_generated: true,
                  occurred_at: new Date().toISOString(),
                } as any);
              }

              results.push({
                phone: rawPhone,
                formattedPhone: cleanDigits,
                status: "sent",
                messageId,
              });

              // Delay seguro entre envios (exceto no último)
              if (i < rawPhones.length - 1 && delayMs > 0) {
                await new Promise((r) => setTimeout(r, delayMs));
              }
            } catch (err: any) {
              console.error(`[Broadcast Fail] ${cleanDigits}:`, err);
              results.push({
                phone: rawPhone,
                formattedPhone: cleanDigits,
                status: "failed",
                error: err?.message || "Erro desconhecido ao comunicar com Z-API",
              });
            }
          }

          // Auditoria no banco
          if (org) {
            await supabaseAdmin.from("wa_audit_log").insert({
              org_id: org.id,
              action: "wa.mass_broadcast",
              entity_type: "wa_messages",
              detail: {
                totalTargeted: rawPhones.length,
                totalSent: results.filter((r) => r.status === "sent").length,
                totalFailed: results.filter((r) => r.status === "failed").length,
                timestamp: new Date().toISOString(),
              } as never,
            });
          }

          return new Response(
            JSON.stringify({
              ok: true,
              total: rawPhones.length,
              sent: results.filter((r) => r.status === "sent").length,
              failed: results.filter((r) => r.status === "failed").length,
              results,
            }),
            { headers: { "content-type": "application/json" } }
          );
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
