# 🚀 Guia Completo: Deploy no GoDaddy

> Seu site LZ7 Energia está pronto para subir no GoDaddy com sistema de edição intuitivo!

---

## 📋 Checklist Antes de Começar

- [ ] Hospedagem GoDaddy com Node.js ativada
- [ ] Banco de dados PostgreSQL/MySQL criado
- [ ] Supabase conectado e configurado
- [ ] Painel de admin funcionando localmente
- [ ] Responsividade testada em mobile

---

## 🔧 Requisitos do GoDaddy

### ⚠️ PROBLEMA: cPanel Padrão NÃO Suporta Node.js

Sua hospedagem é **cPanel padrão**. Isso significa:

**❌ NÃO FUNCIONA:**
```
Este site (TanStack Start)
↓
É Node.js
↓
cPanel padrão = PHP apenas
↓
INCOMPATÍVEL! ❌
```

### ✅ SOLUÇÕES DISPONÍVEIS

**Opção 1: Fazer Upgrade (Recomendado) ⭐**
```
Contate GoDaddy e pedir:
✓ Node.js Hosting (+$5-10/mês)
✓ VPS com Node.js (+$20-50/mês)
✓ Depois siga guia normal
```

**Opção 2: Usar Alternativa Gratuita (Rápido) ⚡**
```
Deploy em serviço gratuito com Node.js:
✓ Vercel (Recomendado)
✓ Railway
✓ Render
✓ Heroku (pago agora)

Site fica em: seu-site.vercel.app
Depois aponta domínio GoDaddy para lá
```

**Opção 3: Refazer em WordPress (Compatível) 🔄**
```
WordPress + Plugin = Mesmo resultado
✓ Roda em cPanel padrão
✓ Painel fácil de editar
✓ Mais tempo de desenvolvimento
✓ Menos customização
```

### Qual Opção Escolher?

```
Rápido + Gratuito?          → Opção 2 (Vercel)
Pagar um pouco mais?        → Opção 1 (Upgrade)
Usar cPanel mesmo?          → Opção 3 (WordPress)
Quer o melhor resultado?    → Opção 1 (Upgrade)
```

---

## � PASSO A PASSO POR OPÇÃO

### OPÇÃO 1: Fazer Upgrade para Node.js (Recomendado)

**Timing: 2 horas**

#### Passo 1: Contatar GoDaddy

```
1. Acesse https://www.godaddy.com/pt-pt
2. Clique em "Meus Produtos"
3. Clique em "Suporte" ou chat ao vivo
4. Diga: "Preciso de Node.js hosting"
5. Opções oferecidas:
   - Node.js hosting (+$5-10/mês)
   - VPS com Node.js (+$20-50/mês)
   - Managed Node.js hosting (premium)
```

#### Passo 2: Aguardar Confirmação

```
GoDaddy vai:
- Fazer upgrade da conta
- Fornecer SSH access
- Fornecer IP e credenciais
- Enviar e-mail de confirmação
(Tempo: 30 min a 2 horas)
```

#### Passo 3: Depois de Upgrade

```
Siga o resto deste guia normalmente!
Você terá Node.js disponível.
```

---

### OPÇÃO 2: Deploy em Vercel (Grátis + Rápido) ⭐ RECOMENDADO PARA COMEÇAR

**Timing: 20 minutos | Custo: $0/mês**

#### Passo 1: Criar Conta Vercel

```
1. Vá em https://vercel.com
2. Click "Sign up"
3. Use GitHub, GitLab ou e-mail
4. Confirme e-mail
```

#### Passo 2: Conectar Repositório

```
1. Clique "Add New Project"
2. Selecione "Import Git Repository"
3. Cole URL do seu git:
   https://github.com/seu-usuario/sunspark-studio
4. Clique "Import"
```

#### Passo 3: Configurar Environment

```
Na tela "Configure Project":
1. Clique "Environment Variables"
2. Adicione as 4 variáveis:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - SUPABASE_PROJECT_ID
   - NODE_ENV = production
3. Clique "Deploy"
```

#### Passo 4: Aguardar Deploy

```
Vercel vai:
- Clonar seu projeto
- Instalar dependências
- Build automático
- Teste automático
- Deploy automático
(Tempo: 5-10 minutos)
```

