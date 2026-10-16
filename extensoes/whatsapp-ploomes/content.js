// LZ7 · WhatsApp → Ploomes
// Botão no cabeçalho da conversa aberta (não cobre mensagens). No clique, lê da tela o nome, o telefone, as
// mensagens (cliente × atendente), as fotos que o cliente mandou e o código do anúncio "(cód. 7K2QX)" da
// 1ª mensagem (rola a conversa para cima se ele não estiver carregado), e abre o formulário da SDR, que
// entende a conversa (nome, cidade, conta de luz, unidade mais próxima) e, ao cadastrar, cria o card no
// Comercial e manda o Lead para a Meta ligado ao anúncio. Sem Z-API: tudo sai da tela do WhatsApp Web.

const soDigitos = (s) => (s || "").replace(/\D/g, "");
const ehTelefone = (s) => /^\+?[\d\s().-]{10,}$/.test((s || "").trim());
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// mesmo formato do servidor (src/lib/leads/clique-whatsapp.server.ts)
const RE_CODIGO = /c[oó]d(?:igo)?\.?\s*:?\s*([A-Z0-9]{5})\b/i;

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

// Telefone do contato aberto. Contato não salvo: o cabeçalho é o próprio número. Versões antigas do
// WhatsApp Web punham o número no data-id das mensagens ("true_5543...@c.us"); as atuais não (16/10/2026).
function telefoneDaConversa() {
  const titulo = nomeDaConversa();
  if (ehTelefone(titulo)) return soDigitos(titulo);
  const main = document.querySelector("#main") || document.body;
  for (const el of main.querySelectorAll("[data-id]")) {
    const m = /^(?:true|false)_(\d{10,15})@c\.us/.exec(el.getAttribute("data-id") || "");
    if (m) return m[1];
  }
  return "";
}

