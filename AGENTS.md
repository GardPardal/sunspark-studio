<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Solar OS — LZ7 Energia · Guia para agentes de IA

Este arquivo é a fonte de verdade para qualquer agente (Lovable, Antigravity,
Claude Code, Cursor, Copilot). Leia por completo antes de editar.

## 1. Stack fixa (não trocar)

- **TanStack Start v1** (React 19 + Vite) com SSR em runtime Cloudflare Workers.
- **TanStack Router file-based** em `src/routes/`. `src/routeTree.gen.ts` é gerado — **nunca editar**.
- **Nunca** instalar `react-router-dom`, Next.js, Vue, etc.
- **Tailwind CSS v4** configurado em `src/styles.css` (sem `tailwind.config.js`).
- **Backend = Lovable Cloud (Supabase)**. Ao falar com o usuário, dizer "Lovable Cloud"/"backend", nunca "Supabase".
- Gerenciador: `bun` (ou `npm`). Node 20+.

## 2. Comandos

```bash
bun install
bun run dev        # http://localhost:8080
bun run typecheck  # tsc --noEmit
bun run lint
bun run build      # build de produção (Worker)
```

Antes de abrir PR: `bun run typecheck && bun run lint && bun run build` precisam passar.
O CI (`.github/workflows/ci.yml`) roda exatamente isso.

## 3. Arquitetura de servidor

| Necessidade | Onde escrever |
|---|---|
| Lógica interna chamada pelo app | `createServerFn` em `src/**/*.functions.ts` |
| Helper que só roda no servidor | `src/**/*.server.ts` (nunca importado por componente) |
| Webhook / API externa / cron | `src/routes/api/public/**` (rota `createFileRoute` com bloco `server`) |

Regras duras:
- `process.env.X` só **dentro** do `.handler()` — nunca em escopo de módulo.
- No browser use `import.meta.env.VITE_*`.
- Componentes importam `*.functions.ts`, **jamais** `*.server.ts`.
- Rotas `_authenticated/*` já têm gate de sessão; loaders protegidos só podem viver lá.
- Rotas em `/api/public/*` **não** têm auth: valide assinatura/segredo dentro do handler.
- Não usar Supabase Edge Functions — tudo em server functions/rotas.
- Runtime é Worker: nada de `child_process`, `sharp`, `puppeteer` ou libs Node-only.

## 4. Banco de dados

- Toda tabela nova em `public` precisa, na mesma migração e nesta ordem:
  `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY`.
- Papéis de usuário ficam **só** em `user_roles` + função `has_role()` (security definer).
  Nunca guardar role em `profiles`.
- Papéis existentes: `admin`, `diretor`, `coordenador`, `sdr`, `consultor`, `rh`.
  O papel `rh` (Paloma) é isolado: só acessa `/mod/rh*`.
- Nunca alterar os schemas `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.
- Arquivos auto-gerados proibidos de editar: `src/integrations/supabase/client.ts`,
  `client.server.ts`, `types.ts`, `auth-middleware.ts`, `auth-attacher.ts`,
  `previewAuthStorage.ts`, `supabase/config.toml`, `.env`.

## 5. Design System (obrigatório)

- Tipografia: **Sora** (títulos) + **Manrope** (UI/corpo).
- Cores: tokens OKLCH definidos em `src/styles.css`. **Nunca** cor hardcoded
  (`bg-black`, `text-white`, `bg-[#123]`). Use tokens semânticos / componentes `src/components/ds/*`.
- Uma navegação por viewport (bottom nav no mobile OU sidebar no desktop, nunca as duas).
- Uma ação primária por tela. Menu principal fixo: Hoje, Trabalho, Marketing, Inteligência, Gestão.
- Idioma da interface e das respostas: **pt-BR**.

## 6. Regras de produto

- **Regra de ouro: nunca remover, sempre somar.** Fluxo antigo permanece como fallback
  até o novo ser validado.
- Toda página de conteúdo precisa de `head()` próprio com title/description/og únicos.
- Alison Barbosa é **analista de marketing** (nunca diretor) na inteligência da Liz.
- Não inventar dados de vagas, candidatos, leads ou métricas.

## 7. Segredos

Nunca commitar valores reais. Chaves publicáveis (`VITE_*`) podem ficar no código;
segredos de servidor vão nas variáveis de ambiente do deploy.
Lista completa em [`.env.example`](./.env.example).
`SUPABASE_SERVICE_ROLE_KEY` e a senha do banco não estão disponíveis para agentes.

## 8. Fluxo de trabalho no GitHub (Antigravity e afins)

1. Branch a partir de `main`: `feat/...`, `fix/...`.
2. Commits pequenos e descritivos, em pt-BR ou inglês — mas nunca reescrever histórico já publicado.
3. Abrir PR; o CI precisa ficar verde.
4. Merge em `main` sincroniza de volta para o Lovable e vai para preview.
5. Publicação em produção continua sendo feita pelo botão Publish do Lovable.