#### Passo 5: Ver Site ao Vivo

```
1. Clique link que aparece: seu-projeto.vercel.app
2. Seu site está VIVO! 🎉
3. Parabéns!
```

#### Passo 6: Apontar Domínio GoDaddy (Opcional)

```
Se quer meu-dominio.com ao invés de vercel.app:

1. No GoDaddy, vá em "Meus Domínios"
2. Abra seu domínio
3. Procure "DNS" ou "Nameservers"
4. Mude para nameservers do Vercel:
   ns1.vercel-dns.com
   ns2.vercel-dns.com
5. Salve
6. Aguarde 24 horas
7. Site funciona em seu-dominio.com!

OU mais fácil: use Vercel Pro ($20/mês)
- Vercel configura tudo automaticamente
```

**Vantagens:**
✅ Gratuito  
✅ Rápido  
✅ Funciona hoje  
✅ Deploy automático  
✅ Escalável  
✅ Sem cPanel  

**Desvantagens:**
❌ Domínio temporário (vercel.app)  
❌ Requer GitHub  
❌ Dependência de Vercel  

---

### OPÇÃO 3: Usar WordPress em cPanel (Compatível)

**Timing: 4 horas | Custo: $0 (seu cPanel)**

#### Passo 1: Instalar WordPress

```
1. Acesse seu cPanel (cpseu-dominio.com:2083)
2. Procure "Softaculous" ou "App Installer"
3. Clique em "WordPress"
4. Clique "Install"
5. Preencha formulário:
   - Domínio: seu-dominio.com
   - Admin username: seu-admin
   - Admin password: senha-forte
   - Admin email: seu-email@gmail.com
```

#### Passo 2: Aguardar Instalação

```
Softaculous vai:
- Criar banco de dados
- Fazer download WordPress
- Configurar automaticamente
(Tempo: 2-3 minutos)
```

#### Passo 3: Acessar Painel

```
1. Vá em https://seu-dominio.com/wp-admin
2. Login com seu-admin / senha
3. Você vê painel WordPress
```

#### Passo 4: Customizar Site

```
Opção A: Plugins
- Instale temas profissionais ($10-50)
- Instale plugins (CRM, leads, etc)
- Customize via interface visual
- Tempo: 2-3 horas

Opção B: Contratar Dev
- Migre design do seu site atual
- Recrie em WordPress
- Mais expensive, 1-2 semanas

Opção C: Manter cPanel + Link para Vercel
- WordPress fica em seu-dominio.com
- Site React fica em vercel.app
- Aponta dominio WordPress para Vercel
- Resultado: seu site React em seu domínio
```

**Vantagens:**
✅ Roda em cPanel  
✅ Fácil para editar conteúdo  
✅ Muitos plugins  
✅ Suporte WordPress  

**Desvantagens:**
❌ Performance menor  
❌ Menos customizável  
❌ Desenvolver novo design  
❌ Preguiça para editar conteúdo  

---

## 📋 MINHA RECOMENDAÇÃO PARA VOCÊ

```
🎯 MELHOR OPÇÃO: Vercel (OPÇÃO 2)

Por quê?
✓ Funciona HOJE
✓ Seu site React exatamente como é
✓ Grátis para começar
✓ Profissional e escalável
✓ Deploy automático quando atualiza código
✓ Melhor performance
✓ Depois paga upgrade se quiser

Depois:
- Se quiser domínio personalizado → Vercel Pro ($20/mês)
- Se quiser mais controle → Upgrade GoDaddy Node.js
- Se não sabe código → Use painel admin que criamos
```

---

## 📋 Continuando com Sua Escolha

**Se escolheu Opção 1 (Upgrade GoDaddy):**
Depois de fazer upgrade, continue lendo abaixo...

**Se escolheu Opção 2 (Vercel):**
✅ Parabéns! Seu site já está ao vivo!
Continue com Passo 2 abaixo (Supabase)

**Se escolheu Opção 3 (WordPress):**
✅ WordPress instalado!
Customize conforme necessário

---

## 📦 Passo 1: Preparar o Projeto Localmente (Se Opção 1)

