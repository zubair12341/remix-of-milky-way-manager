// Electron renderer build — plain client SPA, no SSR / no Nitro / no Cloudflare.
// Consumes the same src/ tree as the web build; only the bootstrap layer differs.
// Output: real static dist/index.html + hashed JS/CSS with relative asset paths
// so Electron can load it via file:// with no server.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rendererRoot = path.join(here, "electron/renderer");
const srcDir = path.join(here, "src");

export default defineConfig({
  root: rendererRoot,
  base: "./",
  resolve: {
    alias: { "@": srcDir },
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: path.join(srcDir, "routes"),
      generatedRouteTree: path.join(srcDir, "routeTree.gen.ts"),
    }),
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: path.join(here, "dist"),
    emptyOutDir: true,
    target: "chrome120",
    sourcemap: false,
  },
  server: { port: 8080 },
});
