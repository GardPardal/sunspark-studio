// LZ7 · WhatsApp → Ploomes — roda no formulário da SDR (Solar OS).
// Entrega ao formulário a conversa que a extensão leu no WhatsApp Web (guardada em chrome.storage) e apaga
// depois de entregar. O formulário analisa (nome, cidade, conta, unidade mais próxima) e preenche os campos.

(async () => {
  const pedido = new URLSearchParams(location.search).get("ext");
  const tudo = await chrome.storage.local.get(null);
  let id = pedido && tudo[pedido] ? pedido : null;
  // o login pode ter tirado o ?ext= da URL: usa a leitura mais recente dos últimos 10 minutos
  if (!id) {
    id =
      Object.keys(tudo)
        .filter((k) => /^c[a-z0-9]+$/.test(k) && Date.now() - (tudo[k]?.em || 0) < 10 * 60e3)
        .sort((a, b) => tudo[b].em - tudo[a].em)[0] || null;
  }
  if (!id) return;
  const dados = tudo[id];
  let entregue = false;
  window.addEventListener("message", (e) => {
    if (entregue || e.source !== window || e.data?.tipo !== "lz7-formulario-pronto") return;
    entregue = true;
    window.postMessage({ tipo: "lz7-conversa", dados }, location.origin);
    chrome.storage.local.remove(id);
  });
  // o formulário pode ter carregado antes deste script: pede para ele avisar de novo
  window.postMessage({ tipo: "lz7-extensao-pronta" }, location.origin);
})();
