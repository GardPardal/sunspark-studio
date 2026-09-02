const { createClient } = require("@supabase/supabase-js");

async function inspectDb() {
  const sb = createClient(
    "https://dwwospznutfbxcbbcqfa.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3d29zcHpudXRmYnhjYmJjcWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTA4MDgsImV4cCI6MjA5ODkyNjgwOH0.S-pUCNquKJAy83OnuOLokcvB2MlZYT6CibN1ufPbY_M"
  );

  console.log("=== DB AUDIT ===");
  const { data: convs, error: cErr } = await sb.from("wa_conversations").select("id, status, last_message_at, summary, unread_count, contact_id").limit(10);
  console.log("wa_conversations count:", convs?.length, "error:", cErr);

  const { data: msgs, error: mErr } = await sb.from("wa_messages").select("id, conversation_id, direction, msg_type, body, status, occurred_at").limit(10);
  console.log("wa_messages count:", msgs?.length, "error:", mErr);

  const { data: contacts, error: ctErr } = await sb.from("wa_contacts").select("id, phone_e164, profile_name, lead_id").limit(10);
  console.log("wa_contacts count:", contacts?.length, "error:", ctErr);
}
inspectDb().catch(console.error);