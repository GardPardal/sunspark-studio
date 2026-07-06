# 🚀 DEPLOY - Guia Rápido

## ⚡ 3 Passos Rápidos

### 1️⃣ **Executar o Build**

**Windows:**
```bash
# Duplo clique em: build.bat
# OU execute no PowerShell/CMD:
.\build.bat
```

**Linux/Mac:**
```bash
chmod +x build.sh
./build.sh
```

**Ou manualmente:**
```bash
# Instalar (faz uma vez)
bun install          # ou: npm install

# Compilar (sempre que atualizar)
bun run build        # ou: npm run build
```

### 2️⃣ **Obter Chave Supabase**

1. Acesse: https://console.supabase.com
2. Vá em **Settings** → **API**
3. Copie a chave que começa com `sb_secret_`
4. Adicione no seu servidor como variável de ambiente: `SUPABASE_SERVICE_ROLE_KEY`

### 3️⃣ **Fazer Upload**

Copie a pasta `dist/` para seu servidor via:
- FTP/SFTP
- Git (se seu servidor suporta)
- Painel de controle da hospedagem

---

## 📋 Checklist Rápido

- [ ] `bun install` ou `npm install` ✅
- [ ] `bun run build` ou `npm run build` ✅
- [ ] Pasta `dist/` foi criada ✅
- [ ] Chave `SUPABASE_SERVICE_ROLE_KEY` obtida ✅
- [ ] Arquivos enviados para servidor ✅
- [ ] Variável de ambiente configurada no servidor ✅

---

## 🆘 Problemas Comuns

| Problema | Solução |
|----------|---------|
| "bun/npm não encontrado" | Instale Node.js (https://nodejs.org) |
| Pasta `dist/` não criada | Verifique se há erros na compilação |
| Erro 500 em produção | Adicione `SUPABASE_SERVICE_ROLE_KEY` |
| Site em branco | Verifique logs do servidor / reinicie |

---

## 📚 Documentação Completa

Veja [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) para mais detalhes e opções de hospedagem.

---

## 🎯 Seu Site

- **URL Supabase:** https://dwwospznutfbxcbbcqfa.supabase.co
- **Projeto ID:** dwwospznutfbxcbbcqfa
- **Framework:** TanStack Start (React SSR)
- **Database:** Supabase PostgreSQL

---

**Pronto! Seu site está compilado e pronto para subir! 🎉**
