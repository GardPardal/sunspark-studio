const { createClient } = require("@supabase/supabase-js");

const url = "https://dwwospznutfbxcbbcqfa.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3d29zcHpudXRmYnhjYmJjcWZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM1MDgwOCwiZXhwIjoyMDk4OTI2ODA4fQ.a6Xb84Fkox-1fQ609d-N99y2g1wO4n7FkK932f_3P2M"; // check service key or read anon

async function check() {
  const sb = createClient(url, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3d29zcHpudXRmYnhjYmJjcWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTA4MDgsImV4cCI6MjA5ODkyNjgwOH0.S-pUCNquKJAy83OnuOLokcvB2MlZYT6CibN1ufPbY_M");
  
  console.log("=== WA CONVERSATIONS ===");
  const { data: convs, error: convErr } = await sb.from("wa_conversations").select("*, wa_contacts(*)").limit(20);
  console.log("Convs error:", convErr);
  console.log("Convs count:", convs?.length);
  if (convs) {
    for (const c of convs) {
      console.log(`Conv ID: ${c.id}, Status: ${c.status}, Summary: ${c.summary}, Contact: ${JSON.stringify(c.wa_contacts)}`);
      
      const { data: msgs, error: msgErr } = await sb.from("wa_messages").select("*").eq("conversation_id", c.id);
      console.log(`  -> Messages count for conv ${c.id}: ${msgs?.length}, err:`, msgErr);
      if (msgs && msgs.length > 0) {
        console.log(`  -> Sample msg: ${msgs[0].direction} | ${msgs[0].body}`);
      }
    }
  }

  console.log("\n=== TOTAL WA MESSAGES IN DB ===");
  const { data: allMsgs, error: allErr } = await sb.from("wa_messages").select("id, conversation_id, direction, body, occurred_at").limit(50);
  console.log("All msgs count:", allMsgs?.length, "error:", allErr);
  if (allMsgs && allMsgs.length > 0) {
    console.log("First 3 msgs:", allMsgs.slice(0, 3));
  }
}

check().catch(console.error);