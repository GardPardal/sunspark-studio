const instanceId = "3F89104678B85162FC2D92B31FE9D931";
const token = "91E284DA042276996B9E0C54";
const clientToken = "F88d0108286de430d89e7590b7fb9578dS";

const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;
const headers = {
  "Content-Type": "application/json",
  "Client-Token": clientToken
};

async function testZApiEndpoints() {
  console.log("=== 1. TESTANDO ENDPOINT DE CHATS ===");
  const resChats = await fetch(`${baseUrl}/chats?page=1&pageSize=10`, { headers });
  console.log("Status /chats:", resChats.status);
  const chats = await resChats.json();
  console.log("Chats count:", Array.isArray(chats) ? chats.length : chats);
  if (Array.isArray(chats) && chats.length > 0) {
    console.log("Exemplo de chat:", JSON.stringify(chats[0], null, 2));
    const testPhone = chats[0].phone || chats[0].id || chats[0].jid;
    const cleanPhone = String(testPhone).replace(/\D/g, "");
    console.log("Telefone de teste selecionado:", cleanPhone);

    // Testar possíveis endpoints de histórico de mensagens na Z-API
    const candidateEndpoints = [
      `/chat-messages/${cleanPhone}?page=1&pageSize=20`,
      `/chat-messages?phone=${cleanPhone}&page=1&pageSize=20`,
      `/messages/${cleanPhone}?page=1&pageSize=20`,
      `/messages?phone=${cleanPhone}&page=1&pageSize=20`,
      `/chats/${cleanPhone}/messages?page=1&pageSize=20`,
      `/messages-chat/${cleanPhone}?page=1&pageSize=20`,
      `/contacts`
    ];

    for (const ep of candidateEndpoints) {
      try {
        const res = await fetch(`${baseUrl}${ep}`, { headers });
        console.log(`Endpoint ${ep} => Status ${res.status}`);
        if (res.ok) {
          const body = await res.json();
          console.log(`   -> Resposta (${Array.isArray(body) ? body.length + " itens" : typeof body}):`, JSON.stringify(body).slice(0, 300));
        }
      } catch (e) {
        console.log(`Endpoint ${ep} => Erro:`, e.message);
      }
    }
  }
}

testZApiEndpoints().catch(console.error);