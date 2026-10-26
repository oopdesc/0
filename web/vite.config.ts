import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "no-public-personal-documents",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = (req.url || "").split("?")[0];
          if (
            /^\/(docs|documents)(\/|$)/i.test(path) ||
            /\.(pdf|docx?)(?:$|\/)/i.test(path)
          ) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 18420,
    strictPort: true,
    fs: {
      strict: true,
      allow: [fileURLToPath(new URL(".", import.meta.url))],
      deny: ["**/.env*", "**/.git/**", "**/*.pdf", "**/*.docx"],
    },
    proxy: {
      "/local/java": {
        target: "http://127.0.0.1:18421",
        changeOrigin: true,
        rewrite: (p) => p.replace("/local/java", "/api"),
      },
      "/local/rust": {
        target: "http://127.0.0.1:18422",
        changeOrigin: true,
        rewrite: (p) => p.replace("/local/rust", "/api"),
      },
    },
  },
  build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 250 },
});
