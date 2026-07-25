// Electron renderer bootstrap — plain client SPA.
// Reuses the exact same shared React source as the web build:
//   - getRouter() from @/router builds the same route tree
//   - __root.tsx's RootComponent supplies QueryClient / Lang / Auth / Toaster providers
// The only difference vs. the web build is that we mount via RouterProvider
// instead of TanStack Start's SSR shellComponent — no pages, hooks, contexts,
// stores, or business logic are duplicated for Electron.
//
// Under file:// (packaged Electron), `window.location.pathname` resolves to
// the on-disk asar path (e.g. /.../app.asar/dist-electron/index.html), not
// "/". Browser history therefore never matches any app route and every
// screen renders the root notFoundComponent. Hash history sidesteps this by
// reading/writing the route from `location.hash`, which is filesystem-safe.
// The web build's history is left untouched.
import "@/styles.css";
import { createRoot } from "react-dom/client";
import { RouterProvider, createHashHistory } from "@tanstack/react-router";
import { getRouter } from "@/router";

console.log("[electron-renderer] bootstrap start");

// A packaged Electron window opens as file://.../index.html. When no hash is
// present, TanStack Router matches the root route. That route is only a web
// startup convenience; on desktop it added one more async hop and could leave
// users staring at "Starting..." if startup IPC was delayed. Boot the desktop
// app straight into the setup gate instead. If setup is already complete, the
// setup/auth routes immediately forward to sign-in or dashboard.
const initialHash = window.location.hash.replace(/^#/, "");
if (initialHash === "" || initialHash === "/" || initialHash.startsWith("/?")) {
  // Use replaceState instead of assigning location.hash. The assignment fires a
  // hashchange before TanStack Router owns the history object, which was the
  // renderer-loop trigger in packaged Electron. replaceState seeds the initial
  // desktop route without emitting a navigation event.
  window.history.replaceState(null, "", "#/setup");
}

const router = getRouter({ history: createHashHistory() });
console.log("[electron-renderer] router created, initial location:", router.state.location.href);
const container = document.getElementById("root");
if (!container) throw new Error("Renderer root element missing");
window.addEventListener("error", (e) => console.error("[electron-renderer] window error:", e.message, e.error?.stack));
window.addEventListener("unhandledrejection", (e) => console.error("[electron-renderer] unhandled rejection:", String(e.reason)));
// StrictMode intentionally omitted for the Electron build: its double-render
// interacts badly with TanStack Router redirects under hash history and
// causes a render loop in production.
createRoot(container).render(<RouterProvider router={router} />);
console.log("[electron-renderer] render() called");
