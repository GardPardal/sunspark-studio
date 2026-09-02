async function testSend() {
  const instanceId = "3F89104678B85162FC2D92B31FE9D931";
  const token = "91E284DA042276996B9E0C54";

  console.log("Testing POST /send-text...");
  const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "554399760685", message: "teste" })
  });
  console.log("Send-text status:", res.status, await res.json());
}
testSend().catch(console.error);