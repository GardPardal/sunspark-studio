# Diretrizes Técnicas — LZ7 Energia (Antigravity)

Este documento centraliza as regras, padrões arquiteturais e o checklist de PR para desenvolvimento neste repositório.

---

## 1. Stack Tecnológica Fixa

- **Framework:** TanStack Start v1 (Full-stack SSR)
- **Frontend:** React 19 + TypeScript
- **Bundler & Dev Server:** Vite + `@lovable.dev/vite-tanstack-config`
- **Roteamento:** TanStack Router (`src/routes/`)
- **Estilização:** Tailwind CSS v4 + `@fontsource-variable/*`
- **Backend & Auth:** Lovable Cloud / Supabase
- **Deploy / PWA:** Vite PWA + Workbox

> **Proibição Estrita de Routers Concorrentes:**
> Nunca instale ou use `react-router-dom`, `next`, `vue`, `@remix-run/router` ou qualquer outro roteador. Todo o roteamento deve seguir exclusivamente as convenções do **TanStack Router / TanStack Start**.

---

## 2. Backend & Banco de Dados (Lovable Cloud / Supabase)

Toda nova tabela criada no schema `public` deve seguir obrigatoriamente a sequência completa de segurança:

```sql
-- 1. Criação da tabela
CREATE TABLE public.minha_tabela (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Concessão de permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.minha_tabela TO authenticated;
GRANT SELECT ON TABLE public.minha_tabela TO anon;

-- 3. Habilitação de RLS
ALTER TABLE public.minha_tabela ENABLE ROW LEVEL SECURITY;

-- 4. Criação de políticas RLS
CREATE POLICY "Permitir leitura autenticada"
ON public.minha_tabela
FOR SELECT
TO authenticated
USING (true);
```

### Regra para Papéis de Usuário (Roles)

- **Papéis e permissões administrativas/especiais:** Devem ficar **exclusivamente** na tabela `user_roles` e ser verificados via função RPC `has_role()`.
- **Nunca** adicione colunas de role/role_type diretamente na tabela `profiles`.

---

## 3. Design System Solar OS

- **Tipografia:**
  - **Títulos e Destaques:** `font-display` (Sora Variable)
  - **Interface e Corpo:** `font-sans` (Manrope Variable)
  - **Rankings/Métricas:** `font-rank` (Space Grotesk Variable) e `font-rank-body` (DM Sans Variable)
- **Cores e Tokens:**
  - Use sempre as variáveis de tema OKLCH definidas em `src/styles.css` (ex: `bg-navy-deep`, `text-lzgreen`, `text-primary`, `bg-card`, etc.).
  - **Nunca** use cores hexadecimais ou RGB soltas (_hardcoded_) nos componentes.

---

## 4. Regra de Ouro da Arquitetura

> **Nunca remover, sempre somar.**
> Ao implementar uma nova versão de fluxo, cálculo ou componente, mantenha a implementação anterior disponível como _fallback_ até que a nova seja 100% validada em produção.

---

## 5. Checklist de PR e CI

Antes de submeter um Pull Request ou subir alterações:

- [ ] Variável `VITE_SUPABASE_PUBLISHABLE_KEY` configurada nas variáveis do repositório no GitHub (_Settings → Secrets and variables → Actions → Variables_).
- [ ] Executar typecheck e linter sem erros.
- [ ] Testar se o build passa com sucesso: `npm run build` ou `bun run build`.
- [ ] Garantir que nenhum histórico Git publicado foi reescrito (evitar `git push --force` ou rebase destrutivo para preservar a sincronia com o Lovable).
