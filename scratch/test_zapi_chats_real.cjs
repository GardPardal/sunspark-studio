async function testChats() {
  const instanceId = "3F89104678B85162FC2D92B31FE9D931";
  const token = "91E284DA042276996B9E0C54";
  const clientToken = "F88d0108286de430d89e7590b7fb9578dS";

  const headers = {
    "Content-Type": "application/json",
    "Client-Token": clientToken
  };

  const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/chats?page=1&pageSize=50`, { headers });
  const chats = await res.json();
  console.log(`Fetched ${chats.length} real chats from Stephany's WhatsApp:`);
  for (let i = 0; i < Math.min(15, chats.length); i++) {
    const c = chats[i];
    console.log(`[${i+1}] ${c.name || c.phone} (${c.phone}) - unread: ${c.unread}, pinned: ${c.pinned}`);
  }
}
testChats().catch(console.error);