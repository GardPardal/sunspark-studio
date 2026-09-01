# Radar Editorial LZ7 — Motor editorial automático do Blog

Transformar o Blog em uma redação digital: descobrir pautas em fontes confiáveis, apurar, cruzar fontes, escrever matéria original LZ7, gerar capa própria, SEO e publicar (semiautomático por padrão).

## 1. O que já existe (reaproveitar, nada duplicado)

- **CMS do site** (`src/modules/site/`): `admin.functions.ts`, `public.functions.ts`, `cms.schema.ts`, UI genérica em `/mod/site/gerenciar/$table`.
- **Tabelas de conteúdo**: `site_posts` (slug, title, subtitle, excerpt, content, cover_url, category_id, author_id, status, published_at, reading_minutes, faqs, cta, seo, views), `site_categories`, `site_authors`, `site_post_tags`.
- **Blog público**: `src/routes/blog.index.tsx` e `src/routes/blog.$slug.tsx`.
- **IA**: Lovable AI Gateway via `src/lib/ai-gateway.server.ts` (usado pela LIZ). Nenhum segundo sistema de IA será criado.
- **Imagens**: pipeline da LIZ Studio em `src/routes/api/public/liz-image.ts` (planejamento + geração + upload). Será reutilizado para as capas.
- **Cron**: `pg_cron` + `pg_net` chamando rotas `/api/public/*` (padrão já usado em `sync-ploomes-users` e lembretes de agenda).
- **Vetores**: pgvector já habilitado (base de conhecimento da LIZ) → reutilizado para deduplicação semântica e artigos relacionados.
- **Busca web**: conector Firecrawl (search/scrape) para apuração, com fallback para RSS/sitemap nativo.

## 2. Proteções

- `/quiz` permanece **frozen**: nenhuma alteração de rota, formulário, regras, tracking ou UTMs. Nada do módulo editorial toca esses arquivos; validação visual do /quiz ao final de cada fase.
- Nada de rebuild, troca de framework/banco/auth. CRM, Ploomes, Meta CAPI, WhatsApp e tracking intocados.
- Todas as tabelas novas usam prefixo `editorial_` — nenhuma tabela existente é apagada; em `site_posts` apenas colunas aditivas.

## 3. Novas tabelas (migração aditiva)

- `editorial_sources` — nome, domínio, tipo (oficial/entidade/especializado/geral), categorias, prioridade, autoridade, método (api/rss/sitemap/página), ativo, frequência, última verificação, erros consecutivos, política de uso (permite conteúdo integral / imagem / requer crédito), status.
- `editorial_items` — item bruto captado (url, título, resumo público, data, hash, fonte, cluster).
- `editorial_topics` — pauta agrupada: assunto, título interno, resumo factual, categoria, status, nº de fontes, fonte primária, confidence_score, lz7_score, evergreen, breaking_news, embedding.
- `editorial_topic_sources` — N:N pauta ↔ itens/fontes com peso.
- `editorial_facts` — fatos verificados: informação, fonte, URL, confiança, data, confirmado_por_n_fontes.
- `editorial_jobs` — fila: queued → fetching → researching → generating → validating → image → seo → publishing → completed/failed, com retries.
- `editorial_logs` — horário, fonte, pauta, ação, resultado, erro.
- `editorial_settings` (linha única) — modo de publicação (manual/semi/auto), kill switch, máximo de artigos/dia, thresholds, regras por categoria.
- `editorial_runs` — execuções do cron com contadores e custo estimado de IA.

Colunas aditivas em `site_posts`: `origin` (manual/auto/ia_assistida), `content_type` (noticia/analise/guia/artigo/editorial), `topic_id`, `sources` (jsonb), `quality_score`, `updated_note`, `breaking_news`, `embedding`.

Todas com GRANTs explícitos (`anon` só onde há leitura pública), RLS e políticas de gestão para admin/coordenador.

## 4. Arquitetura do motor (100% server-side)

```text
cron 60min → /api/public/editorial/scan
   descoberta (adapters) → normalização → hash + dedup → cluster de pautas
   → score de relevância LZ7 (keywords, barato, sem IA)
   → fila editorial_jobs (apenas pautas relevantes)

cron 15min → /api/public/editorial/worker
   apuração (fonte primária + cruzamento) → extração de fatos
   → geração do artigo (IA) → quality gate + similaridade
   → capa (pipeline LIZ) → SEO/slug/tags → publica ou envia p/ revisão
```

**Adapters independentes** em `src/modules/editorial/adapters/`: `rssAdapter`, `sitemapAdapter`, `aneelAdapter`, `mmeAdapter`, `genericNewsAdapter`. Falha de uma fonte registra erro e não interrompe as demais. Sem seletores CSS frágeis como base; ordem de preferência API → RSS → sitemap → página pública.

