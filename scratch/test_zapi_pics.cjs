async function testPics() {
  const instanceId = "3F89104678B85162FC2D92B31FE9D931";
  const token = "91E284DA042276996B9E0C54";
  const clientToken = "F88d0108286de430d89e7590b7fb9578dS";

  const phones = ["554399760685", "554399760715", "554488396598", "5513996980904", "554398049898", "5518935008812", "554299714357"];

  for (const p of phones) {
    const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/profile-picture?phone=${p}`, {
      headers: { "Content-Type": "application/json", "Client-Token": clientToken }
    });
    const data = await res.json();
    console.log(`Phone ${p} pic:`, data.link ? `${data.link.slice(0, 60)}...` : data);
  }
}
testPics().catch(console.error);