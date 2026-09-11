import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "equity-launch-pages-mode",
      transformIndexHtml(html) {
        return html.replace("__EL_BUILD_MODE__", "built");
      },
    },
  ],
  base: "./",
  build: { outDir: "docs", emptyOutDir: true, sourcemap: true },
});
