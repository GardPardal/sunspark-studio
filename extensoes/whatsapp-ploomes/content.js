// LZ7 · WhatsApp → Ploomes
// Mostra um botão quando há uma conversa aberta; ao clicar, manda nome e telefone dessa conversa
// para o formulário da SDR (que busca o anúncio de origem, cria o card no Comercial e avisa a Meta).

const soDigitos = (s) => (s || "").replace(/\D/g, "");

// Telefone do contato aberto. Contato não salvo: o cabeçalho é o próprio número (testado em 15/10/2026).
// Versões antigas do WhatsApp Web também punham o número no data-id das mensagens ("false_55...@c.us_...").
function telefoneDaConversa() {
  const main = document.querySelector("#main") || document.querySelector("div[role='main']") || document.body;
  for (const el of main.querySelectorAll("[data-id]")) {
    const m = /^(?:true|false)_(\d{10,15})@c\.us/.exec(el.getAttribute("data-id") || "");
    if (m) return m[1];
  }
  // contato não salvo: o próprio cabeçalho é o número (+55 43 99999-9999)
  const titulo = nomeDaConversa();
  if (/^\+?[\d\s().-]{10,}$/.test(titulo)) return soDigitos(titulo);
  return "";
}

// Cabeçalho da conversa aberta (o WhatsApp muda os seletores de tempos em tempos: tenta vários).
function cabecalho() {
  return (
    document.querySelector("#main header") ||
    document.querySelector("[data-testid='conversation-header']") ||
    document.querySelector("div[role='main'] header") ||
    [...document.querySelectorAll("header")].find((h) => h.getBoundingClientRect().left > 300) ||
    null
  );
}

function nomeDaConversa() {
  const header = cabecalho();
  if (!header) return "";
  const span = header.querySelector("span[dir='auto'][title], span[dir='auto']");
  return (span?.getAttribute("title") || span?.textContent || "").trim();
}

const botao = document.createElement("button");
botao.id = "lz7-cadastrar";
botao.hidden = false;
botao.innerHTML = "⚡ Cadastrar no Ploomes <small></small>";
document.documentElement.appendChild(botao);

// Plano B: contato salvo com nome (o cabeçalho mostra o nome, e o WhatsApp não põe mais o número no id das
// mensagens). Abre "Dados do contato" (painel à direita da conversa), lê o "+55 ..." de lá e fecha pelo X.
// Só acontece no clique da SDR. Nunca usa Esc (Esc fecha a conversa).
async function telefoneDosDados() {
  const header = cabecalho();
  const main = document.querySelector("#main");
  if (!header || !main) return "";
  (header.querySelector("[role='button']") || header).click();
  let tel = "";
  let limite = 0;
  for (let i = 0; i < 15 && !tel; i++) {
    await new Promise((r) => setTimeout(r, 200));
    // o painel abre à direita e a conversa encolhe: mede a borda depois de abrir
    limite = (document.querySelector("#main") || main).getBoundingClientRect().right - 5;
    const achado = [...document.querySelectorAll("span, div")].find(
      (el) =>
        el.childElementCount === 0 &&
        !el.closest("#main") &&
        el.getBoundingClientRect().left >= limite &&
        /^\+\d{2}[\d\s().-]{9,}$/.test((el.textContent || "").trim()),
    );
    if (achado) tel = soDigitos(achado.textContent);
  }
  const fechar = [...document.querySelectorAll("[aria-label='Fechar'], [aria-label='Close'], [data-icon='x'], [data-icon='close']")]
    .find((el) => el.getBoundingClientRect().left >= limite);
  (fechar?.closest("button, [role='button']") || fechar)?.click();
  return tel;
}

botao.addEventListener("click", async () => {
  const nome = nomeDaConversa();
  const telefone = telefoneDaConversa() || (await telefoneDosDados());
  chrome.runtime.sendMessage({
    tipo: "abrir",
    nome: /^\+?[\d\s().-]{10,}$/.test(nome) ? "" : nome,
    telefone,
    left: Math.max(0, window.screenX + window.outerWidth - 580),
  });
});

// Sempre visível; mostra o número quando consegue ler a conversa aberta
setInterval(() => {
  const tel = cabecalho() ? telefoneDaConversa() : "";
  botao.querySelector("small").textContent = tel ? `· ${tel.replace(/^55/, "")}` : "";
}, 1000);
console.log("[LZ7] extensão WhatsApp → Ploomes carregada");
