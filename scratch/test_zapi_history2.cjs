async function testFetch() {
  const instanceId = "3F89104678B85162FC2D92B31FE9D931";
  const token = "91E284DA042276996B9E0C54";
  
  console.log("Checking Z-API status with Client-Token header...");
  const statusRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/status`, {
    headers: {
      "Content-Type": "application/json",
      "Client-Token": token
    }
  });
  console.log("Status with token:", await statusRes.json());

  console.log("\nChecking /chats endpoint with Client-Token header...");
  const chatsRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/chats?page=1&pageSize=10`, {
    headers: {
      "Content-Type": "application/json",
      "Client-Token": token
    }
  });
  console.log("Chats HTTP Status:", chatsRes.status);
  const chats = await chatsRes.json();
  console.log("Chats result:", chats);
}

testFetch().catch(console.error);