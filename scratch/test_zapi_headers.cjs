const instanceId = "3F89104678B85162FC2D92B31FE9D931";
const token = "91E284DA042276996B9E0C54";

async function testWithHeaders() {
  // Test with Client-Token as token or empty
  const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/status`, {
    headers: { "Client-Token": token }
  });
  console.log("Status with token as Client-Token:", res.status, await res.json());
}

testWithHeaders();