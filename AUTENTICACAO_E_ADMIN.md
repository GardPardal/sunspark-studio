# 🔐 Autenticação & Acesso ao Painel de Admin

> Como criar usuários, fazer login e gerenciar acesso ao painel

---

## 👤 Criar Usuário Admin

### Via Supabase Console

1. Acesse [console.supabase.com](https://console.supabase.com)
2. Vá em **Authentication** → **Users**
3. Clique em **Add user**
4. Preencha:
   - **Email:** seu@email.com
   - **Password:** Senha forte (mínimo 8 caracteres)
5. Clique em **Create user**

### Usuário é Criado Automaticamente

Após criar, você pode:
1. Ir para `seu-dominio.com/auth`
2. Clicar em "Registre-se"
3. Usar o mesmo email e senha

---

## 🔑 Fazer Login

### Acessar o Painel

1. Acesse: `seu-dominio.com/auth`
2. Você pode:
   - **Se já tem conta:** Clique "Já tem uma conta?"
   - **Se é novo:** Clique "Criar uma"
3. Preencha email e senha
4. Clique em "Continuar"

### Após Login

Você será redirecionado para `/admin` automaticamente ✅

---

## 📝 Painel de Admin

### Layout

```
┌─────────────────────────────────────┐
│  LZ7 Energia · Painel Admin    Ver Site │
├──────────────────────────────────────┤
│ Tabs: │ 📝 Conteúdo │ ⚙️ Configs │ 📊 Leads │ ❓ Ajuda │
├──────────────────────────────────────┤
│ Lado Esquerdo │       Editor Central    │
│ - 🎯 Hero    │ Seção escolhida        │
│ - ⭐ Difers. │ Campos para editar      │
│ - 🏢 Segm.  │ Preview em tempo real   │
│ - 📈 Stats  │ Botão SALVAR            │
│ - 📋 Proc.  │                         │
│ - ❓ FAQ    │                         │
│ - 📞 Contato│                         │
└──────────────────────────────────────┘
```

### Funcionalidades

#### 1. Aba "Conteúdo"

**Editor de Hero:**
- Editar título principal
- Editar subtítulo
- Preview em tempo real
- Salvar mudanças

**Outros Editores** (em desenvolvimento):
- Diferenciais
- Segmentos
- Estatísticas
- Processo
- FAQ
- Contatos

#### 2. Aba "Configurações"

- Telefone/WhatsApp
- Email
- Links de redes sociais
- Vídeo do YouTube

#### 3. Aba "Leads"

- Ver todos os leads capturados
- Buscar por nome/telefone
- Exportar para CSV
- Ver data e hora de preenchimento

#### 4. Aba "Ajuda"

- Dúvidas frequentes
- Como usar o painel
- Troubleshooting

---

## 🔄 Fluxo de Edição

### Como Editar Conteúdo

1. **Acesse o painel:** `seu-dominio.com/admin`
2. **Escolha seção:** Clique no menu esquerdo
3. **Edite o campo:** Digite novas informações
4. **Veja preview:** Campo "Preview" mostra resultado
5. **Salve:** Clique em "Salvar Mudanças"
6. **Confirme:** Toast verde aparece
7. **Verifique site:** Atualize seu site para confirmar

### Exemplo Prático

```
Quer mudar o título do hero?
1. Clique em "🎯 Hero" no menu
2. Campo "Título Principal" aparece
3. Delete o texto antigo
4. Digite novo texto
5. Veja no "Preview"
6. Clique "Salvar Mudanças"
7. Pronto! ✅
```

---

## 🛡️ Segurança & Permissões

### Row Level Security (RLS)

Seu banco de dados usa **RLS**, o que significa:

✅ Apenas usuários autenticados podem acessar
✅ Apenas admins podem editar
✅ Leads são visíveis apenas para admins
✅ Configurações protegidas

### Verificar Permissões

No Supabase console:

1. Vá em **Authentication** → **Users**
2. Veja todos os usuários criados
3. Pode deletar ou resetar senha de usuário

---

## 🔄 Resetar Senha

### Se Esquecer Senha

1. Acesse `seu-dominio.com/auth`
2. Clique em "Esqueceu a senha?"
3. Digite seu email
4. Clique em "Enviar link"
5. Verifique seu email
6. Clique no link recebido
7. Digite nova senha
8. Faça login

### Resetar via Supabase

Se o email não funcionar:

1. Acesse [console.supabase.com](https://console.supabase.com)
2. Vá em **Authentication** → **Users**
3. Procure seu usuário
4. Clique em **...** → **Reset Password**
5. Supabase envia email

---

## 👥 Múltiplos Usuários

### Adicionar Outro Admin

1. Vá para [console.supabase.com](https://console.supabase.com)
2. **Authentication** → **Users** → **Add user**
3. Preencha email e senha
4. Novo usuário pode fazer login em `seu-dominio.com/auth`

### Diferentes Permissões

Por padrão, **todos os usuários têm as mesmas permissões**.

Para limitar permissões por usuário (avançado):
- Use `user_roles` table no Supabase
- Configure RLS policies
- Consulte documentação Supabase

---

## 🚪 Logout

### Sair do Painel

1. No canto superior direito
2. Clique em **"Sair"** 🚪
3. Você retorna para `seu-dominio.com`

### Sessão Expira Automaticamente

- Session dura 24 horas por padrão
- Após expirar, você precisa fazer login novamente
- Pode alterar em Supabase se quiser

---

## 🐛 Troubleshooting Auth

### "Erro ao fazer login"

1. Confirme que tem conta criada no Supabase
2. Verifique se email está correto
3. Confirme se password está correto
4. Tente resetar senha

### "Página em branco no /admin"

1. Confirme que fez login
2. Verifique se tem cookie de sessão (browser)
3. Tente fazer logout e login novamente
4. Limpe cache (Ctrl+Shift+Del)

### "Email não recebe reset link"

1. Verifique pasta de spam
2. Confirme que email está correto
3. Tente resetar via Supabase console
4. Aguarde 1-5 minutos

---

## 🔌 API de Autenticação

### Endpoints

| Endpoint | Método | O Que Faz |
|----------|--------|----------|
| `/auth` | GET | Página de login |
| `/auth` | POST | Fazer login |
| `/auth/logout` | POST | Fazer logout |
| `/admin` | GET | Painel (protegido) |

### Autenticação é Automática

Você não precisa fazer nada especial. O sistema:
1. Verifica se você está logado
2. Se não: Redireciona para `/auth`
3. Se sim: Libera acesso a `/admin`

---

## 📱 Acesso via Mobile

### Usar Painel em Celular

1. Acesse: `seu-dominio.com/admin` no celular
2. Painel é **responsivo** e funciona bem
3. Toque nos campos para editar
4. Clique "Salvar Mudanças"

### Limitações Mobile

- Tela menor, mas ainda usável
- Recomendado usar em landscape
- Melhor em tablet para edição longa

---

## 🔐 Boas Práticas de Segurança

1. ✅ **Senha Forte:** Mínimo 8 caracteres, com números/símbolos
2. ✅ **Não Compartilhar:** Não compartilhe email/senha
3. ✅ **Logout Sempre:** Saia ao terminar edição
4. ✅ **Backup Regular:** Exporte dados regularmente
5. ✅ **Atualizar Senha:** Mude senha a cada 3 meses
6. ✅ **Verificar Logs:** Veja quem acessou o painel

---

## 📊 Gerenciar Usuários

### No Supabase Console

```sql
-- Ver todos os usuários
SELECT id, email, created_at FROM auth.users;

-- Ver último login
SELECT email, last_sign_in_at FROM auth.users;
```

### Ações Possíveis

1. **Criar novo:** Add user → preencha → Create
2. **Resetar senha:** Clique em ... → Reset Password
3. **Deletar:** Clique em ... → Delete user
4. **Desativar:** Não há opção, delete se necessário

---

## 🎯 Próximas Etapas

1. ✅ Criar sua conta no Supabase
2. ✅ Fazer deploy no GoDaddy
3. ✅ Acessar `/auth` e fazer login
4. ✅ Ir para `/admin` e editar
5. ✅ Testar edições no site

---

## 📞 Suporte

- **Esqueceu senha?** Clique em "Esqueceu a senha?" no `/auth`
- **Erro ao logar?** Verifique email/senha
- **Problema no painel?** Veja aba "Ajuda" no admin
- **Dúvida Supabase?** Acesse docs.supabase.com

---

## ✨ Você Está Pronto!

Agora você pode:

✅ Fazer login no painel
✅ Editar conteúdo do site
✅ Gerenciar leads
✅ Alterar configurações
✅ Controlar acesso de outros usuários

**Parabéns! Seu site é totalmente gerenciável!** 🎉
