const instanceId = "3F89104678B85162FC2D92B31FE9D931";
const token = "91E284DA042276996B9E0C54";

async function testZApiLive() {
  console.log("Checking Z-API status now...");
  const statusRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/status`);
  console.log("Status HTTP:", statusRes.status);
  try {
    const statusData = await statusRes.json();
    console.log("Status Data:", statusData);
  } catch (e) {
    console.log("Status Text:", await statusRes.text());
  }

  console.log("Checking Z-API device...");
  const devRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/device`);
  console.log("Device HTTP:", devRes.status);
  try {
    console.log("Device Data:", await devRes.json());
  } catch (e) {
    console.log("Device Text:", await devRes.text());
  }
}

testZApiLive();