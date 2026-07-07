# App Android (LZ7 Consultor)

Este projeto empacota o painel do consultor como um app Android usando
Capacitor. O `.apk` é gerado pelo GitHub Actions (`.github/workflows/android-apk.yml`)
e disponibilizado automaticamente na rota `/app` do site.

## Configuração inicial (uma vez só)

### 1. Gerar a keystore de assinatura

No seu computador (Linux/Mac com Java instalado):

```bash
keytool -genkey -v \
  -keystore lz7-release.keystore \
  -alias lz7-consultor \
  -keyalg RSA -keysize 2048 -validity 10000
```

Guarde bem a senha — sem ela você não consegue mais publicar
atualizações que o Android reconheça como o mesmo app.

Converta para base64 (para colar no GitHub Secrets):

```bash
base64 -w0 lz7-release.keystore   # Linux
base64 -i lz7-release.keystore    # macOS
```

### 2. Adicionar 4 secrets no GitHub

Vá em **Settings → Secrets and variables → Actions → New repository secret**
do repositório conectado e crie:

| Nome                        | Valor                                      |
| --------------------------- | ------------------------------------------ |
| `ANDROID_KEYSTORE_BASE64`   | Saída base64 do arquivo `.keystore`        |
| `ANDROID_KEYSTORE_PASSWORD` | Senha do keystore                          |
| `ANDROID_KEY_ALIAS`         | `lz7-consultor` (ou o que você escolheu)   |
| `ANDROID_KEY_PASSWORD`      | Senha da chave (geralmente igual à acima)  |

### 3. Rodar o build

Vá em **Actions → Build Android APK → Run workflow**.

Depois de ~5-8 min:

- O `.apk` fica publicado como **GitHub Release** (`android-v<data>`).
- O arquivo `public/app-download.json` é commitado com a URL da release.
- Publique o site na Lovable e a rota `/app` mostra o botão "Baixar App".

Cada `push` na `main` que altere `capacitor.config.ts` regera o APK.
Para regerar manualmente sempre que quiser, use "Run workflow".

## Como o app funciona

O `.apk` é um WebView Android configurado em `capacitor.config.ts` para
abrir diretamente `https://lz7energia.com.br/coordenacao`. Isso significa:

- **Não precisa republicar o APK** para cada mudança no painel: alterou o
  site, os consultores veem a nova versão na próxima abertura.
- **Mesmo login** do painel web (Supabase Auth).
- Para adicionar câmera, geolocalização, notificações etc. no futuro,
  instale o plugin Capacitor correspondente e regere o APK.

## Trocar ícone / splash

Coloque um PNG 1024×1024 em `resources/icon.png` e outro em
`resources/splash.png`, e adicione ao workflow:

```bash
bunx @capacitor/assets generate --android
```

antes do `assembleRelease`.
