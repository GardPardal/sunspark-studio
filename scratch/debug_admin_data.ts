import { supabaseAdmin } from "../src/integrations/supabase/client.server";

async function run() {
  const { data: convs, error } = await supabaseAdmin
    .from("wa_conversations")
    .select("*, wa_contacts(*)");
  console.log("Admin convs count:", convs?.length, "error:", error);
  if (convs) {
    for (const c of convs) {
      const { data: msgs } = await supabaseAdmin
        .from("wa_messages")
        .select("*")
        .eq("conversation_id", c.id);
      console.log(`Conv: ${c.id} | Contact: ${c.wa_contacts?.profile_name} (${c.wa_contacts?.phone_e164}) | Summary: ${c.summary} | Msgs: ${msgs?.length}`);
      if (msgs && msgs.length > 0) {
        console.log("   First msg:", msgs[0].body);
      }
    }
  }

  const { data: leads } = await supabaseAdmin.from("leads").select("id, name, phone, email, notes, created_at").limit(30);
  console.log("\nLeads in DB count:", leads?.length);
  if (leads) {
    for (const l of leads) {
      console.log(`Lead: ${l.name} | ${l.phone} | ${l.email} | ${l.created_at}`);
    }
  }
}

run().catch(console.error);