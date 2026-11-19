import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  root: resolve("web"), envDir: false,
  resolve: { alias: { "@resell/localized": resolve("web/localized") } },
  esbuild: { jsxImportSource: "@resell/localized" },
  define: { "import.meta.env.VITE_SUPABASE_URL": '""', "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": '""' },
  server: { host: "127.0.0.1", port: 1427, strictPort: true, fs: { allow: [resolve(".")] } },
  plugins: [{ name: "isolated-language-fixture", configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith("/__languages")) return next();
      res.setHeader("Content-Type", "text/html");
      res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/@fs/' + resolve("tests/fixtures/languages.tsx").replaceAll("\\", "/") + '"></script></html>');
    });
  } }],
});
