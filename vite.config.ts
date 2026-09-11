import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "aqua-pages-mode",
      transformIndexHtml(html) {
        return html.replace("__AQUA_BUILD_MODE__", "built");
      },
    },
  ],
  base: "./",
  build: { outDir: "docs", emptyOutDir: true, sourcemap: false },
});
