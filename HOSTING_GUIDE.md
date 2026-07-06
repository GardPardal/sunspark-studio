# Instruções por Provedor de Hospedagem

## 🎯 Escolha seu provedor

### ☁️ **Vercel** (Recomendado - Fácil)

1. Crie conta em https://vercel.com
2. Conecte seu repositório Git
3. Vercel detecta automaticamente TanStack Start
4. Configure variáveis de ambiente:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy automático ao fazer push!

**Custo:** Gratuito para projetos pequenos

---

### ☁️ **Cloudflare Pages + Workers** (Recomendado - Muito Rápido)

1. Crie conta em https://cloudflare.com
2. `npm i -g wrangler`
3. `wrangler login`
4. `bun run deploy` (ou `npm run deploy`)
5. Configure variáveis no painel

**Custo:** Gratuito com plano básico

---

### ☁️ **Netlify** (Fácil)

1. Crie conta em https://netlify.com
2. Conecte repositório Git
3. Configure build command: `bun run build`
4. Configure variáveis
5. Deploy!

**Custo:** Gratuito para projetos pequenos

---

### 🖥️ **Node.js Hosting (Heroku, Railway, Render)**

#### Railway.app (Recomendado)
1. Crie conta em https://railway.app
2. Conecte repositório
3. Railway detecta Node.js automaticamente
4. Configure variáveis de ambiente
5. Deploy!

#### Render.com
1. https://render.com
2. Novo "Web Service"
3. Conecte repositório
4. Build command: `npm install && npm run build`
5. Start command: `node dist/server/index.js`

---

### 🏠 **Hospedagem Tradicional com cPanel/Plesk**

#### Se oferece Node.js:
1. Via terminal SSH:
```bash
git clone seu-repo
cd seu-projeto
npm install
npm run build
export SUPABASE_SERVICE_ROLE_KEY="sua-chave"
node dist/server/index.js
```

#### Configure para rodar continuamente:
- Use PM2: `npm install -g pm2` e `pm2 start dist/server/index.js`
- Ou configure no painel (Node.js app runner)

---

### 🔗 **Hospedagem Estática (NÃO funciona)**

⚠️ **Não use para este projeto:**
- GitHub Pages
- Netlify Drop (sem Git)
- Surge.sh
- Apenas arquivos estáticos

**Motivo:** Este projeto precisa de um servidor Node.js para SSR (Server-Side Rendering)

---

## 📝 Passos Gerais para Qualquer Hospedagem

1. **Build localmente:**
```bash
bun run build
# ou
npm run build
```

2. **Teste localmente:**
```bash
bun run preview
# ou
npm run preview
```

3. **Copie `dist/` para o servidor**

4. **Configure variáveis de ambiente:**
```
SUPABASE_URL=https://dwwospznutfbxcbbcqfa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxx
NODE_ENV=production
```

5. **Inicie o servidor:**
```bash
node dist/server/index.js
```

---

## 🔐 Variáveis Necessárias

| Variável | Onde Usar | Obtenção |
|----------|-----------|----------|
| `SUPABASE_URL` | Servidor | console.supabase.com → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Apenas Servidor** | console.supabase.com → Settings → API → Service Role (secret) |
| `VITE_SUPABASE_URL` | Cliente (já em .env) | Mesma que acima |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Cliente (já em .env) | console.supabase.com → Settings → API → Anon Key |

---

## ✅ Verificação Após Deploy

1. Acesse sua URL no navegador
2. Verifique se as imagens carregam
3. Teste login (se houver sistema de auth)
4. Verifique console do navegador (F12) para erros
5. Verifique logs do servidor para erros de backend

---

## 📞 Suporte

- **TanStack Start:** https://tanstack.com/start/latest/docs/overview
- **Supabase:** https://supabase.com/docs
- **Seu provedor:** Procure a seção "Deploy Node.js"

---

**Dúvida?** Veja qual é o seu provedor e siga as instruções específicas acima! ⬆️
