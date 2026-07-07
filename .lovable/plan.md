
## Objetivo

O consultor abre o site, clica em "Baixar App", instala um `.apk` no celular e passa a cadastrar/mover leads do celular usando o mesmo backend (Lovable Cloud) do painel web.

## Abordagem escolhida: Capacitor (WebView nativa apontando para o site publicado)

O app Android será um invólucro Capacitor que carrega a versão publicada em `https://lz7energia.com.br/coordenacao` (ou `/crm`). Nada é duplicado: o consultor usa exatamente as mesmas telas do painel web, com o mesmo login e os mesmos dados em tempo real. Não há sincronização própria a manter.

Vantagens:
- Toda alteração no painel web reflete no app na hora — não precisa republicar o APK a cada mudança.
- Câmera / permissões nativas podem ser adicionadas depois via plugins Capacitor sem refazer o app.
- Login já funciona (mesmos cookies/local storage do Supabase Auth).

Alternativa considerada e descartada: PWA "instalar tela inicial". Funciona no Android mas o iOS bloqueia várias APIs e o usuário não recebe um `.apk` para baixar — não é o pedido.

## O que será entregue nesta etapa

1. **Estrutura Capacitor** no projeto (`android/`, `capacitor.config.ts`), com `server.url` = URL publicado e allowlist do domínio.
2. **Splash screen + ícone** gerados a partir do logo.
3. **Workflow do GitHub Actions** (`.github/workflows/android-apk.yml`) que:
   - Instala JDK 17 + Android SDK.
   - Roda `npx cap sync android` e `./gradlew assembleRelease`.
   - Assina o APK com uma keystore fornecida via secrets.
   - Publica o `.apk` como artefato do workflow **e** faz upload para o Lovable Assets (CDN) usando um pequeno script — a URL pública fica salva em `public/app-download.json`.
4. **Rota `/app` no site** com:
   - Botão grande "Baixar App para Android" apontando para a URL do `.apk` do CDN.
   - Passos de instalação (habilitar "Fontes desconhecidas" no Android, abrir o arquivo).
   - QR code apontando para o `.apk` para facilitar no celular.
   - Aviso: "iOS não suportado nesta versão. Use o site normalmente pelo Safari."
5. **Link "Baixar App"** no header do painel `/coordenacao` para o consultor logado achar rápido.

## O que o usuário precisa fazer uma única vez

Estes passos são fora do que a Lovable pode automatizar:

- **Gerar uma keystore de assinatura** (`keytool -genkey ...`) — o comando será documentado no README com valores sugeridos.
- **Adicionar 4 secrets no GitHub** do repositório: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- **Adicionar 1 secret para publicar no CDN**: `LOVABLE_ASSETS_TOKEN` (eu forneço as instruções de onde pegar).
- Rodar o workflow "Build Android APK" no GitHub uma vez (`Actions → Run workflow`). A partir daí, cada `push` na `main` regenera o `.apk`.

Sem esses secrets o `.apk` não pode ser assinado nem publicado — é limitação da Google, não do projeto.

## Limitação técnica importante

O ambiente da Lovable não tem Android SDK / JDK instalados, então **o `.apk` não é compilado dentro do editor**. Ele é compilado no GitHub Actions (grátis para repositórios públicos e nos limites gratuitos de repositórios privados). É o padrão de mercado para builds Android.

Enquanto o primeiro `.apk` não é gerado, a rota `/app` mostra um estado "APK em preparação, atualize em alguns minutos".

## Detalhes técnicos

- `@capacitor/core`, `@capacitor/android`, `@capacitor/splash-screen` instalados via `bun add`.
- `capacitor.config.ts` com `server: { url: "https://lz7energia.com.br", cleartext: false, androidScheme: "https" }` e `appId: "br.com.lz7energia.consultor"`.
- Ícone/splash gerados com `@capacitor/assets` a partir de `src/assets/app-icon.png` (usarei o logo já subido para o CDN, otimizado para 1024x1024 quadrado com fundo).
- Nova rota TanStack `src/routes/app.tsx` que lê `public/app-download.json` para obter a URL do APK e a versão.
- Header do `/coordenacao` recebe um link `<Link to="/app">Baixar App</Link>` visível só em telas ≥ md.
- Workflow salva a URL no `public/app-download.json` via `git commit` de volta ao repo (usa `GITHUB_TOKEN`).
- O QR code é gerado no client com a lib `qrcode` (leve, ~10KB).
