// Abre o formulário da SDR do Solar OS numa janela ao lado do WhatsApp, já com nome e telefone.
// A janela é reaproveitada (troca de conversa = troca de lead). O id dela fica em storage.session porque
// o Chrome desliga este service worker quando fica parado e a variável se perdia.
const FORM = "https://lz7energia.com.br/sdr-leadqualified";

const janelaGuardada = async () => (await chrome.storage.session.get("janela")).janela ?? null;
const guardarJanela = (id) => chrome.storage.session.set({ janela: id });

async function abrir(msg, remetente) {
  // Aba anônima: o formulário abre também numa janela anônima (a SDR entra no Solar OS uma vez nela).
  const anonima = Boolean(remetente?.tab?.incognito);
  const url = `${FORM}?ext=${encodeURIComponent(msg.id || "")}&nome=${encodeURIComponent(msg.nome || "")}&telefone=${encodeURIComponent(msg.telefone || "")}&de=whatsapp`;

  const id = await janelaGuardada();
  if (id !== null) {
    try {
      const w = await chrome.windows.get(id, { populate: true });
      if (w?.tabs?.length && w.incognito === anonima) {
        await chrome.tabs.update(w.tabs[0].id, { url });
        await chrome.windows.update(id, { focused: true });
        return;
      }
    } catch {
      /* janela fechada */
    }
  }
  try {
    const w = await chrome.windows.create({
      url,
      type: "popup",
      width: msg.largura || 560,
      height: 900,
      left: Math.round(msg.left ?? 40),
      top: 40,
      ...(anonima ? { incognito: true } : {}),
    });
    await guardarJanela(w?.id ?? null);
  } catch (e) {
    // posição fora da tela ou janela recusada: abre numa aba ao lado do WhatsApp
    console.warn("[LZ7] janela recusada, abrindo aba:", e);
    await chrome.tabs.create({
      url,
      windowId: remetente?.tab?.windowId,
      index: (remetente?.tab?.index ?? 0) + 1,
    });
    await guardarJanela(null);
  }
}

chrome.runtime.onMessage.addListener((msg, remetente, responder) => {
  if (msg?.tipo !== "abrir") return;
  abrir(msg, remetente).then(
    () => responder({ ok: true }),
    (e) => responder({ ok: false, erro: String(e?.message || e) }),
  );
  return true; // resposta assíncrona
});

chrome.windows.onRemoved.addListener(async (id) => {
  if (id === (await janelaGuardada())) await guardarJanela(null);
});
