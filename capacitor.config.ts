import type { CapacitorConfig } from "@capacitor/cli";

// App Android do consultor: um WebView nativo que aponta para o site
// publicado. Toda a lógica (login, CRM, cadastro de leads) já roda lá,
// então este wrapper NÃO precisa ser republicado quando o site muda.
const config: CapacitorConfig = {
  appId: "br.com.lz7energia.consultor",
  appName: "LZ7 Consultor",
  webDir: "dist",
  server: {
    url: "https://lz7energia.com.br/coordenacao",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [
      "lz7energia.com.br",
      "*.lz7energia.com.br",
      "*.lovable.app",
      "*.supabase.co",
      "*.googleapis.com",
      "*.gstatic.com",
    ],
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0f4c3a",
      showSpinner: false,
    },
  },
};

export default config;
