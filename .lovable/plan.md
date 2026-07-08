## Escopo

Sistema completo de gestão de acesso + distribuição de leads por roleta + bot de cobrança de cadência.

## 1. Cadastro & aprovação de conta

**Fluxo:**
1. Novo usuário se registra em `/auth` (nome, email, senha, **unidade**: Londrina / Ponta Grossa / Wenceslau Braz).
2. Conta fica com status `pending_approval` — não consegue logar.
3. Email automático para `alison.amaral@lz7energia.com.br` com:
   - Nome, email, unidade solicitada
   - Botões **Aprovar** / **Reprovar** (links com token único, 48h de validade, sem exigir login).
4. Ao clicar, abre `/aprovar-usuario?token=xxx` mostrando dados + confirmação. Aprovando: usuário vira `active` + define role `consultor` (padrão) e recebe email "conta liberada". Reprovando: usuário deletado, recebe email de recusa.

**Tabelas novas:**
- `account_approvals` (user_id, token, expires_at, status, requested_unit, decided_at, decided_by)
- Adicionar `unit` (enum: `londrina|ponta_grossa|wenceslau_braz`) e `status` (`pending|active|rejected`) em `profiles`.

## 2. Recuperação de senha

- Botão "Esqueci minha senha" em `/auth` → gera token → email com link `/redefinir-senha?token=xxx` (24h).
- Usa `supabase.auth.resetPasswordForEmail` com template customizado (email domain via Lovable).

## 3. Painel Master (Alison) — gerenciar usuários

Na página `/admin` (aba Usuários — só master vê):
- Lista todos os usuários com: nome, email, unidade, role, status, último login.
- Botões por linha:
  - **Trocar senha** (input + confirmar) — master não precisa aprovação, altera direto via `supabaseAdmin.auth.admin.updateUserById`.
  - **Alterar unidade** / **Alterar role**.
  - **Aprovar/Reprovar** pendentes (também dá pra fazer aqui, além do email).
  - **Desativar**.
- **Aviso**: senhas são hash irreversível — impossível VER a senha. Só trocar.

## 4. Roleta SDR (distribuição de leads)

**Regras:**
- Só leads de **tráfego** (`origem = 'trafego'` ou similar) entram na roleta. Leads offline são atribuídos direto.
- Coluna "Novo" do kanban **fica travada** para consultor — não dá pra arrastar pra "Em atendimento" sem ser dono.
- Coordenador (e master) tem botão **"Girar Roleta"** na coordenação:
  1. Escolhe **unidade** (Londrina / PG / WB).
  2. Escolhe **quantos leads** distribuir dessa fila.
  3. Sistema sorteia N leads mais antigos sem dono da fila e distribui aleatoriamente entre consultores **ativos daquela unidade**, com animação de roleta.
- Coordenador mantém botão de **transferir** manual (já existe).

**Nova server fn:** `spinRoulette({ unit, count })` — trava com `SELECT ... FOR UPDATE SKIP LOCKED`, distribui via random shuffle, registra em `lead_transfers` com motivo "roleta SDR".

## 5. Bot de Cadência (mini-chat no CRM)

- Componente `<CadenceBot />` fixo no canto inferior direito da página `/crm` do consultor.
- Ao abrir: mensagem estilo chat listando:
  - Tarefas de cadência atrasadas (do lead_cadence_tasks vencidas)
  - Tarefas do dia
  - Etapas do funil (breve explicação de cada stage)
  - Regras: "Leads de tráfego são distribuídos por roleta pela coordenação. Você não escolhe, atende quem cai."
- Botão "Marcar como feito" por tarefa atrasada.
- Badge com contador de pendências no ícone.

## 6. Emails

Usar **Lovable Emails** (infra já configurável). Templates React Email:
- `account-approval-request` (para o master)
- `account-approved` / `account-rejected` (para o usuário)
- `password-reset` (custom, sobrescreve default do Supabase via auth hook)

## Detalhes técnicos

- **Migrations** (uma call): adiciona `unit`, `status` em `profiles`; cria `account_approvals`; cria enum `unit_enum`; policies RLS; GRANTs; roles `master` (== admin) e `sdr` já existente como coordenador.
- **Server functions novas** (`src/lib/`):
  - `account-approval.functions.ts` — request, approve, reject via token
  - `admin-users.functions.ts` — expandir com `updateUserPassword`, `updateUserUnit`, `setUserStatus`
  - `roulette.functions.ts` — `spinRoulette`, `listConsultantsByUnit`
  - `cadence-bot.functions.ts` — `getMyCadenceTasks`, `completeTask`
- **Rotas novas:**
  - `/aprovar-usuario` (pública, token)
  - `/redefinir-senha` (pública, token) — já existe? senão criar
  - Ampliar `/admin` com aba **Usuários**
- **Email infra:** setup_email_infra + scaffold_transactional_email na primeira execução, se ainda não configurado (a conferir status do domínio).

## Ordem de execução

1. Migration (schema + policies).
2. Setup email domain / infra (se não estiver).
3. Server functions + rotas.
4. UI: aba Usuários no admin, roleta na coordenação, bot no CRM, telas públicas.
5. Verificação: build + testes das rotas críticas.

## Fora do escopo desta rodada

- Notificações push mobile.
- Auditoria completa de logins (só último_login).
- Editar cadência via UI (já existe estrutura, mantém como está).

Confirma que posso implementar tudo assim? Responda "sim" ou aponte ajustes.