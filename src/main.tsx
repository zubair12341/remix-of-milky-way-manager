// SPA bootstrap — plain client-side React. Replaces the previous TanStack Start
// SSR entry (src/server.ts / src/start.ts) and the Electron renderer entry.
// The exact same shared route tree from src/routes drives every screen.
import "@/styles.css";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "@/router";
import { registerPwa } from "@/lib/pwa-register";
import { startSync } from "@/lib/sync";

const router = getRouter();
const container = document.getElementById("root");
if (!container) throw new Error("Root element missing");
createRoot(container).render(<RouterProvider router={router} />);

// Register the service worker (guarded — skipped in Lovable preview / dev).
registerPwa();

// Kick off the background sync loop (pulls remote changes when paired + online).
if (typeof window !== "undefined") {
  startSync();
}
