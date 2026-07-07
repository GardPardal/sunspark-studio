## O que vou construir

### 1. Novo perfil: **Coordenador Comercial**
- Papel `coordenador` no banco (junto de `admin` e `consultor`).
- Acessa **tudo do CRM** (leads brutos, leads de todos os consultores, dashboards individuais por consultor), **mas não edita usuários nem tags**.
- Coordenador é o único (junto do admin) que pode **transferir lead entre consultores**.

### 2. Regra de posse do lead
- Todo lead novo entra na fila **"Leads brutos"** (sem dono) e fica visível para todos os consultores.
- Assim que um consultor **movimenta** o lead (muda de estágio, registra contato, entra em cadência), ele vira **dono** (`assigned_to` = ele) automaticamente.
- Outro consultor **não consegue** editar/movimentar leads que não são dele — a interface bloqueia e o banco também (RLS).
- Coordenador/Admin veem o botão **"Transferir para..."** com a lista de consultores. Toda transferência fica registrada em log (`lead_transfers`: de quem, para quem, quando, motivo).

### 3. Kanban por consultor + Kanban do coordenador
- **Consultor** entra em `/crm` e vê:
  - Aba **"Leads brutos"** (fila comum, botão "Pegar este lead")
  - Aba **"Meus leads"** com Kanban (Novo → Em atendimento → Não atendido → Venda → Faturado → Perdido)
  - Aba **"Meus leads offline"** com botão **"+ Novo lead offline"** (formulário: nome, telefone, origem livre, observação)
- **Coordenador** entra em `/coordenacao` e vê:
  - Seletor "Ver como: [Todos | Consultor X | Consultor Y]" que troca o Kanban exibido
  - Botão **"Transferir"** em cada card
  - Aba **"Leads brutos"** com atribuição manual opcional

### 4. Cadência de atendimento configurável
- Nova tela no admin: **"Cadência"** — o admin cadastra passos com `dia_offset`, `canal` (WhatsApp / Ligação / E-mail / Presencial), `titulo`, `descricao`, `ordem`.
- Quando um lead vira "Em atendimento", o sistema gera as tarefas da cadência (`lead_cadence_tasks`) com `due_date = data_inicio + dia_offset`.
- Cada card no Kanban mostra a **próxima tarefa da cadência** e um botão "Concluir passo". Tarefas atrasadas ficam em vermelho.
- Consultor vê o cronograma completo do lead ao abrir o card.

### 5. BI de tráfego pago
- Nova tela no admin: **"Investimento em tráfego"** — cadastro por **data + canal (Google Ads / Meta / TikTok / Outros) + valor investido + campanha (opcional)**.
- Dashboard novo (visível para admin e coordenador) com:
  - Cards: Investimento total, Leads gerados, Vendas, Faturamento, **CPL** (custo por lead), **CAC** (custo por venda), **ROAS**, **Ticket médio**
  - Gráfico de linhas: Investimento vs. Faturamento por dia
  - Gráfico de barras: Leads por canal e por campanha (UTM)
  - Ranking de consultores (leads recebidos, taxa de conversão, valor vendido)
- Filtros: intervalo de datas, canal, consultor.
- Uso do `recharts` (já é padrão do stack).

### 6. Roteamento e permissões
- `/admin` → admin
- `/coordenacao` → coordenador + admin
- `/crm` → consultor + coordenador + admin
- Login redireciona ao painel do papel.
- RLS reforça tudo no banco (consultor só lê/edita leads onde `assigned_to = auth.uid()` OU `assigned_to IS NULL`; coordenador/admin veem tudo).

## Detalhes técnicos

- **Migração SQL**:
  - `ALTER TYPE app_role ADD VALUE 'coordenador'`
  - Novas tabelas: `lead_transfers`, `cadence_steps`, `lead_cadence_tasks`, `traffic_spend`, `offline_leads` (ou flag `is_offline` em `leads`)
  - Trigger em `leads`: quando `stage` muda de `novo` e `assigned_to IS NULL`, seta `assigned_to = auth.uid()` e gera tarefas da cadência
  - Políticas RLS por papel usando `has_role()`
  - GRANTs em toda tabela nova
- **Server functions** (`src/lib/`):
  - `crm.claimLead`, `crm.transferLead` (só coord/admin), `crm.createOfflineLead`
  - `cadence.list`, `cadence.upsertStep`, `cadence.completeTask`
  - `traffic.upsertSpend`, `traffic.listSpend`, `bi.getMetrics` (agrega leads + spend)
- **Frontend**:
  - `src/routes/_authenticated/coordenacao.tsx` (nova)
  - `src/routes/_authenticated/crm.tsx` ganha abas Brutos / Meus / Offline + botão de cadência no card
  - `src/routes/_authenticated/admin.tsx` ganha abas **Cadência** e **Tráfego pago**
  - Novo componente `BiDashboard` com `recharts`
  - Bloqueio visual (card desabilitado + tooltip "Lead de outro consultor") quando `assigned_to !== meu id`

## Fora do escopo agora
- Integração automática com Google/Meta/TikTok Ads (pode entrar depois; hoje é entrada manual)
- Aprovação de transferência por workflow (hoje coord/admin transfere direto)
- Notificações push/e-mail das tarefas da cadência atrasadas
- Importação de leads offline por planilha
