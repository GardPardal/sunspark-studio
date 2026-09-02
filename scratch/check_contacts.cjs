const { createClient } = require("@supabase/supabase-js");

const url = "https://dwwospznutfbxcbbcqfa.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3d29zcHpudXRmYnhjYmJjcWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTA4MDgsImV4cCI6MjA5ODkyNjgwOH0.S-pUCNquKJAy83OnuOLokcvB2MlZYT6CibN1ufPbY_M";

async function checkContacts() {
  const supabase = createClient(url, key);
  const { data: contacts, error } = await supabase.from("wa_contacts").select("id, name, phone_e164").limit(10);
  console.log("Contacts in DB:", contacts);
  
  const { data: convs, error: convErr } = await supabase.from("wa_conversations").select("id, contact_id, status, summary, last_message_at").limit(10);
  console.log("Conversations in DB:", convs);
}

checkContacts();