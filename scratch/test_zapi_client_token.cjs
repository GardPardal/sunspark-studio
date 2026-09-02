async function test() {
  const instanceId = "3F89104678B85162FC2D92B31FE9D931";
  const token = "91E284DA042276996B9E0C54";
  const rawClientToken = "F88d0108286de430d89e7590b7fb9578dS";
  
  console.log("Testing with Client-Token:", rawClientToken);
  
  // Test /status
  let res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/status`, {
    headers: {
      "Content-Type": "application/json",
      "Client-Token": rawClientToken
    }
  });
  console.log("Status response HTTP:", res.status);
  console.log("Status body:", await res.json());

  // Test /chats
  res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/chats?page=1&pageSize=10`, {
    headers: {
      "Content-Type": "application/json",
      "Client-Token": rawClientToken
    }
  });
  console.log("\nChats response HTTP:", res.status);
  const chats = await res.json();
  console.log("Chats count:", Array.isArray(chats) ? chats.length : chats);
  if (Array.isArray(chats) && chats.length > 0) {
    console.log("Sample chat 1:", JSON.stringify(chats[0], null, 2));
    const phone = chats[0].phone || chats[0].id || chats[0].jid;
    if (phone) {
      console.log(`\nFetching real messages for ${phone}...`);
      const msgRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/chat-messages/${phone}`, {
        headers: {
          "Content-Type": "application/json",
          "Client-Token": rawClientToken
        }
      });
      console.log("Chat-messages HTTP:", msgRes.status);
      const msgs = await msgRes.json();
      console.log("Messages count:", Array.isArray(msgs) ? msgs.length : msgs);
      if (Array.isArray(msgs) && msgs.length > 0) {
        console.log("Sample message 1:", JSON.stringify(msgs[0], null, 2));
      }
    }
  }
}
test().catch(console.error);