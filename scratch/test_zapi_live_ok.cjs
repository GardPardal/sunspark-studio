const { getZApiConfig, zApiHeaders, zApiUrl } = require("./scratch/test_zapi_client_token.cjs");

async function testZ() {
  const instanceId = "3F89104678B85162FC2D92B31FE9D931";
  const token = "91E284DA042276996B9E0C54";
  const clientToken = "F88d0108286de430d89e7590b7fb9578dS";

  console.log("Checking Z-API status with configured token...");
  const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/status`, {
    headers: {
      "Content-Type": "application/json",
      "Client-Token": clientToken
    }
  });
  console.log("Status:", await res.json());
}
testZ().catch(console.error);