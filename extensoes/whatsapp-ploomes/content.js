// LZ7 · WhatsApp → Ploomes
// Mostra um botão quando há uma conversa aberta; ao clicar, manda nome e telefone dessa conversa
// para o formulário da SDR (que busca o anúncio de origem, cria o card no Comercial e avisa a Meta).

const soDigitos = (s) => (s || "").replace(/\D/g, "");

// Telefone do contato aberto. O WhatsApp Web guarda o número no data-id das mensagens
// ("false_5543999999999@c.us_ABC..."); contato salvo mostra o nome no cabeçalho, número fica no data-id.
function telefoneDaConversa() {
  const main = document.querySelector("#main");
  if (!main) return "";
  for (const el of main.querySelectorAll("[data-id]")) {
    const m = /^(?:true|false)_(\d{10,15})@c\.us/.exec(el.getAttribute("data-id") || "");
    if (m) return m[1];
  }
  // contato não salvo: o próprio cabeçalho é o número (+55 43 99999-9999)
  const titulo = nomeDaConversa();
  if (/^\+?[\d\s().-]{10,}$/.test(titulo)) return soDigitos(titulo);
  return "";
}

function nomeDaConversa() {
  const header = document.querySelector("#main header");
  if (!header) return "";
  const span = header.querySelector("span[dir='auto'][title], span[dir='auto']");
  return (span?.getAttribute("title") || span?.textContent || "").trim();
}

const botao = document.createElement("button");
botao.id = "lz7-cadastrar";
botao.hidden = true;
botao.innerHTML = "⚡ Cadastrar no Ploomes <small></small>";
document.documentElement.appendChild(botao);

// Plano B: contato com privacidade (id "@lid") não traz o número nas mensagens. Abre os dados do contato,
// lê o "+55 ..." que o WhatsApp mostra ali e fecha. Só acontece no clique da SDR.
async function telefoneDosDados() {
  const header = document.querySelector("#main header");
  if (!header) return "";
  header.click();
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const achado = [...document.querySelectorAll("span, div")].find((el) =>
      el.childElementCount === 0 && /^\+\d{2}[\d\s().-]{9,}$/.test((el.textContent || "").trim()),
    );
    if (achado) {
      const tel = soDigitos(achado.textContent);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return tel;
    }
  }
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return "";
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

// Atualiza o botão quando troca de conversa
setInterval(() => {
  const aberto = Boolean(document.querySelector("#main header"));
  botao.hidden = !aberto;
  if (aberto) {
    const tel = telefoneDaConversa();
    botao.querySelector("small").textContent = tel ? `· ${tel.replace(/^55/, "")}` : "";
  }
}, 800);
