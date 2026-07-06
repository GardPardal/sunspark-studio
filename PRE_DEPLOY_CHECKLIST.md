# ✅ PRÉ-DEPLOY CHECKLIST

Antes de subir seu site para produção, verifique tudo isto:

## 📦 Compilação

- [ ] Node.js/Bun instalado
- [ ] `bun install` ou `npm install` executado
- [ ] `bun run build` ou `npm run build` executado sem erros
- [ ] Pasta `dist/` criada com arquivos
- [ ] Testou localmente com `bun run preview`

## 🔐 Segurança

- [ ] `.env` **NÃO** commitado no Git (verificar `.gitignore`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` obtida do console Supabase
- [ ] Chave privada **NÃO** está em nenhum arquivo
- [ ] Variável privada será configurada **apenas no servidor**
- [ ] `.env.example` criado sem valores sensíveis

## 🌐 Configuração

- [ ] URL Supabase verificada: `https://dwwospznutfbxcbbcqfa.supabase.co`
- [ ] Projeto ID verificado: `dwwospznutfbxcbbcqfa`
- [ ] Chave pública (VITE_*) está em `.env`
- [ ] Chave privada será adicionada apenas no servidor

## 🚀 Hospedagem

- [ ] Escolheu provedor (Vercel, Cloudflare, Railway, etc)
- [ ] Criou conta e conectou repositório (se git-based)
- [ ] Configurou variáveis de ambiente no painel
- [ ] Testou deploy ou upload

## 🔍 Testes em Produção

- [ ] Acessou o site via navegador
- [ ] Imagens e assets carregam
- [ ] Não há erros no console do navegador (F12)
- [ ] Não há erros nos logs do servidor
- [ ] Funcionalidades principais funcionam

## 📋 Conteúdo

- [ ] Imagens em `public/` parecem corretas
- [ ] Links não estão quebrados
- [ ] Título e descrição do site estão corretos
- [ ] Favicon exibido corretamente

## 📱 Responsividade

- [ ] Site funciona no desktop
- [ ] Site funciona no mobile (testar em F12)
- [ ] Botões clicáveis em mobile
- [ ] Texto legível em mobile

## 🔄 Atualizações Futuras

- [ ] Documentação do deploy guardada
- [ ] Processo de deploy documentado para próximas vezes
- [ ] Variáveis sensíveis nunca serão commitadas
- [ ] Logs/backups da hospedagem habilitados

---

## 🎯 Se tudo passar ✅

**Parabéns! Seu site está pronto e funcionando em produção!**

---

## ⚠️ Problemas? Consulte:

1. [DEPLOY_QUICK.md](./DEPLOY_QUICK.md) - Guia rápido
2. [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Guia completo  
3. [HOSTING_GUIDE.md](./HOSTING_GUIDE.md) - Instruções por provedor
4. Documentação oficial:
   - [TanStack Start](https://tanstack.com/start)
   - [Supabase](https://supabase.com/docs)
   - Seu provedor de hospedagem

---

**Data de checagem:** _______________
**Responsável:** _______________
**Provedor usado:** _______________
**URL final:** _______________

