import { createEmailWebhookHandler } from "@lovable.dev/email-js";
import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

type Outcome = "bounce" | "complaint" | "unsubscribe";

const LOG_STATUS: Record<Outcome, string> = {
  bounce: "bounced",
  complaint: "complained",
  unsubscribe: "suppressed",
};

const LOG_MESSAGE: Record<Outcome, string> = {
  bounce: "Permanent bounce — email address is invalid or rejected",
  complaint: "Spam complaint — recipient marked email as spam",
  unsubscribe: "Recipient unsubscribed",
};

async function recordOutcome(
  reason: Outcome,
  event: { event_id: string; data: { recipient: string; message_id?: string | null } },
) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Server configuration error");
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const email = event.data.recipient.toLowerCase();

  const { error: suppressError } = await supabase
    .from("suppressed_emails")
    .upsert({ email, reason, metadata: null }, { onConflict: "email" });
  if (suppressError) {
    console.error("Failed to record email outcome", {
      event_id: event.event_id,
      code: suppressError.code,
      message: suppressError.message,
    });
    throw new Error("Failed to record email outcome");
  }

  const { error: logError } = await supabase.from("email_send_log").insert({
    message_id: event.data.message_id ?? null,
    template_name: "system",
    recipient_email: email,
    status: LOG_STATUS[reason],
    error_message: LOG_MESSAGE[reason],
    metadata: null,
  });
  if (logError) {
    console.error("Failed to log email outcome", {
      event_id: event.event_id,
      code: logError.code,
      message: logError.message,
    });
    throw new Error("Failed to log email outcome");
  }
}

export const Route = createFileRoute("/lovable/email/events")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          console.error("Missing required environment variables");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            "email.bounced": async (event) => {
              await recordOutcome("bounce", event as any);
            },
            "email.complaint": async (event) => {
              await recordOutcome("complaint", event as any);
            },
            "email.unsubscribed": async (event) => {
              await recordOutcome("unsubscribe", event as any);
            },
          },
        });
        return handler(request);
      },
    },
  },
});
