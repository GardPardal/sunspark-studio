const fs = require("fs");
const lines = fs.readFileSync(".env", "utf8").split("\n");
const env = {};
for (const line of lines) {
  const parts = line.trim().split("=");
  if (parts.length >= 2 && !parts[0].startsWith("#")) {
    env[parts[0].trim()] = parts.slice(1).join("=").trim().replace(/^"|"$/g, "");
  }
}

const { createClient } = require("@supabase/supabase-js");

async function auditAdmin() {
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  console.log("=== SUPABASE ADMIN AUDIT ===");
  const { data: convs, error: cErr } = await sb.from("wa_conversations").select("id, status, last_message_at, summary, unread_count, contact_id").limit(10);
  console.log("wa_conversations count:", convs?.length, "error:", cErr);

  const { data: msgs, error: mErr } = await sb.from("wa_messages").select("id, conversation_id, direction, msg_type, body, status, occurred_at").limit(10);
  console.log("wa_messages count:", msgs?.length, "error:", mErr);

  const { data: contacts, error: ctErr } = await sb.from("wa_contacts").select("id, phone_e164, profile_name, lead_id").limit(10);
  console.log("wa_contacts count:", contacts?.length, "error:", ctErr);
  if (contacts && contacts.length > 0) {
    console.log("Sample contact:", contacts[0]);
  }
}
auditAdmin().catch(console.error);