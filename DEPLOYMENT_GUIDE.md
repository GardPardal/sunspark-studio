# Guia de Deploy para Produção

## 📋 Checklist de Preparação

### 1. **Instalar Dependências**
```bash
bun install
# ou se usar npm:
npm install
```

### 2. **Compilar para Produção**
```bash
bun run build
# ou com npm:
npm run build
```

Isso vai criar uma pasta `dist/` com os arquivos prontos para upload.

---

## 🔐 Variáveis de Ambiente Necessárias

Este projeto usa Supabase e possui dois tipos de variáveis:

### **Variáveis Públicas (já configuradas no .env):**
- `VITE_SUPABASE_URL` ✅
- `VITE_SUPABASE_PUBLISHABLE_KEY` ✅

### **Variáveis Privadas (servidor - PRECISA CONFIGURAR):**
Você precisa adicionar a `SUPABASE_SERVICE_ROLE_KEY` no seu servidor de hospedagem:

```
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxxxxxxx...
```

**Como obter:**
1. Vá para [console.supabase.com](https://console.supabase.com)
2. Selecione seu projeto (ID: `dwwospznutfbxcbbcqfa`)
3. Vá em **Settings** > **API**
4. Copie a **Service Role Key** (a chave que começa com `sb_secret_`)

---

## 📦 Estrutura dos Arquivos para Upload

Após compilar, você terá:

```
dist/
├── client/          # Arquivos do frontend (HTML, CSS, JS)
├── server/          # Arquivos do servidor (SSR)
└── ...outros
```

---

## 🚀 Opções de Hospedagem

### **Opção 1: Cloudflare (RECOMENDADO)**
Este é um projeto TanStack Start com SSR, funciona perfeitamente em Cloudflare Workers.

```bash
# Fazer deploy direto para Cloudflare
bun run deploy
# ou npm run deploy
```

### **Opção 2: Vercel**
```bash
npm i -g vercel
vercel deploy
```

### **Opção 3: Node.js Hosting (Heroku, Railway, Render, etc)**

1. Compile o projeto:
```bash
bun run build
```

2. Faça upload da pasta `dist/` para seu servidor

3. Configure variáveis de ambiente no painel da hospedagem:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

4. Configure o comando de inicialização:
```bash
node dist/server/index.js
# ou verifique o arquivo exato em dist/server/
```

### **Opção 4: Hospedagem Tradicional (cPanel, Plesk, etc)**

Se sua hospedagem suporta Node.js:

1. Compile localmente:
```bash
bun run build
```

2. Faça upload de TUDO (incluindo node_modules) via FTP/SFTP:
   - Todos os arquivos do projeto
   - Pasta `dist/`
   - Pasta `node_modules/`

3. Conecte-se via SSH ou painel e execute:
```bash
npm install --production
npm run preview
```

---

## 📝 Passo a Passo para Upload

### **Se sua hospedagem suporta Node.js + Git:**

1. **Localmente:**
```bash
git add .
git commit -m "Prepare for production"
git push origin main
```

2. **No servidor:**
```bash
git clone seu-repositorio
cd seu-projeto
bun install # ou npm install
bun run build
export SUPABASE_SERVICE_ROLE_KEY="sua-chave-aqui"
node dist/server/index.js
```

### **Se sua hospedagem NÃO suporta Node.js:**

Se sua hospedagem é apenas para arquivos estáticos (HTML/CSS/JS puro), este projeto NÃO funcionará porque é um SSR (Server-Side Rendering) que precisa de Node.js.

Alternativas:
- **Fazer upgrade** para hospedagem com Node.js
- **Usar Vercel, Netlify ou Cloudflare** (gratuito)
- **Compilar como SPA** (requer alterações no código)

---

## 🔗 Checklist Final

- [ ] Dependências instaladas (`bun install`)
- [ ] Projeto compilado (`bun run build`)
- [ ] Pasta `dist/` criada e verificada
- [ ] Variável `SUPABASE_SERVICE_ROLE_KEY` obtida do console Supabase
- [ ] Hospedagem escolhida e verificada
- [ ] Variáveis de ambiente configuradas no servidor
- [ ] Arquivos feitos upload
- [ ] Site testado em produção

---

## 🆘 Troubleshooting

### Erro: "Cannot find module 'node:...'"
- Seu servidor não tem Node.js instalado
- Faça upgrade para hospedagem com Node.js

### Erro: "SUPABASE_SERVICE_ROLE_KEY is not defined"
- Adicione a variável no painel de hospedagem
- Não a coloque no arquivo .env (é uma chave privada!)

### Site em branco/erro 500
- Verifique os logs do servidor
- Confirme que Node.js está rodando corretamente
- Verifique as variáveis de ambiente

### Imagens/assets não carregam
- Verifique se a pasta `public/` foi incluída no upload
- Confirme que os caminhos relativos estão corretos

---

## 📞 Próximos Passos

1. Escolha sua plataforma de hospedagem
2. Siga o guia específico acima
3. Teste a aplicação
4. Acesse seu domínio!

**Dúvidas?** Consulte a documentação:
- [TanStack Start](https://tanstack.com/start/latest)
- [Supabase](https://supabase.com/docs)
- [Seu provedor de hospedagem](https://seu-provedor.com/docs)
