# Mapa do Sistema — Solar OS (LZ7 Energia)

Guia de navegação do repositório para agentes (Antigravity, Claude Code, Cursor).
Leia junto com `AGENTS.md` (regras) e `docs/ANTIGRAVITY.md` (setup/CI).

## 1. Visão geral

- App: sistema comercial interno + site público da LZ7 Energia.
- Stack: TanStack Start v1 (React 19, Vite 7, SSR em Cloudflare Workers), Tailwind v4 (`src/styles.css`), backend Lovable Cloud (Supabase).
- Domínios: site `lz7energia.com.br`; preview Lovable.
- Regra de ouro: **nunca remover, sempre somar** — fluxo antigo fica como fallback.

## 2. Mapa de rotas (`src/routes/`)

### Site público (marketing/SEO)
| Rota | Arquivo | Função |
|---|---|---|
| `/` | `index.tsx` | Home |
| `/sobre`, `/contato`, `/unidades`, `/vendas` | `sobre.tsx`, `contato.tsx`, `unidades.tsx`, `vendas.tsx` | Institucional |
| `/energia-solar-residencial|comercial|industrial`, `/sistemas-hibridos`, `/carport-solar` | arquivos homônimos | Landing pages de produto |
| `/energia-solar/$cidade` | `energia-solar.$cidade.tsx` | SEO local por cidade |
| `/blog`, `/blog/$slug` | `blog.index.tsx`, `blog.$slug.tsx` | Blog |
| `/projetos`, `/projetos/$slug` | `projetos.index.tsx`, `projetos.$slug.tsx` | Cases |
| `/quiz`, `/calculadora`, `/captura` | homônimos | Captação de leads |
| `/trabalhe-conosco`, `/vagas/$slug`, `/cadastrar-curriculo` | homônimos | RH público |
| `/dashhub` | `dashhub.ts` | Painel dinâmico (conteúdo no banco, `noindex`) |
| `/bi` | `bi.tsx` | BI público |
| `/mcp` | `mcp.ts` | Servidor MCP (OAuth) p/ Claude |
| `/.well-known/*`, `/.mcp`, `/.lovable.oauth.consent` | pastas homônimas | Metadados OAuth/MCP |
| `/sitemap.xml` | `sitemap[.]xml.ts` | Sitemap |

### App autenticado (`src/routes/_authenticated/`)
Gate de sessão em `_authenticated/route.tsx`. **Usuários só com papel `rh` são isolados**: fora de `/mod/rh*` redirecionam, sem sidebar/menu.

| Rota | Arquivo | Função |
|---|---|---|
| `/hoje` | `hoje.tsx` | Home por role (layout único) |
| `/app` | `app.tsx` | Hub do consultor (cards + badges) |
| `/agenda` | `agenda.tsx` | Agenda / ligações |
| `/leads`, `/crm` | `leads.tsx`, `crm.tsx` | Funil |
| `/clientes/*` | `clientes/` | Ficha 360 |
| `/marketing-hub`, `/ranking` | homônimos | Marketing e gamificação |
| `/liz-studio` | `liz-studio.tsx` | Geração de imagens com Liz (AI Gateway) |
| `/coordenacao`, `/sdr-leadqualified` | homônimos | Papeis comerciais |
| `/admin`, `/baixar-app` | homônimos | Admin e PWA |

### Módulos internos (`/mod/*` em `_authenticated/mod/`)
`admin`, `auditoria`, `automacoes`, `bi`, `chamados`, `design-system`, `financeiro`, `ia`, `marketing`, `meta-conversions`, `meta-debug`, `ploomes-integracao`, `responsaveis`, `rh`, `rh-disc`, `saude`, `site/*`, `vendas`, `whatsapp/*`.

- `/mod/rh` — painel de RH da Paloma (lista/Kanban, criar vaga, candidaturas).
- `/mod/rh-disc` — administração de questionários DISC.

## 3. APIs públicas (`src/routes/api/public/`)
Sem auth de sessão — **validar segredo/assinatura dentro do handler**.

