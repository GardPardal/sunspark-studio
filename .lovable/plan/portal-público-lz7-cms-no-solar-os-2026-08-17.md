# Portal público LZ7 + CMS no Solar OS

## 1. O que será reutilizado (nada novo duplicado)

| Necessidade                                                    | Já existe → reutiliza                                                                    |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Leads comerciais                                               | tabela `leads` + `/api/public/lead` + `crm-stage.server.ts` (Ploomes/Meta CAPI intactos) |
| Tracking/UTM/fbclid/gclid                                      | `src/lib/tracking.ts` (congelado, apenas consumido)                                      |
| Config global (telefone, WhatsApp, e-mail, redes, cores, logo) | `site_settings` + `site-settings.functions.ts`                                           |
| Auth e permissões                                              | `user_roles` + `has_role()` (papéis existentes: admin, coordenador, sdr, consultor)      |
| E-mail transacional                                            | `lovable/email/transactional/send` + `email-templates/registry.ts`                       |
| Timeline/auditoria                                             | `timeline_events` via `record_event`                                                     |
| Admin                                                          | shell atual + `/mod/*` — a área "Site" entra como novo módulo, sem segundo painel        |
| Identidade visual                                              | tokens `--lz-navy` / `--lz-green`, Sora + Manrope, componentes em `src/components/site/` |

## 2. Tabelas novas (mínimo necessário, aditivas)

- `site_pages` — páginas institucionais/jurídicas editáveis (slug, título, conteúdo rico, SEO, publicado)
- `site_solutions` — 5 soluções editáveis (hero, benefícios, FAQ, CTA, seções, SEO, form config)
- `site_projects` — portfólio (slug, categoria, cidade, potência, galeria, destaque, publicado, SEO)
- `site_posts`, `site_categories`, `site_authors`, `site_tags`, `site_post_tags` — blog editorial
- `site_jobs`, `job_applications` (com `resume_path`) — vagas e candidaturas
- `partner_requests` — solicitações de parceria com status
- `contact_messages` — fale conosco, roteado por assunto
- `newsletter_subscribers` — inscrição + descadastro (reaproveita `email_unsubscribe_tokens`)
- `site_units` — unidades reais (só o que a LZ7 cadastrar; nada inventado)
- `site_timeline`, `site_stats` — história e números da página Sobre
- Bucket privado `resumes` no Storage, com política de acesso apenas para RH/admin

Nenhuma tabela de lead nova: orçamento/simulador grava em `leads`.

## 3. Como funciona o CMS

Admin → Site (`/mod/site/*`): Visão geral · Páginas · Soluções · Projetos · Blog · Vagas · Parceiros · Formulários · Mídias · SEO · Configurações. Tudo por server functions autenticadas (`requireSupabaseAuth`), com RLS: leitura pública apenas de registros `publicado = true`; escrita apenas por admin/marketing/RH conforme a área.

## 4. Blog

CMS editorial com editor rico, rascunho/revisão/agendado/publicado/arquivado, categorias, autores, tags, busca, SEO por artigo, Article + BreadcrumbList schema. Publicação sempre manual — nenhuma geração automática de notícia. Artigos iniciais entram como **rascunho** para revisão da LZ7.

## 5. Trabalhe conosco e currículos

Portal de vagas com filtros, página por vaga, candidatura com upload. Currículo vai para bucket **privado** `resumes`; download só via server function que valida papel RH/admin e gera URL assinada de curta duração. Nunca URL pública, nunca indexável. Vaga encerrada mostra tela dedicada com banco de talentos, não 404.

## 6. Projetos e Parceiros

Projetos: listagem com filtros client-side, página `/projetos/$slug` com galeria, dados técnicos e CTA que entra no fluxo de `leads`. Parceiros: formulário salvo em `partner_requests` com kanban de status no Admin e evento próprio (não `Lead` comercial).

## 7. Formulários → sistema atual

Um componente `SmartForm` único: validação Zod client + server, honeypot, rate limit por IP, consentimento LGPD não pré-marcado. Destino por tipo:

- orçamento/simulação → `leads` (fluxo comercial existente, Meta CAPI/Ploomes como hoje)
- contato → `contact_messages` (+ chamados existentes quando aplicável)
- parceria → `partner_requests` (evento `Contact`, não `Lead`)
- candidatura/banco de talentos → `job_applications` (**sem** evento comercial)
- newsletter → `newsletter_subscribers` (**sem** evento comercial)
  Todos gravam página, URL, UTMs, gclid, fbclid.

## 8. Rodapé conectado

Soluções → `/energia-solar-residencial`, `/energia-solar-comercial`, `/energia-solar-industrial`, `/sistemas-hibridos`, `/carport-solar`. Institucional → `/sobre`, `/projetos`, `/seja-um-parceiro`, `/trabalhe-conosco`, `/blog`. Atendimento → `tel:`, WhatsApp com mensagem contextual por página, `mailto:` + `/contato`, localização → `/unidades`. Redes sociais só aparecem se preenchidas em Configurações. Jurídico → `/politica-de-privacidade`, `/termos-de-uso`. Zero `href="#"`.

## 9. Risco ao /quiz e como fica protegido

`/quiz` importa apenas: `@tanstack/react-router`, `react`, `lucide-react`, `@/lib/tracking` e `@/lib/site-settings`. Riscos reais:

1. `src/lib/tracking.ts` — **congelado**, nenhuma alteração.
2. `src/lib/site-settings*.ts` — só posso **adicionar** chaves opcionais; `REQUIRED_PUBLIC_SETTING_KEYS` não muda (adicionar chave obrigatória derrubaria o /quiz).
3. `src/styles.css` — apenas adição de tokens, nunca alteração dos existentes.
4. `__root.tsx` — não será tocado.
5. Header/Footer novos **não** serão aplicados ao `/quiz`; a rota fica isolada.

Após cada fase: `GET /quiz` = 200, layout idêntico, UTMs preservadas, regra de qualificação (≥ R$190, PR/SP) e WhatsApp `5543999760685` inalterados.

## 10. Fases

1. Migração de banco + módulo Admin → Site + Configurações globais + rodapé real
2. Soluções (5 páginas + simulador)
3. Sobre + Projetos
4. Parceiros
5. Trabalhe conosco + painel RH + Storage privado
6. Blog + CMS editorial + newsletter
7. Contato + Unidades
8. Jurídico
9. SEO (sitemap dinâmico, schema, OG) + analytics + performance
10. Regressão completa, com `/quiz` verificado a cada fase

## Notas técnicas

Tudo aditivo: nenhuma rota removida, nenhuma tabela alterada de forma destrutiva. Novas telas em `src/modules/site/*` e `src/components/site/*`, server functions em arquivos `*.functions.ts` (nenhum `supabaseAdmin` no cliente). CMS/admin fora do bundle público via code splitting por rota.
