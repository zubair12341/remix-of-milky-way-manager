// Service-worker registration wrapper.
// Follows the Lovable PWA skill: never registers in dev, preview iframes,
// or when the URL carries ?sw=off. In those refused contexts it also
// unregisters any leftover /sw.js so a stale worker cannot pin old assets.
// @ts-expect-error - virtual module provided at build time by vite-plugin-pwa
import { registerSW } from "virtual:pwa-register";

function shouldRegister(): boolean {
  if (!import.meta.env.PROD) return false;
  if (typeof window === "undefined") return false;
  if (window.self !== window.top) return false; // inside an iframe (preview)
  const url = new URL(window.location.href);
  if (url.searchParams.get("sw") === "off") return false;
  const host = window.location.hostname;
  const banned = [
    "lovableproject.com",
    "lovableproject-dev.com",
    "beta.lovable.dev",
  ];
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return false;
  if (banned.some((b) => host === b || host.endsWith(`.${b}`))) return false;
  return true;
}

async function unregisterExistingAppWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      if (url.endsWith("/sw.js") || url.endsWith("/service-worker.js")) {
        await r.unregister();
      }
    }
  } catch (err) {
    console.warn("[pwa] failed to unregister existing worker", err);
  }
}

export function registerPwa() {
  if (!shouldRegister()) {
    void unregisterExistingAppWorker();
    return;
  }
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Auto-update — Workbox is configured with skipWaiting + clientsClaim,
      // so the new SW activates immediately on next load.
      updateSW(true);
    },
    onRegisterError(err: unknown) {
      console.error("[pwa] SW registration failed", err);
    },
  });
}
