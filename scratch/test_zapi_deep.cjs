async function test() {
  const instanceId = "3F89104678B85162FC2D92B31FE9D931";
  const token = "91E284DA042276996B9E0C54";

  console.log("1. Testing GET /status with no headers...");
  let res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/status`);
  console.log("Status:", res.status, await res.json());

  console.log("\n2. Testing GET /chats with no Client-Token header...");
  res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/chats`);
  console.log("Chats:", res.status, await res.json());

  console.log("\n3. Testing GET /messages with no Client-Token header...");
  res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/messages`);
  console.log("Messages:", res.status, await res.json());

  console.log("\n4. Testing GET /chat-messages/5518935008812...");
  res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/chat-messages/5518935008812`);
  console.log("Chat messages:", res.status, await res.json());
}
test().catch(console.error);