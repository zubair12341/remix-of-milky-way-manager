// Electron requires relative asset paths (base: './') because it loads index.html via file://
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    base: "./",
  },
});
