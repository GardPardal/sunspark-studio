# Site institucional no WordPress + Elementor

Arquitetura definida:

```text
lz7energia.com.br          -> WordPress + Elementor (site institucional, editável por você)
app.lz7energia.com.br      -> Solar OS (este projeto: CRM, agenda, BI, ranking, Liz)
```

O sistema continua igual. A landing atual permanece no ar como fallback até o
WordPress estar pronto — nada foi removido.

---

## 1. Instalar o WordPress (cPanel GoDaddy)

1. Entre no cPanel → **Softaculous / Instalador de Aplicativos** → **WordPress** → *Install*.
2. Domínio: `lz7energia.com.br` · Diretório: **deixe vazio** (raiz).
3. Defina usuário/senha de administrador e conclua.
4. Instale os plugins: **Elementor**, **Elementor Pro** (opcional, libera Theme Builder e Forms),
   **Rank Math SEO** e **LiteSpeed Cache** (ou WP Rocket).
5. Escolha o tema **Hello Elementor** (base limpa, ideal para montar do zero).

## 2. Apontar o sistema para o subdomínio

1. No Lovable: **Project Settings → Domains → Connect Domain** e adicione
   `app.lz7energia.com.br`.
2. No DNS (GoDaddy) crie o registro indicado:
   - Tipo `A` · Nome `app` · Valor `185.158.133.1`
   - Registro `TXT` de verificação `_lovable` conforme mostrado na tela.
3. Depois que `app.` estiver ativo, mude o DNS da raiz (`@` e `www`) para a hospedagem
   do WordPress na GoDaddy.
4. Assim que o app estiver sendo servido em `app.`, a rota `/` dele redireciona
   automaticamente para `/hoje` (a landing só aparece em domínio que não começa com `app.`).

## 3. Formulários do WordPress caindo no sistema

Endpoint público já criado:

```text
POST https://app.lz7energia.com.br/api/public/lead
```

Aceita **JSON** ou **form-data** (o formato que o Elementor envia).

### Elementor Forms (recomendado)

No widget *Form* → **Actions After Submit** → adicione **Webhook** →
`https://app.lz7energia.com.br/api/public/lead`

Nomeie os campos (aba *Advanced → ID*) exatamente assim:

| ID do campo   | Obrigatório | Observação                    |
| ------------- | ----------- | ----------------------------- |
| `nome`        | sim         | mínimo 2 caracteres           |
| `telefone`    | sim         | WhatsApp com DDD              |
| `email`       | não         |                               |
| `cidade`      | não         |                               |
| `estado`      | não         |                               |
| `valor_conta` | não         | média da conta de luz         |
| `mensagem`    | não         |                               |
| `origem`      | não         | padrão: `wordpress`           |

Campos ocultos úteis para rastreamento: `utm_source`, `utm_medium`, `utm_campaign`,
`utm_term`, `utm_content`, `gclid`, `fbclid`, `fbp`, `fbc`, `page_url`.

Aliases aceitos automaticamente: `name`, `phone`, `whatsapp`, `celular`, `city`, `uf`, `message`.

### Qualquer outro formulário (HTML puro)

```html
<script>
document.querySelector('#form-lead').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const r = await fetch('https://app.lz7energia.com.br/api/public/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(fd)),
  });
  const data = await r.json();
  if (data.ok) window.location.href = 'https://wa.me/5543999999999';
});
</script>
```

Resposta de sucesso: `{ "ok": true }` · Erro de validação: HTTP 400 com a lista de campos.

Os leads aparecem em **/leads** e no CRM, com toda a atribuição de campanha preservada
(Ploomes e Meta CAPI seguem funcionando como hoje).

### Alternativa por link

Se preferir não usar webhook, basta apontar os botões do WordPress para:

- `https://app.lz7energia.com.br/wpp` — captura rápida + redirecionamento ao WhatsApp
- `https://app.lz7energia.com.br/captura` — formulário completo

## 4. SEO na migração

- Recrie no WordPress as mesmas seções/URLs principais para não perder posicionamento.
- Configure o sitemap do Rank Math e reenvie no Google Search Console.
- Mantenha o Pixel da Meta e o GA4/GTM no WordPress (Rank Math ou plugin de headers).
- O subdomínio `app.` não deve ser indexado — o `robots.txt` do sistema já bloqueia as
  áreas internas.

## 5. Checklist de virada

- [ ] WordPress instalado e site montado no Elementor
- [ ] `app.lz7energia.com.br` ativo e com SSL no Lovable
- [ ] Webhook do formulário testado (lead aparecendo em `/leads`)
- [ ] Pixel Meta + GA4 instalados no WordPress
- [ ] DNS da raiz apontado para a hospedagem WordPress
- [ ] Redirects 301 das URLs antigas configurados
