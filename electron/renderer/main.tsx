// Electron renderer bootstrap — plain client SPA.
// Reuses the exact same shared React source as the web build:
//   - getRouter() from @/router builds the same route tree
//   - __root.tsx's RootComponent supplies QueryClient / Lang / Auth / Toaster providers
// The only difference vs. the web build is that we mount via RouterProvider
// instead of TanStack Start's SSR shellComponent — no pages, hooks, contexts,
// stores, or business logic are duplicated for Electron.
import "@/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "@/router";

const router = getRouter();
const container = document.getElementById("root");
if (!container) throw new Error("Renderer root element missing");
createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
