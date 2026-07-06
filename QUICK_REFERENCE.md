# 🎯 QUICK REFERENCE - Cartão de Referência Rápida

> Cole isso na sua parede ou guarde no celular! 📌

---

## 🚀 OS 5 PASSOS PRINCIPAIS

```
1. COMPILAR
   → ./build.bat (Windows) ou ./build.sh (Linux)
   → Resultado: pasta dist/ pronta ✅

2. BANCO DE DADOS
   → Supabase console → SQL Editor
   → Executar SQL de GODADDY_DEPLOYMENT.md ✅

3. UPLOAD
   → GoDaddy painel → Gerenciador de Arquivos
   → Copiar dist/ para raiz ✅

4. VARIÁVEIS
   → GoDaddy → Variáveis de Ambiente
   → SUPABASE_SERVICE_ROLE_KEY (obter do Supabase) ✅

5. INICIAR
   → GoDaddy → Node.js App
   → Start Command: node dist/server/index.js ✅

PRONTO! 🎉
```

---

## 📍 URLs IMPORTANTES

| O Que | URL |
|------|-----|
| 🌐 **Seu Site** | seu-dominio.com |
| 🔐 **Login** | seu-dominio.com/auth |
| 📝 **Admin** | seu-dominio.com/admin |
| 📊 **Supabase** | console.supabase.com |
| 🏠 **GoDaddy** | godaddy.com |

---

## 🔑 VARIÁVEIS DE AMBIENTE

```
SUPABASE_URL = https://seu-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY = sb_secret_xxxxx
SUPABASE_PROJECT_ID = seu-id
NODE_ENV = production
```

**Onde adicionar:** GoDaddy Painel → Variáveis de Ambiente

---

## 📚 ARQUIVOS PRINCIPAIS

| Arquivo | Para Quem | Tempo |
|---------|-----------|-------|
| SEU_SITE_ESTA_PRONTO.md | Todos | 5 min |
| GODADDY_DEPLOYMENT.md | Dev | 30 min |
| AUTENTICACAO_E_ADMIN.md | Admin | 10 min |
| RESPONSIVENESS.md | Dev | 10 min |
| build.bat/.sh | Dev | 5 min |

---

## 🔄 EDITAR CONTEÚDO

```
1. Acesse: seu-dominio.com/admin
2. Faça Login: seu@email.com + senha
3. Escolha Seção: Menu esquerdo
4. Edite Campos: Digite novo conteúdo
5. Salve: Clique "Salvar Mudanças"
6. Pronto! Site atualiza em segundos ✅
```

---

## 📱 RESPONSIVIDADE TESTADA

```
✅ iPhone (320px+)
✅ iPad (768px+)
✅ Desktop (1024px+)

Teste em seu navegador:
→ F12 → Modo Responsivo → Teste tamanhos
```

---

## 🆘 PROBLEMAS COMUNS

| Problema | Solução |
|----------|---------|
| Site não carrega | Verificar painel GoDaddy, Node.js ativo? |
| Erro 500 | Ver logs, verificar SUPABASE_SERVICE_ROLE_KEY |
| Painel vazio | Limpar cache (Ctrl+Shift+Del) |
| Edições não salvam | Confirmar que está logado |

---

## 🔐 LOGIN PADRÃO

```
Email: seu@email.com
Senha: criada no Supabase
```

Criar novo em: [console.supabase.com](https://console.supabase.com)

---

## 📊 BANCO DE DADOS

```
Tabelas criadas:
├─ editable_content (textos do site)
├─ leads (formulários)
└─ site_settings (configurações)
```

---

## 💾 FAZER BACKUP

```sql
-- Backup de leads
SELECT * FROM leads ORDER BY created_at DESC;

-- Backup de conteúdo
SELECT * FROM editable_content;
```

Exportar como CSV no painel admin!

---

## 🚨 EMERGÊNCIA

```
Site completamente quebrado?
1. Acesse SSH do GoDaddy
2. Ver logs: tail -f logs/app.log
3. Reiniciar: restart app
4. Se não funcionar: restaurar backup da dist/

Ainda quebrado?
→ Contate suporte GoDaddy
```

---

## 📞 CHECKLISTS RÁPIDOS

### Antes de Fazer Upload
- [ ] npm run build executado
- [ ] dist/ existe e tem arquivos
- [ ] .env tem variáveis corretas
- [ ] GoDaddy tem Node.js ativado

### Antes de Lançar
- [ ] Site carrega normalmente
- [ ] Painel admin funciona
- [ ] Mobile responsivo
- [ ] Formulário captura leads

### Mantendo Vivo
- [ ] Backup dados 1x por mês
- [ ] Monitorar painel admin
- [ ] Testar links/formulários
- [ ] Limpar cache às vezes

---

## 🎯 ESTRUTURA DE PASTAS

```
seu-site/
├── dist/                 ← Upload isto para GoDaddy!
│   ├── client/
│   ├── server/
│   └── public/
├── src/
│   ├── routes/
│   │   ├── index.tsx     ← Home
│   │   └── _authenticated/admin.tsx ← Admin
│   ├── lib/
│   │   └── editable-content.ts ← Sistema edição
│   └── components/       ← UI Components
└── package.json          ← Dependências
```

---

## 🌟 SUPER DICAS

1. **Editar é Rápido:** Use painel admin em vez de recompilar
2. **Testar Mobile:** F12 no navegador, modo responsivo
3. **Backup Leads:** Exporte CSV regularmente
4. **Senha Forte:** Use caracteres especiais
5. **Domínio:** Use SSL/HTTPS (GoDaddy automático)

---

## 📋 ORDEM CORRETA

```
1º → Ler: SEU_SITE_ESTA_PRONTO.md
2º → Compilar: ./build.bat
3º → Banco: Executar SQL Supabase
4º → Upload: Copiar dist/ GoDaddy
5º → Variáveis: Adicionar no painel GoDaddy
6º → Iniciar: Clique "Start Application"
7º → Testar: Acessar seu-dominio.com
8º → Admin: Fazer login e editar
9º → Lançar! 🚀
```

---

## 🎓 RECURSOS RÁPIDOS

```
Supabase    → https://supabase.com/docs
TanStack    → https://tanstack.com/start
Tailwind    → https://tailwindcss.com/docs
GoDaddy     → https://godaddy.com/help
Node.js     → https://nodejs.org/docs
```

---

## ✨ VOCÊ TEM

✅ Backend pronto
✅ Frontend bonito
✅ Painel de admin
✅ Database pronto
✅ Responsividade
✅ Segurança
✅ Documentação completa

**FALTA APENAS:** Fazer upload! 📤

---

## 🎉 ÚLTIMA DICA

> "O melhor código é o que você não precisa escrever."

Este projeto foi feito para que você:
- ✨ **Nunca toque em código** para editar conteúdo
- 🎯 **Edite tudo pelo painel** de forma visual
- 📱 **Se adapte a qualquer tela** automaticamente
- 🔒 **Durma tranquilo** com segurança total

---

**Imprime isto e cola na parede! 📌**

**Próximo passo:** Abra [SEU_SITE_ESTA_PRONTO.md](./SEU_SITE_ESTA_PRONTO.md)

🚀 **Boa sorte, você vai arrasar!**