// Contato salvo com nome: abre "Dados do contato" (painel à direita), lê o "+55 ..." e fecha pelo X.
// Só no clique da SDR. Nunca usa Esc (Esc fecha a conversa). Testado no WhatsApp Business em 16/10/2026.
async function telefoneDosDados() {
  const header = cabecalho();
  const main = document.querySelector("#main");
  if (!header || !main) return "";
  (header.querySelector("[role='button']") || header).click();
  let tel = "";
  let limite = 0;
  for (let i = 0; i < 15 && !tel; i++) {
    await espera(200);
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

function todasMensagens() {
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
    .filter((m) => m.texto);
}

// Código do anúncio: o mais recente que o CLIENTE mandou (cai para qualquer mensagem se o lado falhar).
function codigoNaTela(mensagens) {
  const doCliente = mensagens.filter((m) => m.de === "cliente");
  for (const lista of [doCliente, mensagens])
    for (let i = lista.length - 1; i >= 0; i--) {
      const m = RE_CODIGO.exec(lista[i].texto);
      if (m) return m[1].toUpperCase();
    }
  return null;
}

// Área que rola as mensagens (a maior com rolagem dentro da conversa).
function areaDeRolagem() {
  const main = document.querySelector("#main");
  if (!main) return null;
  let melhor = null;
  for (const el of main.querySelectorAll("div")) {
    if (el.scrollHeight - el.clientHeight < 40) continue;
    const oy = getComputedStyle(el).overflowY;
    if (oy !== "auto" && oy !== "scroll") continue;
    if (!melhor || el.clientHeight > melhor.clientHeight) melhor = el;
  }
  return melhor;
}

// O código vai na 1ª mensagem do cliente. Conversa longa: o WhatsApp só carrega as últimas, então sobe
// até achar o código ou chegar ao começo (no máximo ~10 s) e volta para o fim.
async function carregarAteCodigo(avisar) {
  if (codigoNaTela(todasMensagens())) return;
  const area = areaDeRolagem();
  if (!area) return;
  let parado = 0;
  for (let i = 0; i < 20 && parado < 3; i++) {
    avisar(`⏳ Procurando o anúncio… ${i + 1}`);
    const antes = area.scrollHeight;
    area.scrollTop = 0;
    await espera(500);
    if (codigoNaTela(todasMensagens())) break;
    parado = area.scrollHeight === antes ? parado + 1 : 0;
  }
  area.scrollTop = area.scrollHeight;
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

const TEXTO = "⚡ Cadastrar no Ploomes";
const botao = document.createElement("button");
botao.id = "lz7-cadastrar";
botao.type = "button";
botao.title = "Ler a conversa e cadastrar o lead no Ploomes";
botao.textContent = TEXTO;

// Coloca o botão junto dos ícones do cabeçalho (à esquerda deles). Reaplica quando a conversa muda.
function posicionar() {
  const header = cabecalho();
  if (!header) return botao.remove();
  let alvo = header.lastElementChild;
  while (alvo && alvo.children.length === 1) alvo = alvo.firstElementChild;
  if (!alvo) return;
  if (botao.parentElement !== alvo) alvo.prepend(botao);
}
const relogio = setInterval(() => {
  // extensão atualizada/recarregada com o WhatsApp aberto: este script ficou órfão
  if (!chrome.runtime?.id) {
    clearInterval(relogio);
    botao.textContent = "↻ Atualize o WhatsApp (F5)";
    botao.title = "A extensão foi atualizada: recarregue esta página para o botão voltar a funcionar";
    return;
  }
  posicionar();
}, 800);

function avisar(texto, erro = false) {
  botao.textContent = texto;
  botao.classList.toggle("lz7-erro", erro);
}

botao.addEventListener("click", async (e) => {
  e.stopPropagation();
  e.preventDefault();
  if (botao.disabled) return;
  if (!chrome.runtime?.id) {
    avisar("↻ Atualize o WhatsApp (F5)", true);
    return;
  }
  botao.disabled = true;
  let final = TEXTO;
  let erro = false;
  try {
    avisar("⏳ Lendo a conversa…");
    const titulo = nomeDaConversa();
    const telefone = telefoneDaConversa() || (await telefoneDosDados());
    await carregarAteCodigo(avisar);
    const todas = todasMensagens();
    const codigo = codigoNaTela(todas);
    let mensagens = todas.slice(-120);
    // a mensagem do código (normalmente a 1ª) vai junto mesmo em conversa longa
    if (codigo && !mensagens.some((m) => m.texto.toUpperCase().includes(codigo))) {
      const comCodigo = todas.find((m) => m.texto.toUpperCase().includes(codigo));
      if (comCodigo) mensagens = [comCodigo, ...mensagens.slice(1)];
    }
    const dados = {
      nome: ehTelefone(titulo) ? "" : titulo,
      telefone,
      mensagens,
      imagens: imagensDaTela(),
      codigo,
      em: Date.now(),
    };
    const id = `c${Date.now().toString(36)}`;
    // limpa leituras antigas e guarda esta para o formulário pegar
    const tudo = await chrome.storage.local.get(null);
    const velhas = Object.keys(tudo).filter((k) => /^c[a-z0-9]+$/.test(k) && Date.now() - (tudo[k]?.em || 0) > 30 * 60e3);
    if (velhas.length) await chrome.storage.local.remove(velhas);
    await chrome.storage.local.set({ [id]: dados });
    const largura = 560;
    const left = Math.max(
      window.screen.availLeft || 0,
      Math.min(window.screenX + window.outerWidth - largura - 20, (window.screen.availLeft || 0) + window.screen.availWidth - largura),
    );
    const r = await chrome.runtime.sendMessage({ tipo: "abrir", id, nome: dados.nome, telefone, left, largura });
    if (r && r.ok === false) throw new Error(r.erro || "não abriu o formulário");
    final = codigo ? `✔ Formulário aberto · anúncio ${codigo}` : telefone ? "✔ Formulário aberto" : "✔ Aberto · digite o telefone";
  } catch (err) {
    console.error("[LZ7]", err);
    erro = true;
    final = /context invalidated|Receiving end/i.test(String(err?.message || err))
      ? "↻ Atualize o WhatsApp (F5)"
      : "⚠ Falhou · clique de novo";
  } finally {
    avisar(final, erro);
    setTimeout(() => {
      botao.disabled = false;
      if (chrome.runtime?.id) avisar(TEXTO);
    }, erro ? 4000 : 2500);
  }
});
console.log("[LZ7] extensão WhatsApp → Ploomes carregada");
