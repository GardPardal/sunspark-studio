const instanceId = "3F89104678B85162FC2D92B31FE9D931";
const token = "91E284DA042276996B9E0C54";

async function testZApi() {
  console.log("Testando Z-API Status...");
  const statusRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/status`);
  console.log("Status HTTP:", statusRes.status);
  const statusData = await statusRes.json();
  console.log("Status Data:", statusData);

  console.log("Testando QR Code Image...");
  const qrRes = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/qr-code/image`);
  console.log("QR HTTP:", qrRes.status);
  const qrData = await qrRes.json();
  console.log("QR Data:", { ...qrData, value: qrData.value ? qrData.value.substring(0, 50) + "..." : null });
}

testZApi();