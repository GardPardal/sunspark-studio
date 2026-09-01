# Antigravity (e outros agentes) neste repositório

Objetivo: qualquer agente conectado via GitHub entrega com a mesma qualidade do
Lovable. Leia **[AGENTS.md](../AGENTS.md)** primeiro — ele é a fonte de verdade
(stack, design system, RLS, regras de produto).

## Setup em 3 passos

```bash
bun install
cp .env.example .env      # preencha as chaves que for usar
bun run dev               # http://localhost:8080
```

Sem `.env` o app sobe, mas rotas de servidor que dependem de segredos
(WhatsApp, Ploomes, Meta, IA) retornam erro controlado — é esperado.

## Checklist antes de abrir PR

```bash
bun run typecheck
bun run lint
bun run build
```

Os três precisam passar; o CI roda o mesmo conjunto em `.github/workflows/ci.yml`.

Além disso:

- [ ] Nenhuma cor hardcoded — só tokens do design system.
- [ ] Rota nova tem `head()` com title/description/og próprios.
- [ ] Tabela nova tem `GRANT` + RLS + policies na mesma migração.
- [ ] Nada de `process.env` fora de `.handler()`.
- [ ] `src/routeTree.gen.ts` e arquivos de `src/integrations/supabase/` não foram editados à mão.
- [ ] Nenhum segredo em código ou em commit.
- [ ] Funcionalidade existente preservada (nunca remover, sempre somar).

## Como o código chega em produção

```text
branch → PR → CI verde → merge em main → sincroniza no Lovable → preview
                                              ↓
                              botão Publish no Lovable → produção
```

Backend (migrações, rotas de API) sobe junto com o deploy; o frontend publicado
só muda depois do Publish.

## Onde mexer

| Tarefa | Pasta |
|---|---|
| Páginas públicas do site | `src/routes/*.tsx`, `src/components/site/*` |
| Sistema interno (Solar OS) | `src/routes/_authenticated/**`, `src/modules/**` |
| Lógica de servidor | `src/**/*.functions.ts` + `src/**/*.server.ts` |
| Webhooks / APIs externas | `src/routes/api/public/**` |
| Design tokens | `src/styles.css`, `src/components/ds/**` |
| Ferramentas MCP (Claude) | `src/lib/mcp/**` |
