// Abre o formulário da SDR do Solar OS numa janela ao lado do WhatsApp, já com nome e telefone.
const FORM = "https://lz7energia.com.br/sdr-leadqualified";
let janela = null;

chrome.runtime.onMessage.addListener((msg, remetente) => {
  if (msg?.tipo !== "abrir") return;
  // Aba anônima: o formulário abre também numa janela anônima (a SDR entra no Solar OS uma vez nela).
  const anonima = Boolean(remetente?.tab?.incognito);
  const url = `${FORM}?ext=${encodeURIComponent(msg.id || "")}&nome=${encodeURIComponent(msg.nome || "")}&telefone=${encodeURIComponent(msg.telefone || "")}&de=whatsapp`;
  const abrirNova = () =>
    chrome.windows.create(
      { url, type: "popup", width: 560, height: 900, left: msg.left ?? 40, top: 40, incognito: anonima },
      (w) => (janela = w?.id ?? null),
    );
  if (janela === null) return abrirNova();
  // reaproveita a janela já aberta (troca de conversa = troca de lead)
  chrome.windows.get(janela, { populate: true }, (w) => {
    if (chrome.runtime.lastError || !w?.tabs?.length || w.incognito !== anonima) return abrirNova();
    chrome.tabs.update(w.tabs[0].id, { url });
    chrome.windows.update(janela, { focused: true });
  });
});

chrome.windows.onRemoved.addListener((id) => {
  if (id === janela) janela = null;
});