**Segurança do crawler**: allowlist de domínios cadastrados, bloqueio de localhost/IP privado/metadata (anti-SSRF), sanitização de HTML, sem execução de scripts, rate limit por domínio + cache, respeito a robots (fonte que bloqueia vira `restrita`). Nunca contornar paywall — apenas título/resumo públicos para descoberta.

**Deduplicação**: hash de URL + similaridade de título (trigram) + embedding pgvector do resumo. Itens acima do limiar entram no mesmo `editorial_topic`. Antes de gerar, checa similaridade contra `site_posts` já publicados → decide **atualizar artigo existente** ou **criar novo**.

**Verificação**: `confidence_score` por origem (fonte oficial única ≥ 90; duas fontes independentes ≥ 80; uma jornalística 60–75; desconhecida baixa). Todo número/lei/resolução citado precisa constar em `editorial_facts` com URL; caso contrário o artigo vai para revisão.

**Publicação automática** só quando: modo auto ativo, confidence ≥ 90, relevância ≥ 75, quality gate ok, similaridade baixa, sem duplicidade, SEO válido, imagem gerada, dentro do limite diário. Caso contrário → _Aguardando revisão_.

**Custo de IA**: filtros baratos antes da IA. Estimativa por artigo: ~1 chamada de apuração + 1 de redação + 1 de imagem ≈ US$ 0,03–0,08. Com limite de 3–5 artigos/dia, custo diário baixo e visível no painel.

## 5. Admin — Marketing → Blog → Radar Editorial

Dentro do painel já existente (`/mod/site`), novas telas:

- `/mod/site/radar` — dashboard: pautas hoje, relevantes, em produção, publicadas, aguardando revisão, ignoradas; status da automação, próxima leitura, fila, kill switch, digest do dia.
- `/mod/site/radar/pautas` — feed de pautas com fontes, score, botões Gerar artigo / Ver fontes / Ignorar / Publicar.
- `/mod/site/radar/fontes` — CRUD de fontes + botão **Testar fonte** (mostra artigos detectados e último item) + Saúde das Fontes.
- `/mod/site/radar/artigo/$id` — aprovação: pauta → fontes → artigo → imagem → SEO → preview (desktop/mobile/Google/OpenGraph) e ações Regenerar título/imagem, Simplificar, Tornar técnico, Corrigir SEO, Adicionar fonte, Publicar.
- `/mod/site/radar/logs` — logs e custos.

## 6. Blog público premium

`/blog` reformulado: hero editorial, destaque principal, seção **Radar LZ7** (notas curtas), mais recentes, mais lidos, Guias LZ7, categorias, busca instantânea. Artigo com largura ideal de leitura, tempo de leitura, sumário em textos longos, share (WhatsApp/LinkedIn/Facebook/copiar), publicado/atualizado em, bloco elegante de **Fontes consultadas**, artigos relacionados, CTA contextual (não em toda matéria) e disclaimer só quando pertinente. Novas páginas `/blog/politica-editorial`, autor "Redação LZ7 Energia". Article Schema JSON-LD, datas e autor para elegibilidade futura em agregadores. Tracking: `blog_view`, `article_read_25/50/75`, `article_complete`, `article_cta_click`, `newsletter_signup`, `related_article_click` — leitura nunca vira lead.

## 7. Conteúdo inicial

Cadastro das fontes (ANEEL, MME, EPE, CCEE, ONS, Diário Oficial, ABSOLAR, ABGD, ABEEólica, ABSAE, Brasil Energia, Canal Solar, pv magazine Brasil, MegaWhat e gerais), 12 categorias e primeira coleta (até 30 pautas por fonte, apenas coleta/classificação). Depois geração de **até 30 artigos originais LZ7** (8 Solar, 5 Conta de Luz, 4 Mercado, 3 ANEEL, 3 Tecnologia/Baterias, 2 Agro, 2 Empresas, 1 Mobilidade, 2 notícias atuais), com capa própria. Nenhum lorem ipsum, nenhum texto copiado.

## 8. Ordem de implementação

1. Migração das tabelas `editorial_*`, colunas aditivas em `site_posts`, categorias e autor editorial.
2. Adapters + descoberta + normalização + dedup/cluster + score (sem IA) e rota de scan.
3. Fila, worker, apuração, fatos, redação IA, quality gate e detector de similaridade.
4. Geração de capa via pipeline LIZ + SEO/slug/tags/relacionados.
5. Admin Radar Editorial (dashboard, pautas, fontes, aprovação, logs).
6. Cron (scan 60min, worker 15min) em modo **semiautomático**.
7. Blog público premium + política editorial + schema + tracking.
8. Seed das fontes e geração dos artigos iniciais.
9. Semanal: resumo "Semana da Energia" + newsletter gerada (envio desligado por padrão).
10. Validação final incluindo checagem de que `/quiz`, CRM, Ploomes, CAPI e WhatsApp seguem intactos.
