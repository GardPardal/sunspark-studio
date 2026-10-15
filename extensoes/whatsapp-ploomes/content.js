// LZ7 · WhatsApp → Ploomes
// Botão no cabeçalho da conversa aberta (não cobre mensagens). No clique, lê da tela o nome, o telefone, as
// mensagens (cliente × atendente) e as fotos que o cliente mandou, e abre o formulário da SDR, que entende a
// conversa (nome, cidade, conta de luz, unidade mais próxima) e, ao cadastrar, cria o card no Comercial e
// manda o Lead para a Meta. Sem Z-API: tudo sai do que está na tela do WhatsApp Web.

const soDigitos = (s) => (s || "").replace(/\D/g, "");
const ehTelefone = (s) => /^\+?[\d\s().-]{10,}$/.test((s || "").trim());

// Cabeçalho da conversa aberta (o WhatsApp muda os seletores de tempos em tempos: tenta vários).
function cabecalho() {
  return (
    document.querySelector("#main header") ||
    document.querySelector("[data-testid='conversation-header']") ||
    document.querySelector("div[role='main'] header") ||
    null
  );
}

function nomeDaConversa() {
  const header = cabecalho();
  if (!header) return "";
  const span = header.querySelector("span[dir='auto'][title], span[dir='auto']");
  return (span?.getAttribute("title") || span?.textContent || "").trim();
}

// Telefone do contato aberto. Contato não salvo: o cabeçalho é o próprio número (testado em 15/10/2026).
function telefoneDaConversa() {
  const main = document.querySelector("#main") || document.body;
  for (const el of main.querySelectorAll("[data-id]")) {
    const m = /^(?:true|false)_(\d{10,15})@c\.us/.exec(el.getAttribute("data-id") || "");
    if (m) return m[1];
  }
  const titulo = nomeDaConversa();
  return ehTelefone(titulo) ? soDigitos(titulo) : "";
}

// Plano B: contato salvo com nome. Abre "Dados do contato" (painel à direita), lê o "+55 ..." e fecha pelo X.
// Só no clique da SDR. Nunca usa Esc (Esc fecha a conversa).
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
  const fechar = [
    ...document.querySelectorAll("[aria-label='Fechar'], [aria-label='Close'], [data-icon='x'], [data-icon='close']"),
  ].find((el) => el.getBoundingClientRect().left >= limite);
  (fechar?.closest("button, [role='button']") || fechar)?.click();
  return tel;
}

// Quem mandou: o WhatsApp põe "[hh:mm, dd/mm/aaaa] Nome: " em data-pre-plain-text. Nome igual ao do
// cabeçalho (ou mesmo número) = cliente. Se não bater, decide pelo lado da bolha (esquerda = cliente).
function ehDoCliente(el, titulo, metade) {
  const pre = el.getAttribute("data-pre-plain-text") || "";
  const quem = (/\]\s*(.*?):\s*$/.exec(pre)?.[1] || "").trim();
  if (quem && titulo) {
    if (quem === titulo) return true;
    if (ehTelefone(quem) && ehTelefone(titulo) && soDigitos(quem).endsWith(soDigitos(titulo).slice(-8))) return true;
  }
  const r = el.getBoundingClientRect();
  return r.left + r.width / 2 < metade;
}

function mensagensDaTela() {
  const main = document.querySelector("#main");
  if (!main) return [];
  const caixa = main.getBoundingClientRect();
  const metade = caixa.left + caixa.width / 2;
  const titulo = nomeDaConversa();
  return [...main.querySelectorAll("[data-pre-plain-text]")]
    .map((el) => {
      const texto = (el.querySelector("span.selectable-text")?.innerText || el.innerText || "").trim();
      return { de: ehDoCliente(el, titulo, metade) ? "cliente" : "atendente", texto: texto.slice(0, 2000) };
    })
    .filter((m) => m.texto)
    .slice(-120);
}

// Fotos que o cliente mandou (até 3, as mais recentes), reduzidas para ~1000 px em JPEG.
function imagensDaTela() {
  const main = document.querySelector("#main");
  if (!main) return [];
  const caixa = main.getBoundingClientRect();
  const metade = caixa.left + caixa.width / 2;
  const fotos = [...main.querySelectorAll("img[src^='blob:']")].filter((img) => {
    if (img.naturalWidth < 200 || img.naturalHeight < 200) return false;
    const r = img.getBoundingClientRect();
    return r.left + r.width / 2 < metade;
  });
  return fotos
    .slice(-3)
    .map((img) => {
      try {
        const escala = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * escala);
        c.height = Math.round(img.naturalHeight * escala);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", 0.8);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const botao = document.createElement("button");
botao.id = "lz7-cadastrar";
botao.type = "button";
botao.title = "Ler a conversa e cadastrar o lead no Ploomes";
botao.textContent = "⚡ Cadastrar no Ploomes";

// Coloca o botão junto dos ícones do cabeçalho (à esquerda deles). Reaplica quando a conversa muda.
function posicionar() {
  const header = cabecalho();
  if (!header) return botao.remove();
  let alvo = header.lastElementChild;
  while (alvo && alvo.children.length === 1) alvo = alvo.firstElementChild;
  if (!alvo) return;
  if (botao.parentElement !== alvo) alvo.prepend(botao);
}
setInterval(posicionar, 800);

botao.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (botao.disabled) return;
  botao.disabled = true;
  botao.textContent = "⏳ Lendo a conversa…";
  try {
    const titulo = nomeDaConversa();
    const telefone = telefoneDaConversa() || (await telefoneDosDados());
    const dados = {
      nome: ehTelefone(titulo) ? "" : titulo,
      telefone,
      mensagens: mensagensDaTela(),
      imagens: imagensDaTela(),
      em: Date.now(),
    };
    const id = `c${Date.now().toString(36)}`;
    // limpa leituras antigas e guarda esta para o formulário pegar
    const tudo = await chrome.storage.local.get(null);
    const velhas = Object.keys(tudo).filter((k) => /^c[a-z0-9]+$/.test(k) && Date.now() - (tudo[k]?.em || 0) > 30 * 60e3);
    if (velhas.length) await chrome.storage.local.remove(velhas);
    await chrome.storage.local.set({ [id]: dados });
    chrome.runtime.sendMessage({
      tipo: "abrir",
      id,
      nome: dados.nome,
      telefone,
      left: Math.max(0, window.screenX + window.outerWidth - 580),
    });
  } finally {
    setTimeout(() => {
      botao.disabled = false;
      botao.textContent = "⚡ Cadastrar no Ploomes";
    }, 1200);
  }
});
console.log("[LZ7] extensão WhatsApp → Ploomes carregada");
