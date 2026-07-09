// Guarded service-worker registration wrapper.
// - Nunca registra em dev / iframe preview / hosts de preview da Lovable
// - Suporta kill-switch via ?sw=off
// - Faz unregister do /sw.js em contextos negados
// Segue o PWA skill oficial.

const APP_SW_PATH = "/sw.js";

function isBlockedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;

  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;

  const url = new URL(window.location.href);
  if (url.searchParams.get("sw") === "off") return true;

  return false;
}

async function unregisterAppSw() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          try {
            const u = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
            return u.endsWith(APP_SW_PATH);
          } catch {
            return false;
          }
        })
        .map((r) => r.unregister().catch(() => false)),
    );
  } catch {
    // silencioso
  }
}

export function registerAppServiceWorker() {
  if (isBlockedContext()) {
    void unregisterAppSw();
    return;
  }
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(APP_SW_PATH, { scope: "/" })
      .catch((err) => {
        console.warn("[pwa] falha ao registrar service worker:", err);
      });
  });
}
