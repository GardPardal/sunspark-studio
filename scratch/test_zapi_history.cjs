async function testFetch() {
  const instanceId = "3F89104678B85162FC2D92B31FE9D931";
  const token = "91E284DA042276996B9E0C54";
  
  console.log("Checking Z-API status...");
  const statusRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/status`);
  const status = await statusRes.json();
  console.log("Status:", status);

  console.log("\nChecking /chats endpoint...");
  const chatsRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/chats?page=1&pageSize=10`);
  console.log("Chats HTTP Status:", chatsRes.status);
  const chats = await chatsRes.json();
  console.log("Chats result:", Array.isArray(chats) ? `Array with ${chats.length} chats` : chats);
  if (Array.isArray(chats) && chats.length > 0) {
    console.log("Sample chat:", JSON.stringify(chats[0], null, 2));
    const phone = chats[0].phone || chats[0].id || chats[0].jid;
    if (phone) {
      console.log(`\nFetching messages for ${phone}...`);
      const msgsRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/chat-messages/${phone}`);
      console.log("Messages HTTP Status:", msgsRes.status);
      const msgs = await msgsRes.json();
      console.log("Messages count:", Array.isArray(msgs) ? msgs.length : msgs);
      if (Array.isArray(msgs) && msgs.length > 0) {
        console.log("Sample message:", JSON.stringify(msgs[0], null, 2));
      }
    }
  }
}

testFetch().catch(console.error);