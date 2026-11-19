import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: ".", testMatch: "languages.spec.ts", workers: 1,
  outputDir: "../artifacts/screenshots/playwright-results",
  use: { channel: "chrome", baseURL: "http://127.0.0.1:1427", viewport: { width: 393, height: 852 }, screenshot: "only-on-failure" },
  webServer: { command: "node node_modules/vite/bin/vite.js --config tests/vite.languages.config.mjs", cwd: fileURLToPath(new URL("..", import.meta.url)), url: "http://127.0.0.1:1427/__languages", reuseExistingServer: true },
});
