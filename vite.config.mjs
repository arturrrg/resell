import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const tauriDevHost = process.env.TAURI_DEV_HOST;
  return {
    root: resolve(process.cwd(), 'web'),
    envDir: process.cwd(),
    publicDir: 'public',
    base: '/',
    resolve: { alias: { '@resell/localized': resolve(process.cwd(), 'web/localized') } },
    esbuild: { jsxImportSource: '@resell/localized' },
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || '')
    },
    server: { host: tauriDevHost || '0.0.0.0', port: 1420, strictPort: true, hmr: tauriDevHost ? { protocol: 'ws', host: tauriDevHost, port: 1421 } : undefined, proxy: { '/api': { target: 'http://127.0.0.1:4175', changeOrigin: true } } },
    preview: { host: '0.0.0.0', port: 4174, strictPort: true },
    build: { outDir: 'dist', emptyOutDir: true, sourcemap: false }
  };
});