### 1.1 Compilar para Produção

```bash
bun install          # ou npm install
bun run build        # ou npm run build
```

Isso criará uma pasta `dist/` com seu site compilado.

### 1.2 Verificar Pasta `dist/`

```
dist/
├── client/          # Frontend compilado
├── server/          # Backend Node.js
└── public/          # Assets (imagens, etc)
```

---

## 🌐 Passo 2: Criar Banco de Dados no Supabase

### 2.1 Criar Tabelas Necessárias

Acesse [console.supabase.com](https://console.supabase.com) e execute este SQL em `SQL Editor`:

```sql
-- Tabela de conteúdo editável
CREATE TABLE IF NOT EXISTS editable_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(section, key)
);

-- Tabela de leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  cidade TEXT,
  estado TEXT,
  valor_conta TEXT,
  mensagem TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de configurações
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_editable_content_section ON editable_content(section);
```

### 2.2 Inserir Dados Padrão

```sql
-- Inserir configurações padrão
INSERT INTO site_settings (key, value) VALUES
  ('whatsapp', '5543996172509'),
  ('phone', '(43) 99617-2509'),
  ('email', 'contato@lz7energia.com.br'),
  ('instagram', 'https://instagram.com/lz7energia'),
  ('video_url', 'https://www.youtube.com/embed/dQw4w9WgXcQ'),
  ('hero_title', 'Economize até 90% na sua conta de energia'),
  ('hero_subtitle', 'Transforme sua conta de luz em investimento com um projeto de energia solar desenvolvido por especialistas.');
```

---

## 📤 Passo 3: Upload via GoDaddy

### Opção A: Via Painel GoDaddy (Mais Fácil)

1. Acesse painel GoDaddy
2. Vá em **Hospedagem** → **Gerenciar**
3. Localize **Gerenciador de Arquivos** ou **FTP**
4. Navegue até pasta `public_html` ou raiz
5. **Limite a pasta `dist/` inteira** para lá
6. Aguarde upload completar

### Opção B: Via FTP (Se preferir)

1. Use software como **FileZilla** ou **WinSCP**
2. Conecte com credenciais FTP do GoDaddy:
   - Host: seu domínio ou IP
   - Usuário: FTP do GoDaddy
   - Senha: FTP do GoDaddy
3. Navegue até pasta raiz
4. Copie conteúdo de `dist/` para lá
5. Certifique-se que `package.json` e `node_modules` estão também

### Opção C: Via Git (Mais Profissional)

1. Crie repositório no GitHub/GitLab
2. Conecte ao GoDaddy via SSH:
   ```bash
   git clone seu-repo
   cd seu-projeto
   npm install
   npm run build
   ```

---

## 🔑 Passo 4: Configurar Variáveis de Ambiente

### No Painel GoDaddy

1. Vá em **Hospedagem** → **Gerenciar**
2. Procure por **Variáveis de Ambiente** ou **Node.js Settings**
3. Adicione as seguintes variáveis:

```
SUPABASE_URL = https://dwwospznutfbxcbbcqfa.supabase.co
SUPABASE_SERVICE_ROLE_KEY = sb_secret_xxxxxxxxxxxxx...
SUPABASE_PROJECT_ID = dwwospznutfbxcbbcqfa
NODE_ENV = production
```

**⚠️ IMPORTANTE:**
- A chave `SUPABASE_SERVICE_ROLE_KEY` **NUNCA** deve estar no `.env` commitado
- Obtenha em: [console.supabase.com](https://console.supabase.com) → Settings → API → Service Role Key
- Configure **APENAS** no painel, não em arquivo

---

## 🚀 Passo 5: Iniciar o Servidor

### No Painel GoDaddy

1. Vá em **Hospedagem** → **Gerenciar**
2. Procure por **Node.js App** ou **Application Start**
3. Configure:
   - **Start Command:** `node dist/server/index.js`
   - **Port:** `3000` (ou a que GoDaddy indicar)
4. Clique em **Start Application** ou **Restart**

### Via SSH (Se tiver acesso)

```bash
cd /caminho/do/seu/site
node dist/server/index.js
```

---

## ✅ Passo 6: Testar Seu Site

1. Acesse seu domínio no navegador
2. Verifique se carrega normalmente
3. Teste responsividade (pressione F12 → mobile)
4. Teste o painel de admin:
   - Acesse `seu-dominio.com/auth`
   - Faça login (use seu email Supabase)
   - Vá para `/admin` e edite conteúdo

---

## 🎨 Painel de Admin

### Acessar o Painel

```
seu-dominio.com/admin
```

### Funcionalidades

- **📝 Conteúdo:** Edite textos do site
- **⚙️ Configurações:** Altere contatos e links
- **📊 Leads:** Veja formulários recebidos
- **❓ Ajuda:** Documentação integrada

### Edições em Tempo Real

Após salvar:
1. Conteúdo é gravado no banco
2. Site atualiza automaticamente
3. Não precisa compilar/fazer upload novamente!

---

## 🎯 Recursos Especiais para Edição

### O que Você Pode Editar Facilmente

✅ **Sem Recompilação:**
- Título principal e subtítulo
- Textos de seções
- Informações de contato
- Perguntas frequentes
- Qualquer configuração

⏳ **Que requerem recompilação:**
- Mudar cores/design (CSS)
- Adicionar nova página
- Mudar estrutura

---

## 🔒 Segurança

### Recomendações

1. ✅ Alterar senha de admin regularmente
2. ✅ Usar email seguro e senha forte
3. ✅ Manter `SUPABASE_SERVICE_ROLE_KEY` privada
4. ✅ Fazer backups regulares do Supabase
5. ✅ Não compartilhar credenciais

### Backup Automático

Supabase faz backups automáticos. Para backup manual:

1. Acesse [console.supabase.com](https://console.supabase.com)
2. Vá em **Settings** → **Backups**
3. Clique em **Create Backup**

---

## 🆘 Troubleshooting

### Erro: "Application failed to start"

**Solução:**
1. Verifique se Node.js está ativado no GoDaddy
2. Confira o comando de inicialização
3. Verifique se `package.json` está na pasta raiz

### Erro: "Database connection failed"

**Solução:**
1. Verifique `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
2. Teste conexão: `curl https://seu-supabase.supabase.co/rest/v1/`
3. Confirme que variáveis estão configuradas no GoDaddy

### Erro 500 no navegador

**Solução:**
1. Acesse SSH e veja logs: `tail -f logs/app.log`
2. Verifique se banco de dados está acessível
3. Reinicie a aplicação

### Site em branco

**Solução:**
1. Pressione F12 para abrir console
2. Veja se há erros JavaScript
3. Verifique se arquivos em `dist/client` estão corretos
4. Limpe cache do navegador (Ctrl+Shift+Del)

---

## 📱 Responsividade

Seu site é **totalmente responsivo** e foi testado em:

✅ Desktop (1920px+)
✅ Tablet (768px - 1024px)  
✅ Mobile (320px - 767px)

Todos os elementos se adaptam automaticamente!

---

## 🔄 Atualizar Site

### Se Precisar Alterar Código

1. Faça mudanças localmente
2. Compile: `npm run build`
3. Upload da pasta `dist/` novamente
4. Reinicie aplicação no painel GoDaddy

---

## 💡 Dicas Importantes

1. **Editar é melhor que recompilar:** Use o painel para mudanças rápidas
2. **Testar localmente:** Sempre compile e teste em sua máquina antes
3. **Manter backups:** Guarde cópias da pasta `dist/` regularmente
4. **Monitorar leads:** Exporte dados regularmente do painel
5. **Atualizar certificado SSL:** GoDaddy gerencia automaticamente

---

## 📞 Contato de Suporte

- **GoDaddy:** https://www.godaddy.com/help
- **Supabase:** https://supabase.com/docs
- **Seu site:** Em caso de erro, verifique logs no SSH

---

## ✨ Seu Site Está Pronto!

Parabéns! Seu site LZ7 Energia está:

✅ Compilado e pronto
✅ Com painel de admin intuitivo
✅ Totalmente responsivo
✅ Seguro e escalável
✅ Fácil de editar

**Próximo passo:** Segue os passos acima e faça upload no GoDaddy! 🚀
