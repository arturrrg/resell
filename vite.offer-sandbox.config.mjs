import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  root: resolve("web"),
  envDir: process.cwd(),
  publicDir: "public",
  base: "/",
  build: {
    assetsInlineLimit: 0,
    outDir: "offer-dist",
    emptyOutDir: true,
    rollupOptions: { input: resolve("web/offer-sandbox.html") },
  },
});
