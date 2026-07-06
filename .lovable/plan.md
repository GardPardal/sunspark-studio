## O que vou construir

### 1. Perfis de acesso (2 versões do painel)
- **Admin**: acesso total — edita textos/contatos do site, tags (GTM, GA4, Google Ads, Meta Pixel + CAPI, TikTok Pixel + Events API), gerencia usuários e vê todos os leads.
- **Consultor comercial**: acessa apenas o CRM — vê **somente os leads atribuídos a ele**, atualiza estágio, registra valor da venda, e vê o próprio dashboard.

Novo papel `consultor` no banco. Regras de acesso (RLS) garantem que consultor não veja lead de outro consultor.

### 2. Gerenciamento de usuários (dentro do painel Admin)
- Criar usuário informando **e-mail, senha, nome e perfil (Admin/Consultor)**.
- Listar usuários, alterar perfil e desativar.
- Feito via server function protegida (só admin executa).

### 3. CRM Kanban (Consultor e Admin)
Colunas: **Novo → Em atendimento → Não atendido → Venda → Faturado (venda paga)**.
- Cartão do lead com nome, telefone (link WhatsApp), origem (UTM/gclid/fbclid), valor da conta.
- Botão "Mover para..." em cada card (troca de estágio simples e rápida, sem drag confuso no mobile).
- Ao mover para **Venda** abre modal para preencher **valor da venda** e observações.
- Admin pode atribuir/reatribuir leads a um consultor. Consultor só edita os seus.

### 4. Dashboard do Consultor
Cards e gráficos com base nos leads dele:
- Leads recebidos (mês) · Atendidos · Vendas · Faturados
- **Taxa de conversão** (vendas / atendidos)
- **Valor total vendido** e **valor faturado**
- Ticket médio e leads por origem (Google/Meta/Orgânico)

Admin vê o mesmo dashboard consolidado + por consultor.

### 5. Envio de conversões para Meta, Google e TikTok
Objetivo: alimentar as campanhas com sinais de qualidade (não só "lead capturado", mas **lead qualificado, venda e faturamento**).

Frontend (já parcial, vou completar):
- Google Tag Manager (container GTM-XXXX) — carrega todo o resto se preferir
- GA4, Google Ads Pixel, Meta Pixel, **TikTok Pixel** (novo)
- Evento de `Lead` no envio do formulário (já existe)

Backend (novo) — dispara **conversões offline** quando o consultor muda o estágio:
- **Meta CAPI**: eventos `Lead`, `Qualified Lead`, `Purchase` com `event_id` (deduplicação), `fbp`/`fbc`, e-mail/telefone hasheados
- **Google Ads Enhanced Conversions for Leads**: envia `gclid` + e-mail/telefone hasheados quando vira Venda/Faturado
- **TikTok Events API**: eventos `Lead` e `CompletePayment` com `ttclid`

Novos campos no painel Admin (Configurações → Tracking):
- GTM ID, GA4, Google Ads (ID + labels de Lead/Venda/Faturado)
- Meta Pixel ID + **Access Token CAPI** (secret) + Test Event Code
- TikTok Pixel ID + **Events API Access Token** (secret)

Segredos ficam armazenados de forma segura (nunca expostos ao navegador).

### 6. Roteamento
- `/admin` → só admin
- `/crm` → consultor (e admin também pode acessar)
- Login redireciona automaticamente ao painel correto conforme o perfil.

## Detalhes técnicos (para referência)

- Migração SQL: novo enum `consultor`, colunas em `leads` (`stage`, `assigned_to`, `sale_value`, `sale_notes`, `stage_updated_at`), RLS por consultor, novas chaves em `site_settings` (tracking IDs) + secrets do Cloud para tokens CAPI/TikTok/Google.
- Server functions com `requireSupabaseAuth`:
  - `admin.createUser` / `admin.listUsers` / `admin.updateUserRole` (verificam `has_role admin`)
  - `crm.updateStage` (verifica atribuição, dispara conversão para o canal certo)
  - `tracking.sendConversion` (Meta CAPI + Google Ads + TikTok, com hashing SHA-256)
- Frontend: `src/routes/_authenticated/admin.tsx` ganha abas **Site**, **Tags**, **Usuários**; nova rota `src/routes/_authenticated/crm.tsx` com Kanban + Dashboard; componente `TrackingScripts` estendido com GTM e TikTok.
- Sem drag-and-drop pesado — botão "Mover para" é mais confiável em mobile e menos código.

## O que **não** entra nesse ciclo (posso fazer depois se quiser)
- Automação de disparo de WhatsApp/e-mail para o lead
- Integração com CRM externo (HubSpot/Pipedrive)
- Relatórios PDF exportáveis
- Notificações push quando chega lead novo

Confirma que faz sentido para eu implementar tudo isso?