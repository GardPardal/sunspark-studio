async function testEndpoints() {
  const instanceId = "3F89104678B85162FC2D92B31FE9D931";
  const token = "91E284DA042276996B9E0C54";
  const clientToken = "F88d0108286de430d89e7590b7fb9578dS";

  const headers = {
    "Content-Type": "application/json",
    "Client-Token": clientToken
  };

  const endpoints = [
    "/chats?page=1&pageSize=30",
    "/chats-paged?page=1&pageSize=30",
    "/contacts?page=1&pageSize=30",
    "/profile-picture?phone=554399760685",
    "/queue",
    "/device",
  ];

  for (const ep of endpoints) {
    const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}${ep}`, { headers });
    console.log(`Endpoint ${ep} -> Status: ${res.status}`);
    try {
      const data = await res.json();
      console.log(`  Data:`, Array.isArray(data) ? `Array with ${data.length} items` : data);
      if (Array.isArray(data) && data.length > 0) {
        console.log(`  First item:`, data[0]);
      }
    } catch {
      console.log(`  (not json)`);
    }
  }
}
testEndpoints().catch(console.error);