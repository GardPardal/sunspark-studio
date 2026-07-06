# 📘 Sobre Sua Hospedagem cPanel

> Você tem hospedagem cPanel padrão. Aqui está tudo que precisa saber.

---

## O que é cPanel?

```
cPanel é um painel de controle para hospedagem compartilhada.

Ele permite você:
✅ Gerenciar arquivos (File Manager)
✅ Criar bases de dados MySQL
✅ Configurar e-mail
✅ Gerenciar subdomínios
✅ Ver estatísticas do site
✅ Instalar aplicações (WordPress, etc)

Mas: ❌ Não suporta Node.js por padrão
```

---

## Softwares Disponíveis em cPanel

```
Na seção "Softaculous" você encontra:

✅ WordPress           (Blog/CMS)
✅ Drupal             (CMS poderoso)
✅ Joomla             (Portal)
✅ Magento            (E-commerce)
✅ PrestaShop         (E-commerce)
✅ Moodle             (Educação)
✅ Mediawiki          (Wiki)
✅ Nextcloud          (Cloud storage)
✅ Opencart           (E-commerce)
✅ PHPBB              (Forum)

❌ Node.js            (Não suporta)
❌ Python/Flask       (Não suporta)
❌ Ruby on Rails      (Não suporta)
```

---

## Seu Site é Node.js

```
Seu site usa:
- React (Frontend)
- TanStack Start (Framework)
- Node.js (Backend)
- Supabase (Database)

Isso funciona em: ✅ Servidores Node.js
Isso funciona em: ❌ cPanel padrão (que você tem)
```

---

## Comparação: cPanel vs Alternativas

| Feature | cPanel | Vercel | GoDaddy VPS |
|---------|--------|--------|------------|
| **Node.js** | ❌ | ✅ | ✅ |
| **Preço** | Incluído | $0-200/mês | +$20-50/mês |
| **Facilidade** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Controle** | Limitado | Limitado | Total |
| **Deploy** | FTP/SSH | Automático | Manual |
| **Suporte** | Bom | Excelente | Bom |
| **Performance** | Médio | Excelente | Muito Bom |
| **Escalabilidade** | Limitada | Ilimitada | Muito Bom |

---

## 3 Soluções para Você

### 1️⃣ Usar Vercel (Recomendado)

```
Como funciona:

1. Você acessa Vercel.com
2. Conecta seu repositório GitHub
3. Vercel faz build e deploy automático
4. Seu domínio GoDaddy aponta para Vercel
5. cPanel continua gerenciando outros serviços

Resultado:
- Site Node.js roda em Vercel ✅
- cPanel gerencia e-mail/DNS ✅
- Você não precisa Node.js em cPanel ✅

Custo:
- Vercel: $0-20/mês
- cPanel: Seu plano atual (sem mudança)
```

### 2️⃣ Fazer Upgrade cPanel para Node.js

```
Como funciona:

1. Você liga para GoDaddy
2. Pede: "Node.js hosting"
3. GoDaddy faz upgrade (2-24 horas)
4. Você recebe SSH access
5. Você faz upload do seu site
6. Tudo roda em cPanel agora

Resultado:
- Site Node.js roda em cPanel ✅
- Integrado com domínio ✅
- Mais controle ✅

Custo:
- GoDaddy com Node.js: +$5-50/mês
```

### 3️⃣ Refazer em WordPress

```
Como funciona:

1. Você acessa seu cPanel
2. Procura "Softaculous"
3. Clica em WordPress
4. Click "Install"
5. Escolhe seu domínio
6. WordPress instala automaticamente

Resultado:
- Site WordPress roda em cPanel ✅
- Funciona 100% compatível ✅
- Mas: precisa redesenhar site

Custo:
- $0 (seu cPanel suporta)
- Tema profissional: $10-50 (opcional)
```

---

## Arquivos Disponíveis

```
Leia estes para mais informações:

1. CPANEL_OPCOES.md
   └─ Detalhes de cada opção

2. GODADDY_DEPLOYMENT.md
   └─ Guia passo a passo por opção

3. QUICK_SETUP.md
   └─ Resumo ultra-rápido

4. HOSTING_GUIDE.md
   └─ Alternativas: Vercel, Railway, Render
```

---

## ❓ Perguntas Frequentes

### P: Posso instalar Node.js em cPanel?
**R:** Depende do seu plano:
- Plano padrão (seu caso): ❌ Não
- cPanel com Node.js: ✅ Sim
- VPS/Dedicated: ✅ Sim

### P: Quanto custa upgrade?
**R:** +$5 a +$50/mês (depende do plano)

### P: Vercel é confiável?
**R:** Sim! Usado por milhões de sites profissionais

### P: Preciso mudar domínio?
**R:** Não! Seu domínio continua o mesmo

### P: Vou perder dados?
**R:** Não! Tudo migra automaticamente

### P: Qual é mais fácil?
**R:** Vercel (Opção 1) é mais fácil

### P: Qual é mais barata?
**R:** Vercel (Opção 1) é mais barata ($0 para começar)

### P: Qual recomenda?
**R:** Vercel (Opção 1) para começar. Depois, se quiser, muda para Opção 2.

---

## 🎯 Próximos Passos

### Passo 1: Escolha Sua Opção

**Rápido + Barato + Fácil?**
👉 Opção 1: Vercel

**Tudo integrado em cPanel?**
👉 Opção 2: Upgrade GoDaddy

**Compatível 100% com cPanel?**
👉 Opção 3: WordPress

### Passo 2: Leia Guia Específico

[CPANEL_OPCOES.md](./CPANEL_OPCOES.md)

### Passo 3: Comece!

[GODADDY_DEPLOYMENT.md](./GODADDY_DEPLOYMENT.md)

---

## 📚 Recursos Adicionais

- [cPanel Documentation](https://documentation.cpanel.net)
- [Vercel Docs](https://vercel.com/docs)
- [GoDaddy Support](https://www.godaddy.com/support)
- [Node.js Info](https://nodejs.org)

---

**Qual opção você escolhe?** 👇

1. [Vercel (Recomendado)](./GODADDY_DEPLOYMENT.md#opção-2)
2. [GoDaddy Node.js](./GODADDY_DEPLOYMENT.md#opção-1)
3. [WordPress](./GODADDY_DEPLOYMENT.md#opção-3)

**Clique em sua escolha!** ➜