| Endpoint | Função |
|---|---|
| `lead.ts` | Recebe leads do site WordPress |
| `candidatura.ts` | Candidaturas de vagas (upload de currículo) |
| `dashhub/dados.ts` | GET público / POST com `X-Hub-Secret` (merge raso + histórico) |
| `dashhub/claude.ts`, `liz-forum.ts`, `liz-ping.ts` | Fórum do DashHub; Liz responde quando Claude offline |
| `email/dispatch.ts` | Ponte autenticada p/ envio de e-mail gerenciado |
| `notify-approval.ts`, `ensure-approved-login.ts` | Fluxo de aprovação de usuários |
| `ploomes/webhook.ts`, `ploomes/sync-users.ts` | Integração Ploomes |
| `whatsapp/webhook.ts`, `wa/queue` | WhatsApp |
| `meta/*`, `hooks/meta-*.ts` | Meta Ads / conversões |
| `liz-chat.ts`, `liz-image.ts` | Liz (chat e imagem) via Lovable AI Gateway |
| `blog-image/`, `editorial/` | Conteúdo do site |

Receiver de eventos de e-mail: `src/routes/lovable/email/events.ts` (bounces/complaints/unsubscribes).

## 4. Backend — onde escrever o quê

- `createServerFn` → `src/lib/*.functions.ts` e `src/modules/*/*.functions.ts`.
- Helpers server-only → `*.server.ts` (nunca importar em componente).
- `process.env.X` só dentro de `.handler()`. Browser: `import.meta.env.VITE_*`.
- Runtime Worker: proibido `child_process`, `sharp`, `puppeteer`, libs Node-only.

## 5. Módulos (`src/modules/`)
`admin`, `audit`, `bi`, `clientes`, `editorial`, `financeiro`, `health`, `hoje`, `ia`, `marketing`, `rh`, `shared` (shell com menu), `site`.

RH: `src/modules/rh/` (`rh.functions.ts`, `rh.server.ts`, `disc-public.functions.ts`).
Design system: `src/components/ds/*`; tokens OKLCH em `src/styles.css`; fontes Sora + Manrope.

## 6. Banco de dados

- Migrações em `supabase/migrations/` (ordem cronológica). Toda tabela nova em `public`: `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY` na mesma migração.
- Papéis **somente** em `user_roles` + função `has_role()` (security definer). Papéis: `admin`, `diretor`, `coordenador`, `sdr`, `consultor`, `rh`.
- Tabelas-chave: `hub_dados` + `hub_dados_hist` (DashHub, versões), `hub_estado` + `hub_estado_hist`, `site_jobs`, candidaturas/notas/eventos DISC do RH, `forum_liz_log`, `mcp_admin_audit`.
- Schemas intocáveis: `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.
- Auto-gerados proibidos: `src/integrations/supabase/*`, `supabase/config.toml`, `.env`.

## 7. Integrações

| Serviço | Onde |
|---|---|
| Ploomes (CRM) | `src/lib/ploomes*.{server,functions}.ts`, webhooks em `api/public/ploomes/` |
| Meta Ads | `src/lib/meta*`, `api/public/meta/*`, módulos `meta-*` |
| WhatsApp | `src/lib/wa*.server.ts`, `api/public/whatsapp/webhook.ts` |
| E-mail gerenciado | `sendTemplateEmail` + `api/public/email/dispatch.ts` + `lovable/email/events.ts` |
| Liz (IA) | `src/lib/liz-prompt.ts`, `liz-forum.*`, `ai-gateway.server.ts` — Lovable AI Gateway, sem chave |
| MCP (Claude) | `src/lib/mcp/` — 15 ferramentas: `whoami`, leads (`create_lead`, `get_lead`, `list_my_leads`), agenda (`create_appointment`, `list_my_appointments`), DashHub (`dashhub_get`, `dashhub_update`, `dashhub_get_app`, `dashhub_set_app`), site (`list_site_pages`, `get_site_page`, `upsert_site_page`), admin (`admin_query`, `admin_execute`) |
| Google Calendar | `src/lib/google-calendar.functions.ts` |

## 8. Regras de produto (não violar)

- Menu principal fixo em 5 itens: Hoje, Trabalho, Marketing, Inteligência, Gestão. FAB Liz global. ⌘K global.
- Uma navegação por viewport; uma ação primária por tela.
- Alison Barbosa = **analista de marketing** (nunca diretor); Liz o trata como referência máxima em vendas.
- Não inventar dados de vagas, candidatos, leads ou métricas.
- Idioma: pt-BR (UI e respostas).

## 9. Checklist antes de PR

```bash
bun run typecheck && bun run lint && bun run build
```

CI: `.github/workflows/ci.yml`. Variável obrigatória no GitHub Actions: `VITE_SUPABASE_PUBLISHABLE_KEY`.
